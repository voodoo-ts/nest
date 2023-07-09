import { DynamicModule, Module } from '@nestjs/common';

import { VOODOO_INSTANCE } from './voodoo-ts.tokens';
import { ValidationPipe } from './voodoo-ts.pipe';

@Module({
  imports: [],
  controllers: [ValidationPipe],
  providers: [ValidationPipe],
})
export class VoodooTsModule {
  // static register(options: any): DynamicModule {
  //   return {
  //     module: VoodooTsModule,
  //     providers: [
  //       {
  //         provide: VOODOO_INSTANCE,
  //         useValue: options.instance,
  //       },
  //     ],
  //   };
  // }
}
