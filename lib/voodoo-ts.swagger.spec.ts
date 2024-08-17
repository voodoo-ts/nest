import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { TransformerInstance } from '@voodoo-ts/voodoo-ts';
import { IsEmail, IsFQDN, IsUrl, Length, Range, Regexp } from '@voodoo-ts/voodoo-ts/lib/decorators';
import { Constructor } from '@voodoo-ts/voodoo-ts/lib/types';

import { Example, OpenApiVoodoo } from './voodoo-ts.swagger';

// eslint-disable-next-line @typescript-eslint/naming-convention
const { Dto, transformer } = TransformerInstance.withDefaultProject({}).unwrap();

const openApi = new OpenApiVoodoo(transformer);

@openApi.apiModel()
@Dto()
class Embed {
  name!: string;
  email!: string;
}

@openApi.apiModel()
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

@openApi.apiModel()
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

  testNestedArray!: string[][];
}

function getMetadata(cls: Constructor<unknown>, name: string): unknown {
  return Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, cls.prototype, name);
}

describe('OpenAPI', () => {
  it('should process', () => {
    openApi.processApiModels();
  });

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
      ':testNestedArray',
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
        type: 'string',
        required: true,
        minItems: 5,
        maxItems: 10,
        isArray: true,
      },
      testNumberArray: {
        type: 'number',
        required: true,
        minItems: 5,
        maxItems: 10,
        isArray: true,
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
      testNestedArray: {
        type: 'string',
        required: true,
        isArray: true,
      },
    });
  });

  it('should track additional models', () => {
    expect(new Set(openApi.additionalModels).size).toEqual(openApi.additionalModels.length);

    expect(new Set(openApi.additionalModels.map((cls) => cls.name))).toEqual(
      new Set(['Pick<Embed, name>', 'Omit<Embed, name>', 'Partial<Embed>', 'Embed', 'Password']),
    );
  });
});
