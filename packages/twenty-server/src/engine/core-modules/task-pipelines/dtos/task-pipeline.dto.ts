import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('TaskPipelineLabel')
export class TaskPipelineLabelDTO {
  @Field(() => String)
  name: string;

  @Field(() => String)
  color: string;
}

@ObjectType('TaskPipelineStage')
export class TaskPipelineStageDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  color: string;

  @Field(() => Float)
  position: number;

  @Field(() => Boolean)
  isDone: boolean;
}

@ObjectType('TaskPipelineMember')
export class TaskPipelineMemberDTO {
  @Field(() => UUIDScalarType)
  workspaceMemberId: string;

  @Field(() => String)
  role: string;

  @Field(() => [String])
  aliases: string[];
}

@ObjectType('TaskPipelineFathomConnection')
export class TaskPipelineFathomConnectionDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  label: string;

  @Field(() => String)
  apiKeyHint: string;

  @Field(() => String, { nullable: true })
  fathomUserEmail: string | null;

  @Field(() => String)
  status: string;

  @Field(() => String, { nullable: true })
  lastError: string | null;

  @Field(() => Date, { nullable: true })
  lastSyncAt: Date | null;

  @Field(() => Date, { nullable: true })
  lastMeetingAt: Date | null;

  @Field(() => Boolean)
  hasWebhook: boolean;

  @Field(() => UUIDScalarType, { nullable: true })
  connectedByWorkspaceMemberId: string | null;
}

@ObjectType('TaskPipeline')
export class TaskPipelineDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  color: string;

  @Field(() => String)
  visibility: string;

  @Field(() => UUIDScalarType)
  ownerWorkspaceMemberId: string;

  @Field(() => String)
  myRole: string;

  @Field(() => [TaskPipelineStageDTO])
  stages: TaskPipelineStageDTO[];

  @Field(() => [TaskPipelineMemberDTO])
  members: TaskPipelineMemberDTO[];

  @Field(() => [TaskPipelineLabelDTO])
  labels: TaskPipelineLabelDTO[];

  // Solo se rellena para admins del tablero.
  @Field(() => [TaskPipelineFathomConnectionDTO])
  fathomConnections: TaskPipelineFathomConnectionDTO[];

  @Field(() => Int)
  openTaskCount: number;

  @Field(() => Date)
  createdAt: Date;
}
