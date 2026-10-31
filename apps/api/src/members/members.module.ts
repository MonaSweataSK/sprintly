import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MembersController, AssigneeOptionsController } from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MembersController, AssigneeOptionsController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
