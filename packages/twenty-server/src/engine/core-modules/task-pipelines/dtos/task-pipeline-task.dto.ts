import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('TaskPipelineTaskChecklistItem')
export class TaskPipelineTaskChecklistItemDTO {
  @Field(() => String)
  id: string;

  @Field(() => String)
  text: string;

  @Field(() => Boolean)
  done: boolean;
}

@ObjectType('TaskPipelineTaskRelatedRecord')
export class TaskPipelineTaskRelatedRecordDTO {
  @Field(() => String)
  objectNameSingular: string;

  @Field(() => String)
  recordId: string;

  @Field(() => String)
  label: string;
}

@ObjectType('TaskPipelineTaskMeetingRef')
export class TaskPipelineTaskMeetingRefDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => Date, { nullable: true })
  startedAt: Date | null;
}

@ObjectType('TaskPipelineTask')
export class TaskPipelineTaskDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => UUIDScalarType)
  pipelineId: string;

  @Field(() => String)
  pipelineName: string;

  @Field(() => UUIDScalarType)
  stageId: string;

  @Field(() => Float)
  position: number;

  @Field(() => String)
  title: string;

  @Field(() => String)
  body: string;

  @Field(() => UUIDScalarType, { nullable: true })
  assigneeWorkspaceMemberId: string | null;

  @Field(() => Date, { nullable: true })
  dueAt: Date | null;

  @Field(() => String, { nullable: true })
  priority: string | null;

  @Field(() => [String])
  labels: string[];

  @Field(() => [TaskPipelineTaskChecklistItemDTO])
  checklist: TaskPipelineTaskChecklistItemDTO[];

  @Field(() => [TaskPipelineTaskRelatedRecordDTO])
  relatedRecords: TaskPipelineTaskRelatedRecordDTO[];

  @Field(() => String)
  source: string;

  @Field(() => String, { nullable: true })
  sourceLink: string | null;

  @Field(() => TaskPipelineTaskMeetingRefDTO, { nullable: true })
  meeting: TaskPipelineTaskMeetingRefDTO | null;

  @Field(() => String, { nullable: true })
  originalText: string | null;

  @Field(() => Boolean)
  needsAssignment: boolean;

  @Field(() => UUIDScalarType, { nullable: true })
  createdByWorkspaceMemberId: string | null;

  @Field(() => Date, { nullable: true })
  completedAt: Date | null;

  @Field(() => Date, { nullable: true })
  archivedAt: Date | null;

  @Field(() => Int)
  commentCount: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType('TaskPipelineTaskComment')
export class TaskPipelineTaskCommentDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => UUIDScalarType)
  taskId: string;

  @Field(() => UUIDScalarType, { nullable: true })
  authorWorkspaceMemberId: string | null;

  @Field(() => String)
  kind: string;

  @Field(() => String)
  body: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
