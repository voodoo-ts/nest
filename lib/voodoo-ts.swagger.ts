import 'reflect-metadata';

import { ApiProperty, ApiPropertyOptions, OmitType, PartialType, PickType, getSchemaPath } from '@nestjs/swagger';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { BaseTransformerInstance } from '@voodoo-ts/voodoo-ts';
import { createAnnotationDecorator } from '@voodoo-ts/voodoo-ts/lib/decorators';
import {
  ClassNode,
  IPropertyComment,
  RootNode,
  TypeNode,
  groupValidatorFunctions,
  IPropertyValidatorMetaMapping,
} from '@voodoo-ts/voodoo-ts/lib/nodes';
import { Constructor } from '@voodoo-ts/voodoo-ts/lib/types';

type RegisterMappedType = (
  type: 'partial' | 'pick' | 'omit' | 'class',
  node: ClassNode,
  cls: Constructor<unknown>,
  partialCls: Constructor<unknown>,
) => void;

declare module '@voodoo-ts/voodoo-ts/lib/nodes' {
  // Extends the IAnnoationMap from ./nodes.ts
  // eslint-disable-next-line no-shadow
  export interface IAnnotationMap {
    example?: string;
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Example = createAnnotationDecorator<[example: string]>({
  name: 'example',
  type: 'root',
});

export class SwaggerVoodoo {
  transformer: BaseTransformerInstance;
  additionalModels: Constructor<unknown>[] = [];

  constructor(transformer: BaseTransformerInstance) {
    this.transformer = transformer;
  }

  classTreeToSwagger(
    node: TypeNode,
    registerMappedType: RegisterMappedType,
  ): SchemaObject | (ReferenceObject & { enumName?: string }) {
    switch (node.kind) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'record':
      case 'any': {
        const mappedType =
          {
            record: 'object',
            // eslint-disable-next-line id-blacklist
            number: 'number',
          }[node.kind as string] ?? node.kind;
        return { type: mappedType };
      }
      case 'literal':
        const type = ['string', 'number', 'boolean'].includes(typeof node.expected) ? typeof node.expected : null;
        if (!type) {
          return {
            type: undefined,
          };
        }

        if (type === 'string') {
          return {
            type: 'string',
            pattern: `^${node.expected}$`,
            example: node.expected,
          };
        }

        return {
          type,
          example: node.expected,
        };
      case 'enum': {
        return {
          enumName: node.name,
          enum: node.allowedValues,
          type: 'enum',
        };
      }
      case 'union': {
        const unionWithoutNull = node.children
          .filter((n) => !isNullNode(n))
          .map((n) => this.classTreeToSwagger(n, registerMappedType));
        if (unionWithoutNull.length > 1) {
          return {
            oneOf: unionWithoutNull,
          };
        } else {
          return { type: 'unknown', ...unionWithoutNull[0] };
        }
      }
      case 'class': {
        const ref = node.meta.reference;
        const cls = this.transformer.getClassByReference(ref);

        if (!cls) {
          // Materialize object literals and intterfaces
          if (node.meta.from === 'object' || node.meta.from === 'interface') {
            throw new Error(`Object literals and interfaces are not supported at the moment`);
          }
          throw new Error(`Could not resolve class for ref ${ref}`);
        }

        if (node.meta.partial) {
          class PartialSchema extends PartialType(cls) {}
          Object.defineProperty(PartialSchema, 'name', {
            value: `Partial<${cls.name}>`,
            writable: false,
          });
          registerMappedType('partial', node, cls, PartialSchema);

          return {
            type: 'object',
            $ref: getSchemaPath(PartialSchema),
          };
        } else if (node.meta.picked) {
          const fields = Array.from(node.meta.picked);
          class PickSchema extends PickType<any, string>(cls, fields) {}
          Object.defineProperty(PickSchema, 'name', {
            value: `Pick<${cls.name}, ${fields.join(' | ')}>`,
            writable: false,
          });
          registerMappedType('pick', node, cls, PickSchema);
          return { type: 'object', $ref: getSchemaPath(PickSchema) };
        } else if (node.meta.omitted) {
          const fields = Array.from(node.meta.omitted);
          class OmitSchema extends OmitType<any, string>(cls, fields) {}
          Object.defineProperty(OmitSchema, 'name', {
            value: `Omit<${cls.name}, ${fields.join(' | ')}>`,
            writable: false,
          });
          registerMappedType('omit', node, cls, OmitSchema);
          return { type: 'object', $ref: getSchemaPath(OmitSchema) };
        } else {
          registerMappedType('class', node, cls, cls);
          return {
            $ref: getSchemaPath(cls),
            type: 'object',
          };
        }
      }
      case 'array': {
        return {
          type: 'array',
          items: this.classTreeToSwagger(node.children[0], registerMappedType),
        };
      }
      case 'tuple': {
        throw new Error('Not implemented yet: "tuple" case');
      }

      case 'intersection': {
        return {
          allOf: node.children.map((n) => this.classTreeToSwagger(n, registerMappedType)),
        };
      }
      default:
        throw new Error('');
    }
  }
  getType(root: RootNode, registerMappedType: RegisterMappedType): Partial<ApiPropertyOptions> {
    const type = this.classTreeToSwagger(root.children[0], registerMappedType) as ApiPropertyOptions;
    return type;
  }

  apiModel(): ClassDecorator {
    return (target: object): void => {
      const cls = target as Constructor<unknown>;
      const additionalModels: Constructor<unknown>[] = [];
      const trees = this.transformer.getClassNode(cls).getClassTrees();
      for (const { name, tree } of trees) {
        const apiModelProperties: ApiPropertyOptions =
          Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, cls.prototype, name) ?? {};

        const type = this.getType(tree as RootNode, (kind, node, cls, schemaClass) => {
          if (!this.additionalModels.includes(schemaClass)) {
            this.additionalModels.push(schemaClass);
          }
          if (!additionalModels.includes(schemaClass)) {
            additionalModels.push(schemaClass);
          }
        });
        const mine: ApiPropertyOptions = {
          type: 'unknown',
          ...type,
          ...getDescriptionAndExamples(tree.annotations.comment),
          ...getRequiredAndNullable(tree as RootNode),
          ...getConstratintsFromDecorators(tree as RootNode),
        };

        ApiProperty({ ...mine, ...apiModelProperties })(cls.prototype, name);

        const propertiesArray = (Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, cls.prototype) ??
          []) as string[];
        if (!propertiesArray.includes(`:${name}`)) {
          propertiesArray.push(`:${name}`);
        }
        Reflect.defineMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, propertiesArray, cls.prototype);
      }
      Reflect.defineMetadata('voodoo/additionalModels', additionalModels, cls.prototype);
    };
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  unwrap(): { additionalModels: Constructor<unknown>[]; ApiModel: () => ClassDecorator } {
    return {
      additionalModels: this.additionalModels,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ApiModel: this.apiModel.bind(this),
    };
  }
}

interface INodeWithConstraints {
  node: TypeNode;
  constraints: IPropertyValidatorMetaMapping;
}

function getConstratintsFromDecorators(tree: RootNode): Partial<ApiPropertyOptions> {
  const options: Partial<ApiPropertyOptions> = {};
  const nodesWithConstraints = getAllPropertyValidatorMetadataMappings(tree); //groupValidatorFunctions(tree.annotations.validationFunctions ?? []);
  for (const { constraints, node } of nodesWithConstraints) {
    if (constraints['@Regexp']) {
      options.pattern = constraints['@Regexp'].pattern;
    }

    if (constraints['@Range']) {
      const { min, max } = constraints['@Range'];
      options.minimum = min;
      options.maximum = max;
    }

    if (constraints['@IsInteger']) {
      options.type = 'integer';
    }

    if (constraints['@Length']) {
      const { min, max } = constraints['@Length'];

      if (node.kind === 'root') {
        if (tree.children[0].kind === 'array') {
          options.minItems = min;
          options.maxItems = max;
        }

        if (tree.children[0].kind === 'string') {
          options.minLength = min;
          options.maxLength = max;
        }
      }
      if (node.kind === 'string') {
        options.minLength = min;
        options.maxLength = max;
      }
      if (node.kind === 'array') {
        options.minItems = min;
        options.maxItems = max;
      }
    }
    if (constraints['@IsFQDN']) {
      options.format = 'hostname';
    }
    if (constraints['@IsUrl']) {
      options.format = 'url';
    }
    if (constraints['@IsEmail']) {
      options.format = 'email';
    }
    if (constraints['@IsISO8601']) {
      options.format = 'date-time';
    }
  }
  return options;
}

function getAllPropertyValidatorMetadataMappings(node: TypeNode): INodeWithConstraints[] {
  const nodeAndConstraints: INodeWithConstraints[] = [];
  const constraints = groupValidatorFunctions(node.annotations.validationFunctions ?? []);

  nodeAndConstraints.push({ node, constraints });

  for (const child of node.children) {
    nodeAndConstraints.push(...getAllPropertyValidatorMetadataMappings(child));
  }

  return nodeAndConstraints;
}

function hasNode(node: TypeNode, kind: TypeNode['kind']): boolean {
  if (node.kind === kind) {
    return true;
  }
  for (const c of node.children) {
    if (hasNode(c, kind)) {
      return true;
    }
  }
  return false;
}

function isNullNode(n: TypeNode): boolean {
  return Boolean(n.kind === 'literal' && n.expected === null);
}

function groupCommentTags(comment?: IPropertyComment): Map<string, string[]> {
  const map = new Map<string, string[]>();

  if (!comment) {
    return map;
  }

  for (const c of comment.tags) {
    const l = map.get(c.tagName) ?? [];
    l.push(c.text);
    map.set(c.text, l);
  }

  return map;
}

const getDescriptionAndExamples = (comment?: IPropertyComment): Partial<ApiPropertyOptions> => {
  if (!comment) {
    return {};
  }
  const examples = comment.tags.filter((t) => t.tagName === 'example').map((t) => t.text);
  if (!examples.length) {
    return {};
  }

  const description = comment.tags.find((t) => t.tagName === 'description')?.text;

  if (examples.length > 1) {
    const exampleMap: Record<string, unknown> = {};
    examples.map((e, i) => {
      const match = e.match(/^(?<exampleName>.+?):\s*(?<example>(.|\n)+)/m);
      const exampleName = match?.groups?.exampleName ?? `Unnamed ${i}`;
      const example = match?.groups?.example;
      exampleMap[exampleName] = { value: example };
    });
    return { examples: exampleMap, description };
  } else {
    return { example: examples[0], description };
  }
};

function getRequiredAndNullable(root: RootNode): Partial<ApiPropertyOptions> {
  const hasNull = Boolean(
    isNullNode(root.children[0]) || (root.children[0].kind === 'union' && root.children[0].children.find(isNullNode)),
  );

  return {
    required: !root.optional,
    nullable: hasNull ? true : undefined,
  };
}

export function getAdditionalModels(...classes: Constructor<unknown>[]): Constructor<unknown>[] {
  return classes.flatMap(
    (cls) => (Reflect.getMetadata('voodoo/additionalModels', cls.prototype) as Constructor<unknown>[]) ?? [],
  );
}

/* istanbul ignore next */
export function debug(obj: unknown): void {
  console.dir(obj, { depth: null, colors: true });
}
