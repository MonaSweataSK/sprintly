import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  TeamOptionsController,
  TeamsController,
} from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TeamsController, TeamOptionsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
