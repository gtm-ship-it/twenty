import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { type FathomActionItem } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

export type MeetingParticipant = {
  name: string | null;
  email: string | null;
  isExternal: boolean;
};

export type MeetingActionPointsStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'DONE'
  | 'FAILED';

// Estado de los action points de la reunión EN UN tablero. Se generan una sola
// vez: en DONE ya no se vuelven a crear.
export type MeetingActionPointsState = {
  status: MeetingActionPointsStatus;
  trigger: 'AUTO' | 'MANUAL';
  requestedByWorkspaceMemberId: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  engine: 'AI' | 'SUMMARY' | null;
  error: string | null;
  taskIds: string[];
};

export type MeetingTranscriptLine = {
  speakerName: string | null;
  speakerEmail: string | null;
  timestamp: string; // "HH:MM:SS"
  text: string;
};

@Entity({ name: 'meeting', schema: 'core' })
@Unique('IDX_MEETING_WORKSPACE_RECORDING_UNIQUE', [
  'workspaceId',
  'recordingId',
])
export class MeetingEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false })
  recordingId: string;

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'text', nullable: true })
  shareUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'jsonb', nullable: false, default: [] })
  participants: MeetingParticipant[];

  @Column({ type: 'jsonb', nullable: true })
  recordedBy: { name: string | null; email: string | null } | null;

  @Column({ type: 'text', nullable: true })
  summaryMarkdown: string | null;

  @Column({ type: 'text', nullable: true })
  summaryMarkdownEs: string | null;

  @Column({ type: 'jsonb', nullable: false, default: [] })
  transcript: MeetingTranscriptLine[];

  // Tableros que recibieron esta reunión (vía sus conexiones de Fathom). Solo
  // los miembros de alguno de ellos la ven.
  @Column({ type: 'jsonb', nullable: false, default: [] })
  pipelineIds: string[];

  @Column({ type: 'jsonb', nullable: false, default: {} })
  actionPoints: Record<string, MeetingActionPointsState>;

  // Accionables tal como los mandó Fathom (a veces vacío): la IA los usa de pista.
  @Column({ type: 'jsonb', nullable: false, default: [] })
  fathomActionItems: FathomActionItem[];

  // Idioma en que se tradujo (null = pendiente de traducir).
  @Column({ type: 'varchar', nullable: true })
  translatedTo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
