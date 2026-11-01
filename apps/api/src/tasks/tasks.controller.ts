import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { AddTaskDependencyDto } from './dto/add-task-dependency.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiCookieAuth('sprintly_access')
@Controller()
@UseGuards(SessionAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('tasks/backlog')
  @ApiOperation({ summary: 'List active tasks that are not in a sprint' })
  backlog() {
    return this.tasks.listBacklog();
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List active tasks, optionally by sprint' })
  list(
    @Query('sprintId', new ParseUUIDPipe({ optional: true }))
    sprintId?: string,
  ) {
    return this.tasks.list(sprintId);
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Create a task in a sprint or backlog' })
  create(
    @Body() body: CreateTaskDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasks.create(body, request.user);
  }

  @Get('tasks/:taskKey')
  @ApiOperation({ summary: 'Get task details by task key' })
  get(@Param('taskKey') taskKey: string) {
    return this.tasks.getByKey(taskKey);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update task details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTaskDto,
  ) {
    return this.tasks.update(id, body);
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: 'Move a task to the trash' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.softDelete(id);
  }

  @Get('tasks/:id/dependencies')
  @ApiOperation({ summary: 'List task prerequisites' })
  dependencies(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.listDependencies(id);
  }

  @Post('tasks/:id/dependencies')
  @ApiOperation({ summary: 'Add a task prerequisite' })
  addDependency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddTaskDependencyDto,
  ) {
    return this.tasks.addDependency(id, body.dependsOnTaskId);
  }

  @Delete('tasks/:id/dependencies/:dependencyId')
  @ApiOperation({ summary: 'Remove a task prerequisite' })
  removeDependency(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dependencyId', ParseUUIDPipe) dependencyId: string,
  ) {
    return this.tasks.removeDependency(id, dependencyId);
  }

  @Get('sprints/:id/tasks')
  @ApiOperation({ summary: 'List active tasks for a sprint' })
  sprintTasks(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.list(id);
  }
}
