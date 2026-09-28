import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

export type TaskPipelineMemberRole = 'ADMIN' | 'MEMBER';

@Entity({ name: 'taskPipelineMember', schema: 'core' })
@Unique('IDX_TASK_PIPELINE_MEMBER_PIPELINE_MEMBER_UNIQUE', [
  'pipelineId',
  'workspaceMemberId',
])
@Index('IDX_TASK_PIPELINE_MEMBER_WORKSPACE_MEMBER', [
  'workspaceId',
  'workspaceMemberId',
])
export class TaskPipelineMemberEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  pipelineId: string;

  @Column({ type: 'uuid', nullable: false })
  workspaceMemberId: string;

  @Column({ type: 'varchar', nullable: false, default: 'MEMBER' })
  role: TaskPipelineMemberRole;

  // Otros nombres/correos con los que aparece esta persona en las reuniones
  // (Fathom confunde hablantes: "Jason", "Jay", "Yeye"…). Se usan para asignar.
  @Column({ type: 'jsonb', nullable: false, default: [] })
  aliases: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
