import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CreateSprintDto } from './dto/create-sprint.dto.js';
import { UpdateSprintDto } from './dto/update-sprint.dto.js';
import { UpdateSprintStatusDto } from './dto/update-sprint-status.dto.js';
import { SprintsService } from './sprints.service.js';

@ApiTags('sprints')
@ApiCookieAuth('sprintly_access')
@Controller('sprints')
@UseGuards(SessionAuthGuard)
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get()
  @ApiOperation({ summary: 'List all sprints for the workspace' })
  list() {
    return this.sprints.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a sprint' })
  create(
    @Body() body: CreateSprintDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sprints.create(body, request.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sprint details' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sprint details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSprintDto,
  ) {
    return this.sprints.update(id, body);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Set sprint status; completion requires all active tasks to be done',
  })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSprintStatusDto,
  ) {
    return this.sprints.setStatus(id, body.status);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a planned sprint' })
  start(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.start(id);
  }

  @Post(':id/plan')
  @ApiOperation({ summary: 'Move an active sprint back to planned' })
  moveToPlanned(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.moveToPlanned(id);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen a completed sprint' })
  reopen(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.reopen(id);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Complete a sprint when all active tasks are done',
  })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.setStatus(id, 'COMPLETED');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sprint and move its tasks to backlog' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.sprints.delete(id);
  }
}
