import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

// Un accionable de una reunión, visto desde UN tablero (la misma reunión
// puede alimentar varios tableros si está conectada a varias cuentas).
@Entity({ name: 'meetingActionItem', schema: 'core' })
@Index('IDX_MEETING_ACTION_ITEM_MEETING', ['meetingId'])
@Index(
  'IDX_MEETING_ACTION_ITEM_PIPELINE_KEY_UNIQUE',
  ['pipelineId', 'externalKey'],
  {
    unique: true,
  },
)
export class MeetingActionItemEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  meetingId: string;

  @Column({ type: 'uuid', nullable: false })
  pipelineId: string;

  @Column({ type: 'uuid', nullable: true })
  connectionId: string | null;

  @Column({ type: 'varchar', nullable: false })
  externalKey: string;

  @Column({ type: 'text', nullable: false })
  textEn: string;

  @Column({ type: 'text', nullable: true })
  textEs: string | null;

  @Column({ type: 'varchar', nullable: true })
  assigneeName: string | null;

  @Column({ type: 'varchar', nullable: true })
  assigneeEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  recordingTimestamp: string | null;

  @Column({ type: 'text', nullable: true })
  playbackUrl: string | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  completed: boolean;

  @Column({ type: 'uuid', nullable: true })
  resolvedWorkspaceMemberId: string | null;

  // Cómo se resolvió el asignado (EMAIL, NAME, ALIAS, INVITEE, SPEAKER, NONE).
  @Column({ type: 'varchar', nullable: true })
  resolution: string | null;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  // Punto de la checklist de la tarjeta donde quedó este action point.
  @Column({ type: 'varchar', nullable: true })
  checklistItemId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
