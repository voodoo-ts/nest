import { ArgumentMetadata, HttpStatus, Injectable, Logger, Optional, PipeTransform, Type } from '@nestjs/common';
import { ErrorHttpStatusCode, HttpErrorByCode } from '@nestjs/common/utils/http-error-by-code.util';
import { Transformed, TransformerInstance } from '@voodoo-ts/voodoo-ts';
import { FormattedErrors } from '@voodoo-ts/voodoo-ts/lib/error-formatter';
import { Constructor } from '@voodoo-ts/voodoo-ts/lib/types';
import { types } from 'util';

export const isUndefined = (obj: unknown): obj is undefined => typeof obj === 'undefined';
const isNil = (val: unknown): val is null | undefined => isUndefined(val) || val === null;

export interface ValidationPipeOptions {
  errorHttpStatusCode?: ErrorHttpStatusCode;
  transformerInstance: TransformerInstance;
  expectedType?: Type<unknown>;
  exceptionFactory?: (errors: FormattedErrors) => unknown;
  warnNotHandleable?: boolean;
  libraryPathTransformer?: (fn: string) => string | null;
}

@Injectable()
export class ValidationPipe implements PipeTransform<unknown> {
  protected errorHttpStatusCode: ErrorHttpStatusCode;
  protected expectedType?: Type<unknown>;
  protected exceptionFactory: (errors: FormattedErrors) => unknown;

  protected transformerInstance: TransformerInstance;
  protected numberTransformer: Constructor<unknown>;
  protected booleanTransformer: Constructor<unknown>;
  protected warnNotHandleable: boolean;

  protected logger: Logger = new Logger(this.constructor.name);

  constructor(@Optional() options: ValidationPipeOptions) {
    const { errorHttpStatusCode, expectedType, transformerInstance } = options;

    this.errorHttpStatusCode = errorHttpStatusCode ?? HttpStatus.BAD_REQUEST;
    this.expectedType = expectedType;
    this.exceptionFactory = options.exceptionFactory ?? this.createExceptionFactory();
    this.warnNotHandleable = options.warnNotHandleable ?? true;

    this.transformerInstance = transformerInstance;

    if (options.libraryPathTransformer !== null) {
      const fn =
        options.libraryPathTransformer?.(__filename) ?? __filename.replace('/dist/', '/lib/').replace('.js', '.ts');
      transformerInstance.project.addSourceFileAtPath(fn);
    }

    @transformerInstance.transformerDecorator()
    class BooleanTransformer {
      value!: Transformed<string, boolean>;
    }
    this.booleanTransformer = BooleanTransformer;

    @transformerInstance.transformerDecorator()
    class NumberTransformer {
      value!: Transformed<string, number>;
    }
    this.numberTransformer = NumberTransformer;
  }

  public async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    if (this.expectedType) {
      metadata = { ...metadata, metatype: this.expectedType };
    }

    const metatype = metadata.metatype;
    if (!metatype || !this.toValidate(metadata)) {
      return await this.transformPrimitive(value, metadata);
    }

    value = value !== null && value !== undefined ? value : {};

    this.stripProtoKeys(value);

    const transformResult = await this.transformerInstance.transform(metatype, value as Record<string, unknown>);
    if (!transformResult.success) {
      if (metadata.type === 'query') {
        const errors = Object.fromEntries(
          Object.entries(transformResult.errors).map(([k, v]) => [k.replace(/^\$\./, 'query:'), v]),
        );
        throw await this.exceptionFactory(errors);
      } else {
        throw await this.exceptionFactory(transformResult.errors);
      }
    }

    return transformResult.object;
  }

  public createExceptionFactory() {
    return (validationErrors: FormattedErrors = {}) => {
      return new HttpErrorByCode[this.errorHttpStatusCode](validationErrors);
    };
  }

  protected toValidate(metadata: ArgumentMetadata): boolean {
    const { metatype, type } = metadata;
    if (type === 'custom') {
      return false;
    }
    const types = [String, Boolean, Number, Array, Object, Buffer];
    return !types.some((t) => metatype === t) && !isNil(metatype);
  }

  protected async transformPrimitive(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    if (this.warnNotHandleable && (metadata.metatype === Object || metadata.metatype === Array)) {
      this.logger.warn(`Can't validate/transform ${metadata}`);
    }

    if (!metadata.data) {
      // Leave top-level query/param objects unmodified
      return value;
    }
    const { type, metatype } = metadata;
    if (type !== 'param' && type !== 'query') {
      return value;
    }
    if (metatype === Boolean) {
      const result = await this.transformerInstance.transform(
        this.booleanTransformer as Constructor<{ value: boolean }>,
        { value } as Record<string, unknown>,
      );
      if (result.success) {
        return result.object.value;
      } else {
        throw this.exceptionFactory(result.errors);
      }
    } else if (metatype === Number) {
      const result = await this.transformerInstance.transform(
        this.numberTransformer as Constructor<{ value: number }>,
        { value } as Record<string, unknown>,
      );
      if (result.success) {
        return result.object.value;
      } else {
        const key = ['query', 'param'].includes(metadata.type) ? `${metadata.type}:${metadata.data}` : `unknown`;
        const error: FormattedErrors = {
          [key]: result.errors['$.value'],
        };
        throw this.exceptionFactory(error);
      }
    } else {
      throw new Error(`Unknown type`);
    }
    return value;
  }

  protected stripProtoKeys(value: any): void {
    if (value == null || typeof value !== 'object' || types.isTypedArray(value)) {
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        this.stripProtoKeys(v);
      }
      return;
    }
    delete value.__proto__;
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const key in value) {
      this.stripProtoKeys(value[key]);
    }
  }
}
