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
import { UserRole } from '@prisma/client';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { MembersService } from './members.service.js';

@ApiTags('members')
@ApiCookieAuth('sprintly_access')
@Controller('members')
@UseGuards(SessionAuthGuard, RolesGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List members for administrators' })
  list() {
    return this.members.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an approved member' })
  create(@Body() body: CreateMemberDto) {
    return this.members.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update member profile, role, or activation' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.members.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate a member and revoke their sessions' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.members.deactivate(id);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Permanently delete a member and related account records',
  })
  permanentlyDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.members.permanentlyDelete(id, request.user.id);
  }
}

@ApiTags('members')
@ApiCookieAuth('sprintly_access')
@Controller('assignee-options')
@UseGuards(SessionAuthGuard)
export class AssigneeOptionsController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'List minimal information for active assignees' })
  list() {
    return this.members.listAssigneeOptions();
  }
}
