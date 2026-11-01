import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SprintsController } from './sprints.controller.js';
import { SprintsService } from './sprints.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
