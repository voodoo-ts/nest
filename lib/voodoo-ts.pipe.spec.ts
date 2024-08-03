import { Controller, Get, Query } from '@nestjs/common';
import { Transformed } from '@voodoo-ts/voodoo-ts';
import { AssertionError } from 'assert';

import { Dto, app, transformer } from './test/app';
import { ValidationPipe } from './voodoo-ts.pipe';
import { SwaggerVoodoo } from './voodoo-ts.swagger';

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

  it('should transform valid strings', async () => {
    const result = await pipe.transform('true', { metatype: String, type: 'query', data: 'flag' });

    expect(result).toEqual('true');
  });
});

const swagger = new SwaggerVoodoo(transformer);

describe('@Query', () => {
  let query: object | undefined;

  @swagger.apiModel({ for: 'query' })
  @Dto()
  class TestDto {
    ids!: string[];
    tests?: string[];
  }

  @Controller('/')
  class TestController {
    @Get('/')
    test(@Query() q: TestDto): string {
      query = q;
      return 'test';
    }
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  beforeEach(() => {
    return app.bootstrap([TestController]);
  });
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  afterEach(() => {
    query = undefined;
    return app.nestApplication.close();
  });

  it('should fail if required query array is not provided', async () => {
    const response = await app.request.get('/');

    expect(response.ok).toBeFalsy();
  });
  it('should fix up arrays with 1 elements ', async () => {
    const response = await app.request.get('/').query({ ids: ['a'] });

    expect(response.ok).toBe(true);
    expect(query).toEqual({ ids: ['a'] });
  });

  it('should handle arrays with 2 elements', async () => {
    const response = await app.request.get('/').query({ ids: ['a', 'b'] });

    expect(response.ok).toBe(true);
    expect(query).toEqual({ ids: ['a', 'b'] });
  });
});
