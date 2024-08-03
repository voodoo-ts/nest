import { Module } from '@nestjs/common';

import { ValidationPipe } from './voodoo-ts.pipe';

@Module({
  imports: [],
  providers: [ValidationPipe],
})
export class VoodooTsModule {}
