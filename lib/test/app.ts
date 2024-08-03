import { ConsoleLogger, INestApplication, ModuleMetadata, Type } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransformerInstance } from '@voodoo-ts/voodoo-ts';
import {
  StringToBooleanValueTransformer,
  StringToNumberValueTransformer,
} from '@voodoo-ts/voodoo-ts/lib/value-transformers';
import { Server } from 'node:net';
import * as supertestRequest from 'supertest';

import { ValidationPipe } from '../voodoo-ts.pipe';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const { Dto, transformer } = TransformerInstance.withDefaultProject({
  additionalValueTransformerFactories: [new StringToBooleanValueTransformer(), new StringToNumberValueTransformer()],
}).unwrap();

class App {
  public testingModule!: TestingModule;
  public nestApplication!: INestApplication<Server>;
  public request!: supertestRequest.Agent;

  public async bootstrap(controllers: ModuleMetadata['controllers'] = []): Promise<void> {
    this.testingModule = await Test.createTestingModule({ controllers }).compile();

    this.nestApplication = this.testingModule.createNestApplication();

    if (process.env.DEBUG) {
      this.nestApplication.useLogger(new ConsoleLogger());
    }

    this.nestApplication.useGlobalPipes(
      new ValidationPipe({
        transformerInstance: transformer,
      }),
    );

    await this.nestApplication.init();

    this.request = supertestRequest(this.nestApplication.getHttpServer());
  }

  public async close(): Promise<void> {
    await this.nestApplication.close();
  }
}

export const app = new App();
