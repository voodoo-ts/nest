# About

This integrates [voodoo-ts](https://github.com/voodoo-ts/voodoo-ts) into [NestJS](https://docs.nestjs.com/).

# Getting started

## Install

```bash
npm install @voodoo-ts/nest
```

## General setup 🫡

First create an instance of voodoo-ts and export it, so it can be shared between modules

```ts
// voodoo.instance.ts

import {
  StringToBooleanValueTransformer,
  StringToNumberValueTransformer,
  TransformerInstance,
} from '@voodoo-ts/voodoo-ts';

export const voodoo = TransformerInstance.withDefaultProject({
  additionalValueTransformerFactories: [new StringToNumberValueTransformer(), new StringToBooleanValueTransformer()],
});
```

## Validation

Use the validation pipeline

```ts
// main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@voodoo-ts/nest';

import { AppModule } from './app.module';
import { voodoo } from './validation.instance';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transformerInstance: voodoo }));
  await app.listen(3000);
}
bootstrap();
```

Now you can use voodoo-ts to validate @Body() and @Query() payloads as usual.

```ts
// app.constroller.ts

import { voodoo } from './validation.instance';

@voodoo.Dto()
class LoginDto {
  email!: string;
  password!: string;
}

@Controller()
export class AppController {
  /*
   * This the postHello method
   */
  @Post('/login')
  login(@Body() body: LoginDto): string {
    // ... stuff ...
    return `Hello ${body.email}`;
  }
}
```

This will work only for classes decorated as `@Dto()`. And for primitive data types if you specify the field name, e.g.
`@Query('foo') foo: number`. Unlike the default validation pipeline this will throw errors if it encounters a type reference
it can't validate.

## Swagger

Create an instance of the `SwaggerVoodoo` class in your central `voodoo.instance.ts`, or whereever you like

```ts
// voodoo.instance.ts

import {
  StringToBooleanValueTransformer,
  StringToNumberValueTransformer,
  TransformerInstance,
} from '@voodoo-ts/voodoo-ts';

export const voodoo = TransformerInstance.withDefaultProject({
  additionalValueTransformerFactories: [new StringToNumberValueTransformer(), new StringToBooleanValueTransformer()],
});

export const { ApiModel, additionalModels } = new SwaggerVoodoo(voodoo).unwrap();
```

Now can use `@ApiModel()` to decorate Dto classes. This will ensure all properties are wrapped with `@ApiProperty()` and enrich
their Swagger types and documentation. It's still recommended to enable the swagger-cli plugin from NestJS, but you should disable
the class-validator shims

```json
// nest-cli-json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": false,
          "introspectComments": true
        }
      }
    ]
  }
}
```

voodoo-swagger will automatically create classes for intersections, unions and partials. But you need to expose them to
`@nestjs/swagger`. These classes will be tracked in `additionalModels`.

```ts
// main.ts

import { additionalModels } from './voodoo.instance.ts';

async function bootstrap() {
  // ...
  const document = SwaggerModule.createDocument(app, config, { extraModels: additionalModels });
  SwaggerModule.setup('api', app, document, { customCssUrl: '/theme.css' });
  // ...
}
```

Make sure everything is imported at this point.

## Environment helper

Use the environment helper

```ts
// app.module.ts

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@voodoo-ts/nest';
import { From } from '@voodoo-ts/voodoo-ts';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { voodoo } from './validation.instance';

@voodoo.Dto()
class Env {
  @From('HOME')
  home!: string;
}

// If you don't want to import the ConfigModule in each module
@Global()
@Module({
  imports: [ConfigModule.register(transformer, Env)],
  exports: [ConfigModule],
})
export class GlobalModule {}

@Module({
  imports: [GlobalModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```
