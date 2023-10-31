import { Inject, Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ENVIRONMENT } from './voodoo-ts.tokens';
import { From, TransformerInstance } from '@voodoo-ts/voodoo-ts';
import { ConfigModule, InjectEnvironment, Secret, printEnv } from './config.module';
import { SwaggerVoodoo } from './voodoo-ts.swagger';
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
    ]);
  });

  it('should generate correct schemas', () => {
    const props = transformer.getPropertyTypeTreesFromConstructor(ApiModel).map(({ name }) => name);
    const propData = Object.fromEntries(props.map((name) => [name, getMetadata(ApiModel, name)]));
    console.log(JSON.stringify(propData));
    expect(propData).toEqual({
      testString: {
        type: 'string',
        example: 'test',
        description: 'This is a test string',
        required: true,
        minLength: 1,
      },
      testUrl: { type: 'string', required: true, format: 'url' },
      testEmail: { type: 'string', required: true, format: 'email' },
      testRegex: { type: 'string', required: true, pattern: '/fooo/' },
      testFQDN: { type: 'string', required: true, format: 'hostname' },
      testNumber: { type: 'number', required: true, minimum: 9000, maximum: 9001 },
      testNullable: { type: 'string', required: true, nullable: true },
      testUnion: { type: 'unknown', oneOf: [{ type: 'string' }, { type: 'number' }], required: true },
      testEmbed: { type: 'object', $ref: '#/components/schemas/Embed', required: true },
      testPick: { type: 'object', $ref: '#/components/schemas/Pick<Embed, name>', required: true },
      testOmit: { type: 'object', $ref: '#/components/schemas/Omit<Embed, name>', required: true },
      testPartial: { type: 'object', $ref: '#/components/schemas/Partial<Embed>', required: true },
      testIntersection: {
        type: 'unknown',
        allOf: [
          { type: 'object', $ref: '#/components/schemas/Embed' },
          { type: 'object', $ref: '#/components/schemas/Password' },
        ],
        required: true,
      },
      testEnum: { type: 'enum', enumName: 'TestEnum', enum: ['test', 'bar'], required: true },
      testArray: { type: 'array', items: { type: 'string' }, required: true, minItems: 5, maxItems: 10 },
      testNumberArray: { type: 'array', items: { type: 'number' }, required: true, minItems: 5, maxItems: 10 },
    });
  });

  it('should track additional models', () => {
    expect(new Set(swagger.additionalModels).size).toEqual(swagger.additionalModels.length);

    expect(new Set(swagger.additionalModels.map((cls) => cls.name))).toEqual(
      new Set(['Pick<Embed, name>', 'Omit<Embed, name>', 'Partial<Embed>', 'Embed', 'Password']),
    );
  });
});
