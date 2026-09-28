import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

export type TaskPipelineTaskSource = 'MANUAL' | 'EMAIL' | 'FATHOM';
export type TaskPipelineTaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TaskPipelineTaskChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type TaskPipelineTaskRelatedRecord = {
  objectNameSingular: string;
  recordId: string;
  label: string;
};

@Entity({ name: 'taskPipelineTask', schema: 'core' })
@Index('IDX_TASK_PIPELINE_TASK_PIPELINE_STAGE', ['pipelineId', 'stageId'])
@Index('IDX_TASK_PIPELINE_TASK_ASSIGNEE', ['workspaceId', 'assigneeWorkspaceMemberId'])
// Dedupe de accionables de Fathom: un mismo accionable no crea dos tareas en el mismo tablero.
@Index('IDX_TASK_PIPELINE_TASK_EXTERNAL_KEY_UNIQUE', ['pipelineId', 'externalKey'], {
  unique: true,
  where: '"externalKey" IS NOT NULL',
})
export class TaskPipelineTaskEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  pipelineId: string;

  @Column({ type: 'uuid', nullable: false })
  stageId: string;

  @Column({ type: 'double precision', nullable: false, default: 0 })
  position: number;

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false, default: '' })
  body: string;

  @Column({ type: 'uuid', nullable: true })
  assigneeWorkspaceMemberId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  priority: TaskPipelineTaskPriority | null;

  @Column({ type: 'jsonb', nullable: false, default: [] })
  labels: string[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  checklist: TaskPipelineTaskChecklistItem[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  relatedRecords: TaskPipelineTaskRelatedRecord[];

  @Column({ type: 'varchar', nullable: false, default: 'MANUAL' })
  source: TaskPipelineTaskSource;

  @Column({ type: 'text', nullable: true })
  sourceLink: string | null;

  @Column({ type: 'uuid', nullable: true })
  meetingId: string | null;

  @Column({ type: 'varchar', nullable: true })
  externalKey: string | null;

  // Texto original (p. ej. el accionable de Fathom en inglés).
  @Column({ type: 'text', nullable: true })
  originalText: string | null;

  // Si Fathom no pudo resolver a nadie del tablero, la tarea queda "por asignar".
  @Column({ type: 'boolean', nullable: false, default: false })
  needsAssignment: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdByWorkspaceMemberId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
