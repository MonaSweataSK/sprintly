import { IsEnum } from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class UpdateSprintStatusDto {
  @IsEnum(SprintStatus)
  status!: SprintStatus;
}
