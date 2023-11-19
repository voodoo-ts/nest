import { Inject, Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ENVIRONMENT } from './voodoo-ts.tokens';
import { From, TransformerInstance } from '@voodoo-ts/voodoo-ts';
import { ConfigModule, InjectEnvironment, Secret, printEnv } from './config.module';
import { Example, SwaggerVoodoo } from './voodoo-ts.swagger';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { IsEmail, IsFQDN, IsUrl, Length, Range, Regexp } from '@voodoo-ts/voodoo-ts/lib/decorators';
import { Constructor } from '@voodoo-ts/voodoo-ts/lib/types';

// eslint-disable-next-line @typescript-eslint/naming-convention
const { Dto, transformer } = TransformerInstance.withDefaultProject({}).unwrap();

const swagger = new SwaggerVoodoo(transformer);

@swagger.apiModel()
@Dto()
class Embed {
  name!: string;
  email!: string;
}

@swagger.apiModel()
@Dto()
class Password {
  password!: string;
}

enum TestEnum {
  TEST = 'test',
  BAR = 'bar',
}

interface ITestInterface {
  interfaceProperty: string;
}

@swagger.apiModel()
@Dto()
class ApiModel {
  /**
   * @description This is a test string
   * @example test
   */
  @Length(1)
  testString!: string;

  /**
   * Should match an url
   */
  @IsUrl()
  testUrl!: string;

  @IsEmail()
  testEmail!: string;

  @Regexp(/fooo/)
  testRegex!: string;

  @IsFQDN()
  testFQDN!: string;

  @Range(9000, 9001)
  testNumber!: number;

  testNullable!: string | null;

  testUnion!: string | number;

  testEmbed!: Embed;

  testPick!: Pick<Embed, 'name'>;

  testOmit!: Omit<Embed, 'name'>;

  testPartial!: Partial<Embed>;

  testIntersection!: Embed & Password;

  testEnum!: TestEnum;

  @Length(5, 10)
  testArray!: string[];

  @Length(5, 10)
  testNumberArray!: number[];

  testObjectLiteral!: {
    page: number;
    pages: number;
  };

  testInterface!: ITestInterface;

  testStringLiteral!: 'lit';

  testNumberLiteral!: 9001;

  testBooleanLiteral!: true;

  testNullLiteral!: null;

  @Example('example value')
  testExample!: string;
}

function getMetadata(cls: Constructor<unknown>, name: string) {
  return Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, cls.prototype, name);
}

describe('OpenAPI', () => {
  it('should have added all properties to the class', () => {
    const propertiesArray = Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, ApiModel.prototype);
    expect(propertiesArray).toEqual([
      ':testString',
      ':testUrl',
      ':testEmail',
      ':testRegex',
      ':testFQDN',
      ':testNumber',
      ':testNullable',
      ':testUnion',
      ':testEmbed',
      ':testPick',
      ':testOmit',
      ':testPartial',
      ':testIntersection',
      ':testEnum',
      ':testArray',
      ':testNumberArray',
      ':testObjectLiteral',
      ':testInterface',
      ':testStringLiteral',
      ':testNumberLiteral',
      ':testBooleanLiteral',
      ':testNullLiteral',
      ':testExample',
    ]);
  });

  it('should generate correct schemas', () => {
    const props = transformer.getPropertyTypeTreesFromConstructor(ApiModel).map(({ name }) => name);
    const propData = Object.fromEntries(props.map((name) => [name, getMetadata(ApiModel, name)]));

    expect(propData).toEqual({
      testString: {
        type: 'string',
        example: 'test',
        description: 'This is a test string',
        required: true,
        minLength: 1,
        isArray: false,
      },
      testUrl: { type: 'string', required: true, format: 'url', isArray: false },
      testEmail: { type: 'string', required: true, format: 'email', isArray: false },
      testRegex: { type: 'string', required: true, pattern: '/fooo/', isArray: false },
      testFQDN: { type: 'string', required: true, format: 'hostname', isArray: false },
      testNumber: { type: 'number', required: true, minimum: 9000, maximum: 9001, isArray: false },
      testNullable: { type: 'string', required: true, nullable: true, isArray: false },
      testUnion: { type: 'unknown', oneOf: [{ type: 'string' }, { type: 'number' }], required: true, isArray: false },
      testEmbed: { type: 'object', $ref: '#/components/schemas/Embed', required: true, isArray: false },
      testPick: { type: 'object', $ref: '#/components/schemas/Pick<Embed, name>', required: true, isArray: false },
      testOmit: { type: 'object', $ref: '#/components/schemas/Omit<Embed, name>', required: true, isArray: false },
      testPartial: { type: 'object', $ref: '#/components/schemas/Partial<Embed>', required: true, isArray: false },
      testIntersection: {
        type: 'unknown',
        allOf: [
          { type: 'object', $ref: '#/components/schemas/Embed' },
          { type: 'object', $ref: '#/components/schemas/Password' },
        ],
        required: true,
        isArray: false,
      },
      testEnum: { type: 'string', enumName: 'TestEnum', enum: ['test', 'bar'], required: true, isArray: false },
      testArray: {
        type: 'array',
        items: { type: 'string' },
        required: true,
        minItems: 5,
        maxItems: 10,
        isArray: false,
      },
      testNumberArray: {
        type: 'array',
        items: { type: 'number' },
        required: true,
        minItems: 5,
        maxItems: 10,
        isArray: false,
      },
      testInterface: {
        isArray: false,
        properties: {
          interfaceProperty: {
            type: 'string',
          },
        },
        required: true,
        type: 'object',
      },
      testObjectLiteral: {
        isArray: false,
        properties: {
          page: {
            type: 'number',
          },
          pages: {
            type: 'number',
          },
        },
        required: true,
        type: 'object',
      },
      testStringLiteral: {
        example: 'lit',
        isArray: false,
        pattern: '^lit$',
        required: true,
        type: 'string',
      },
      testNumberLiteral: {
        example: 9001,
        isArray: false,
        required: true,
        type: 'number',
      },
      testBooleanLiteral: {
        example: true,
        isArray: false,
        required: true,
        type: 'boolean',
      },
      testNullLiteral: {
        nullable: true,
        required: true,
      },
      testExample: {
        example: 'example value',
        isArray: false,
        required: true,
        type: 'string',
      },
    });
  });

  it('should track additional models', () => {
    expect(new Set(swagger.additionalModels).size).toEqual(swagger.additionalModels.length);

    expect(new Set(swagger.additionalModels.map((cls) => cls.name))).toEqual(
      new Set(['Pick<Embed, name>', 'Omit<Embed, name>', 'Partial<Embed>', 'Embed', 'Password']),
    );
  });
});
