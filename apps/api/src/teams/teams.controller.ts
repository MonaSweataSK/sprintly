import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { AddTeamMemberDto } from './dto/add-team-member.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamMembersDto } from './dto/update-team-members.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { TeamsService } from './teams.service.js';

@ApiTags('teams')
@ApiCookieAuth('sprintly_access')
@Controller('teams')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List teams and their members for administrators' })
  list() {
    return this.teams.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a team with optional active members' })
  create(@Body() body: CreateTeamDto) {
    return this.teams.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team details or membership' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTeamDto,
  ) {
    return this.teams.update(id, body);
  }

  @Put(':id/members')
  @ApiOperation({ summary: 'Replace a team membership list' })
  updateMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTeamMembersDto,
  ) {
    return this.teams.update(id, { memberIds: body.memberIds });
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add an active member to a team' })
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddTeamMemberDto,
  ) {
    return this.teams.addMember(id, body.userId);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from a team' })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.teams.removeMember(id, memberId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a team and its memberships' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teams.remove(id);
  }
}

@ApiTags('teams')
@ApiCookieAuth('sprintly_access')
@Controller('team-options')
@UseGuards(SessionAuthGuard)
export class TeamOptionsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List minimal team information for selection' })
  list() {
    return this.teams.listOptions();
  }
}
