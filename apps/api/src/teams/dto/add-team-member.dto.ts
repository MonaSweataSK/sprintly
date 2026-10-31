import { IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  @IsUUID('4')
  userId!: string;
}
