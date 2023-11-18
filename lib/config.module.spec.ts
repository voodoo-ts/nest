import { Inject, Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ENVIRONMENT } from './voodoo-ts.tokens';
import { From, TransformerInstance } from '@voodoo-ts/voodoo-ts';
import { ConfigModule, InjectEnvironment, Secret, printEnv } from './config.module';

// eslint-disable-next-line @typescript-eslint/naming-convention
const { Dto, transformer } = TransformerInstance.withDefaultProject({}).unwrap();

@Dto()
class TestEnv {
  @From('NODE_ENV')
  nodeEnv!: string;

  @Secret()
  secretValue123!: string;
}

@Injectable()
class TestService {
  constructor(@InjectEnvironment() public readonly env: TestEnv) {}
}

describe('ConfigModule', () => {
  let service: TestService;

  beforeEach(async () => {
    process.env.secretValue123 = 'secret string';
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.register(transformer, TestEnv)],
      providers: [TestService],
    }).compile();

    service = module.get<TestService>(TestService);
  });

  afterEach(() => {
    delete process.env.secretValue123;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should inject the environment', () => {
    expect(service.env).toBeInstanceOf(TestEnv);
    expect(service.env).toEqual({ nodeEnv: 'test', secretValue123: 'secret string' });
  });

  it('should log the environment correctly', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    printEnv(transformer, service.env as unknown as Record<string, unknown>);

    expect(consoleSpy).toHaveBeenCalledWith('NODE_ENV:       test');
    expect(consoleSpy).toHaveBeenCalledWith('secretValue123: <secret string with 13 characters>');

    consoleSpy.mockClear();
  });

  it('should throw if env is not valid', async () => {
    delete process.env.secretValue123;

    return expect(() => ConfigModule.register(transformer, TestEnv)).rejects.toEqual(
      new Error('Failed to parse environment'),
    );
  });
});
