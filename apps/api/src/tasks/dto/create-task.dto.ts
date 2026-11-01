import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional()
  @IsUUID('4')
  assigneeId?: string | null;

  @IsOptional()
  @IsUUID('4')
  sprintId?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
