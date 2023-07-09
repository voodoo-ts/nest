import { DynamicModule, Inject, Injectable, Module, OnModuleInit, Scope } from '@nestjs/common';
import { TransformerInstance } from '@voodoo-ts/voodoo-ts';
import { createAnnotationDecorator } from '@voodoo-ts/voodoo-ts/lib/decorators';
import { Constructor } from '@voodoo-ts/voodoo-ts/lib/types';

import { ENVIRONMENT, VOODOO_INSTANCE } from './voodoo-ts.tokens';

export const secretDecorator = createAnnotationDecorator<[hidden: boolean]>({
  name: 'secret',
  type: 'root',
});
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Secret = (): ReturnType<typeof secretDecorator> => secretDecorator(true);

declare module '@voodoo-ts/voodoo-ts/lib/nodes' {
  // Extends the IAnnoationMap from ./nodes.ts
  // eslint-disable-next-line no-shadow
  export interface IAnnotationMap {
    secret?: boolean;
  }
}

export function printEnv<T extends Record<string, unknown>>(voodoo: TransformerInstance, env: T): void {
  const properties = voodoo.getPropertyTypeTreesFromConstructor(env.constructor as Constructor<T>);
  const padName = Math.max(...properties.map(({ name, tree }) => (tree.annotations.fromProperty ?? name).length)) + 1;
  const formatSecret = (v: unknown): string => {
    if (v === undefined) {
      return '<secret is undefined>';
    }
    if (v === null) {
      return '<secret is null>';
    }
    if (typeof v === 'string') {
      return `<secret string with ${v.length} characters>`;
    }
    return `<secret of unknown type>`;
  };
  // const padValue = Math.max(...properties.map(({ name }) => env[name].toString().length));
  for (const { name, tree } of properties) {
    const value = !tree.annotations.secret ? env[name] : formatSecret(env[name]);
    const key = tree.annotations.fromProperty ?? name;
    // eslint-disable-next-line no-console
    console.log(`${(key + ':').padEnd(padName, ' ')} ${value}`);
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/explicit-function-return-type
export const InjectEnvironment = () => Inject(ENVIRONMENT);

@Module({
  providers: [],
})
export class ConfigModule {
  static async register<T>(
    voodoo: TransformerInstance,
    cls: Constructor<T>,
    options: { dump?: boolean } = {},
  ): Promise<DynamicModule> {
    const result = await voodoo.transform(cls, process.env as Partial<T>, { allowUnknownFields: true });

    if (!result.success) {
      // eslint-disable-next-line no-console
      console.log('Failed to parse environment:');
      for (const [envVar, error] of Object.entries(result.errors)) {
        // eslint-disable-next-line no-console
        console.log(envVar.replace(/^\$\./, 'process.env.') + ':', error.message);
      }

      throw new Error('Failed to parse environment');
    }

    if (result.success && options.dump) {
      printEnv(voodoo, result.object as Record<string, unknown>);
    }

    return {
      module: ConfigModule,
      providers: [
        {
          provide: ENVIRONMENT,
          useValue: result.object,
        },
      ],
      exports: [ENVIRONMENT],
    };
  }
}
