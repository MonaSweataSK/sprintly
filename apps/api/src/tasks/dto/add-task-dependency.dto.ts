import { IsUUID } from 'class-validator';

export class AddTaskDependencyDto {
  @IsUUID('4')
  dependsOnTaskId!: string;
}
