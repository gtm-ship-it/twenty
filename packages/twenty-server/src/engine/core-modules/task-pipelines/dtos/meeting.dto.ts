import { Field, Int, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('MeetingParticipant')
export class MeetingParticipantDTO {
  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => String, { nullable: true })
  email: string | null;

  @Field(() => Boolean)
  isExternal: boolean;
}

@ObjectType('MeetingTranscriptLine')
export class MeetingTranscriptLineDTO {
  @Field(() => String, { nullable: true })
  speakerName: string | null;

  @Field(() => String, { nullable: true })
  speakerEmail: string | null;

  @Field(() => String)
  timestamp: string;

  @Field(() => String)
  text: string;
}

@ObjectType('MeetingActionItem')
export class MeetingActionItemDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => UUIDScalarType)
  pipelineId: string;

  @Field(() => String)
  pipelineName: string;

  @Field(() => String)
  textEn: string;

  @Field(() => String, { nullable: true })
  textEs: string | null;

  @Field(() => String, { nullable: true })
  assigneeName: string | null;

  @Field(() => String, { nullable: true })
  assigneeEmail: string | null;

  @Field(() => String, { nullable: true })
  recordingTimestamp: string | null;

  @Field(() => String, { nullable: true })
  playbackUrl: string | null;

  @Field(() => Boolean)
  completed: boolean;

  @Field(() => UUIDScalarType, { nullable: true })
  resolvedWorkspaceMemberId: string | null;

  @Field(() => String, { nullable: true })
  resolution: string | null;

  @Field(() => UUIDScalarType, { nullable: true })
  taskId: string | null;

  @Field(() => UUIDScalarType, { nullable: true })
  taskStageId: string | null;

  @Field(() => Boolean)
  taskIsDone: boolean;

  @Field(() => String, { nullable: true })
  checklistItemId: string | null;

  // El punto de la checklist ya se marcó como hecho.
  @Field(() => Boolean)
  pointIsDone: boolean;
}

// Estado de los action points de la reunión en UN tablero.
@ObjectType('MeetingActionPointsState')
export class MeetingActionPointsStateDTO {
  @Field(() => UUIDScalarType)
  pipelineId: string;

  @Field(() => String)
  pipelineName: string;

  // NONE | PENDING | GENERATING | DONE | FAILED
  @Field(() => String)
  status: string;

  @Field(() => String, { nullable: true })
  trigger: string | null;

  @Field(() => String, { nullable: true })
  engine: string | null;

  @Field(() => String, { nullable: true })
  error: string | null;

  @Field(() => Date, { nullable: true })
  requestedAt: Date | null;

  @Field(() => Date, { nullable: true })
  finishedAt: Date | null;

  @Field(() => [UUIDScalarType])
  taskIds: string[];
}

@ObjectType('MeetingListItem')
export class MeetingListItemDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => Date, { nullable: true })
  startedAt: Date | null;

  @Field(() => Date, { nullable: true })
  endedAt: Date | null;

  @Field(() => Int)
  participantCount: number;

  @Field(() => Int)
  actionItemCount: number;

  @Field(() => [String])
  pipelineNames: string[];

  @Field(() => String, { nullable: true })
  recordedByName: string | null;

  // Resumen de todos mis tableros: DONE si ya se generaron en alguno,
  // GENERATING si están en cola, FAILED, o NONE.
  @Field(() => String)
  actionPointsStatus: string;
}

@ObjectType('MeetingDetail')
export class MeetingDetailDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  recordingId: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  url: string | null;

  @Field(() => String, { nullable: true })
  shareUrl: string | null;

  // Stream HLS de la grabación compartida (si Fathom lo expone) para verlo dentro del CRM.
  @Field(() => String, { nullable: true })
  videoUrl: string | null;

  @Field(() => Date, { nullable: true })
  startedAt: Date | null;

  @Field(() => Date, { nullable: true })
  endedAt: Date | null;

  @Field(() => [MeetingParticipantDTO])
  participants: MeetingParticipantDTO[];

  @Field(() => String, { nullable: true })
  recordedByName: string | null;

  @Field(() => String, { nullable: true })
  recordedByEmail: string | null;

  @Field(() => String, { nullable: true })
  summaryMarkdown: string | null;

  @Field(() => String, { nullable: true })
  summaryMarkdownEs: string | null;

  @Field(() => [MeetingTranscriptLineDTO])
  transcript: MeetingTranscriptLineDTO[];

  @Field(() => [MeetingActionItemDTO])
  actionItems: MeetingActionItemDTO[];

  @Field(() => [MeetingActionPointsStateDTO])
  actionPoints: MeetingActionPointsStateDTO[];
}

@ObjectType('FathomSyncResult')
export class FathomSyncResultDTO {
  @Field(() => Int)
  meetingsProcessed: number;

  @Field(() => Int)
  tasksCreated: number;

  @Field(() => Int)
  actionItemsSeen: number;

  @Field(() => String, { nullable: true })
  error: string | null;
}
