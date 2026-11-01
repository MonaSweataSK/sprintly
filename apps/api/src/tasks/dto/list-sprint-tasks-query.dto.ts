import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const taskSortFields = [
  'taskKey',
  'title',
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
] as const;

export type TaskSortField = (typeof taskSortFields)[number];
export type TaskSortOrder = 'asc' | 'desc';

export class ListSprintTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsIn(taskSortFields)
  sortBy: TaskSortField = 'taskKey';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: TaskSortOrder = 'asc';
}
