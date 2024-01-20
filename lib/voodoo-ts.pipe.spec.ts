import { Transformed, TransformerInstance } from '@voodoo-ts/voodoo-ts';
import {
  StringToBooleanValueTransformer,
  StringToNumberValueTransformer,
} from '@voodoo-ts/voodoo-ts/lib/value-transformers';
import { AssertionError } from 'assert';

import { VoodooTsModule } from './voodoo-ts.module';
import { ValidationPipe } from './voodoo-ts.pipe';

// eslint-disable-next-line @typescript-eslint/naming-convention
const { Dto, transformer } = TransformerInstance.withDefaultProject({
  additionalValueTransformerFactories: [new StringToBooleanValueTransformer(), new StringToNumberValueTransformer()],
}).unwrap();

async function getException(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e: unknown) {
    return e;
  }
  throw new AssertionError({ message: 'Did expect to raise' });
}

function expectResponse(e: unknown): asserts e is { response: unknown } {
  if (e === null || e === undefined || typeof e !== 'object' || !('response' in e)) {
    throw new AssertionError({ message: 'Expected HTTPException', actual: e, expected: 'HTTPException' });
  }
}

describe('', () => {
  const pipe = new ValidationPipe({ transformerInstance: transformer });

  @Dto()
  class QueryTestDto {
    thingEnabled!: Transformed<string, boolean>;
    page!: Transformed<string, number>;
  }

  it('should construct', () => {
    expect(pipe).toBeTruthy();
  });

  it('should construct the module', () => {
    const module = new VoodooTsModule();
    expect(module).toBeTruthy();
  });

  it('should transform valid @Query() param: Dto', async () => {
    const result = await pipe.transform(
      { thingEnabled: 'true', page: '123' },
      { metatype: QueryTestDto, type: 'query', data: undefined },
    );

    expect(result).toEqual({ thingEnabled: true, page: 123 });
  });

  it('should not transform invalid @Body() param: Dto', async () => {
    const exception = await getException(
      pipe.transform({ thingEnabled: 'x', page: 123 }, { metatype: QueryTestDto, type: 'body', data: undefined }),
    );
    expect(exception).toBeInstanceOf(Error);
    expectResponse(exception);

    expect(exception.response).toEqual(
      expect.objectContaining({
        ['$.thingEnabled']: expect.any(Object),
        ['$.page']: expect.any(Object),
      }),
    );
  });

  it('should not transform invalid @Query() param: Dto', async () => {
    const exception = await getException(
      pipe.transform({ thingEnabled: 'x', page: 123 }, { metatype: QueryTestDto, type: 'query', data: undefined }),
    );
    expect(exception).toBeInstanceOf(Error);
    expectResponse(exception);

    expect(exception.response).toEqual(
      expect.objectContaining({
        ['query:thingEnabled']: expect.any(Object),
        ['query:page']: expect.any(Object),
      }),
    );
  });

  it('should transform to number', async () => {
    const result = await pipe.transform('123', { metatype: Number, type: 'param', data: 'page' });

    expect(result).toEqual(123);
  });

  it('should not transform to number', async () => {
    const e = await getException(pipe.transform('a123', { metatype: Number, type: 'param', data: 'page' }));

    expect(e).toBeInstanceOf(Error);
    expectResponse(e);

    expect(e.response).toEqual(
      expect.objectContaining({
        ['param:page']: expect.any(Object),
      }),
    );
  });

  it('should transform valid boolean strings', async () => {
    const result = await pipe.transform('true', { metatype: Boolean, type: 'query', data: 'flag' });

    expect(result).toEqual(true);
  });

  it('should not transform invalid boolean strings', async () => {
    const e = await getException(pipe.transform('a123', { metatype: Boolean, type: 'query', data: 'flag' }));

    expect(e).toBeInstanceOf(Error);
    expectResponse(e);

    expect(e.response).toEqual(
      expect.objectContaining({
        ['query:flag']: expect.any(Object),
      }),
    );
  });

  it('should transform valid string strings', async () => {
    const result = await pipe.transform('true', { metatype: String, type: 'query', data: 'flag' });

    expect(result).toEqual('true');
  });
});
