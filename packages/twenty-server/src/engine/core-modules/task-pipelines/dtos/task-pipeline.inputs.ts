import { Field, Float, InputType } from '@nestjs/graphql';

import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

export const TASK_PIPELINE_VISIBILITIES = ['WORKSPACE', 'PERSONAL'] as const;
export const TASK_PIPELINE_ROLES = ['ADMIN', 'MEMBER'] as const;
export const TASK_PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

@InputType('TaskPipelineStageInput')
export class TaskPipelineStageInput {
  @Field(() => UUIDScalarType, { nullable: true })
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @Field(() => String)
  @IsString()
  @MaxLength(30)
  color: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isDone?: boolean | null;
}

@InputType('TaskPipelineLabelInput')
export class TaskPipelineLabelInput {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @Field(() => String)
  @IsString()
  @MaxLength(30)
  color: string;
}

@InputType('CreateTaskPipelineInput')
export class CreateTaskPipelineInput {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string | null;

  @Field(() => String)
  @IsIn(TASK_PIPELINE_VISIBILITIES)
  visibility: (typeof TASK_PIPELINE_VISIBILITIES)[number];

  @Field(() => [TaskPipelineStageInput], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TaskPipelineStageInput)
  stages?: TaskPipelineStageInput[] | null;
}

@InputType('UpdateTaskPipelineInput')
export class UpdateTaskPipelineInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string | null;

  @Field(() => [TaskPipelineLabelInput], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TaskPipelineLabelInput)
  labels?: TaskPipelineLabelInput[] | null;
}

@InputType('TaskPipelineTaskChecklistItemInput')
export class TaskPipelineTaskChecklistItemInput {
  @Field(() => String)
  @IsString()
  @MaxLength(64)
  id: string;

  @Field(() => String)
  @IsString()
  @MaxLength(500)
  text: string;

  @Field(() => Boolean)
  @IsBoolean()
  done: boolean;
}

@InputType('TaskPipelineChecklistPointInput')
export class TaskPipelineChecklistPointInput {
  @Field(() => String)
  @IsString()
  @MaxLength(64)
  id: string;

  @Field(() => String)
  @IsString()
  @MaxLength(1000)
  text: string;

  @Field(() => Boolean)
  @IsBoolean()
  done: boolean;

  @Field(() => UUIDScalarType, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeWorkspaceMemberId?: string | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  dueAt?: Date | null;
}

@InputType('TaskPipelineChecklistInput')
export class TaskPipelineChecklistInput {
  @Field(() => String)
  @IsString()
  @MaxLength(64)
  id: string;

  @Field(() => String)
  @IsString()
  @MaxLength(200)
  title: string;

  @Field(() => [TaskPipelineChecklistPointInput])
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TaskPipelineChecklistPointInput)
  items: TaskPipelineChecklistPointInput[];
}

@InputType('TaskPipelineTaskRelatedRecordInput')
export class TaskPipelineTaskRelatedRecordInput {
  @Field(() => String)
  @IsIn(['person', 'company', 'opportunity'])
  objectNameSingular: string;

  @Field(() => String)
  @IsUUID()
  recordId: string;

  @Field(() => String)
  @IsString()
  @MaxLength(200)
  label: string;
}

@InputType('CreateTaskPipelineTaskInput')
export class CreateTaskPipelineTaskInput {
  @Field(() => UUIDScalarType)
  @IsUUID()
  pipelineId: string;

  @Field(() => UUIDScalarType, { nullable: true })
  @IsOptional()
  @IsUUID()
  stageId?: string | null;

  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string | null;

  @Field(() => UUIDScalarType, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeWorkspaceMemberId?: string | null;

  @Field(() => [UUIDScalarType], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  memberWorkspaceMemberIds?: string[] | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  startAt?: Date | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  dueAt?: Date | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string | null;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  labels?: string[] | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(['MANUAL', 'EMAIL'])
  source?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  sourceLink?: string | null;

  @Field(() => [TaskPipelineTaskRelatedRecordInput], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaskPipelineTaskRelatedRecordInput)
  relatedRecords?: TaskPipelineTaskRelatedRecordInput[] | null;
}

@InputType('UpdateTaskPipelineTaskInput')
export class UpdateTaskPipelineTaskInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string | null;

  // Para desasignar mandar clearAssignee=true (null significa "no tocar").
  @Field(() => UUIDScalarType, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeWorkspaceMemberId?: string | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  clearAssignee?: boolean | null;

  // Lista completa de miembros de la tarjeta (reemplaza la anterior).
  @Field(() => [UUIDScalarType], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  memberWorkspaceMemberIds?: string[] | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  startAt?: Date | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  clearStartAt?: boolean | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  dueAt?: Date | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  clearDueAt?: boolean | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn([...TASK_PRIORITIES, 'NONE'])
  priority?: string | null;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  labels?: string[] | null;

  @Field(() => [TaskPipelineTaskChecklistItemInput], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TaskPipelineTaskChecklistItemInput)
  checklist?: TaskPipelineTaskChecklistItemInput[] | null;

  // Lista completa de checklists (reemplaza la anterior).
  @Field(() => [TaskPipelineChecklistInput], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TaskPipelineChecklistInput)
  checklists?: TaskPipelineChecklistInput[] | null;

  @Field(() => UUIDScalarType, { nullable: true })
  @IsOptional()
  @IsUUID()
  coverAttachmentId?: string | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  clearCover?: boolean | null;

  @Field(() => [TaskPipelineTaskRelatedRecordInput], { nullable: true })
  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaskPipelineTaskRelatedRecordInput)
  relatedRecords?: TaskPipelineTaskRelatedRecordInput[] | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  sourceLink?: string | null;
}

@InputType('MoveTaskPipelineTaskInput')
export class MoveTaskPipelineTaskInput {
  @Field(() => UUIDScalarType)
  @IsUUID()
  taskId: string;

  @Field(() => UUIDScalarType)
  @IsUUID()
  stageId: string;

  // Posición destino; si falta va al final de la columna.
  @Field(() => Float, { nullable: true })
  @IsOptional()
  position?: number | null;
}
