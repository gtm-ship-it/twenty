import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

// ATTACHMENT = adjunto de la tarjeta · CHECKLIST_ITEM = foto de un paso de la
// checklist · INLINE = imagen pegada en la descripción o en un comentario.
export type TaskPipelineAttachmentPurpose =
  | 'ATTACHMENT'
  | 'CHECKLIST_ITEM'
  | 'INLINE';

@Entity({ name: 'taskPipelineTaskAttachment', schema: 'core' })
@Index('IDX_TASK_PIPELINE_TASK_ATTACHMENT_TASK', ['taskId'])
export class TaskPipelineTaskAttachmentEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  taskId: string;

  // Fila de core.file (almacenamiento de Twenty).
  @Column({ type: 'uuid', nullable: false })
  fileId: string;

  @Column({ type: 'varchar', nullable: false })
  fileFolder: string;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  size: string | null;

  @Column({ type: 'varchar', nullable: false, default: 'ATTACHMENT' })
  purpose: TaskPipelineAttachmentPurpose;

  @Column({ type: 'varchar', nullable: true })
  checklistItemId: string | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedByWorkspaceMemberId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
