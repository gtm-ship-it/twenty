import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

export type TaskPipelineTaskCommentKind = 'COMMENT' | 'ACTIVITY';

// Comentarios y bitácora de la tarea. ACTIVITY = eventos automáticos
// ("movida a En curso", "asignada a Mateo") para tener el historial completo.
@Entity({ name: 'taskPipelineTaskComment', schema: 'core' })
@Index('IDX_TASK_PIPELINE_TASK_COMMENT_TASK', ['taskId'])
export class TaskPipelineTaskCommentEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  taskId: string;

  @Column({ type: 'uuid', nullable: true })
  authorWorkspaceMemberId: string | null;

  @Column({ type: 'varchar', nullable: false, default: 'COMMENT' })
  kind: TaskPipelineTaskCommentKind;

  @Column({ type: 'text', nullable: false })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
