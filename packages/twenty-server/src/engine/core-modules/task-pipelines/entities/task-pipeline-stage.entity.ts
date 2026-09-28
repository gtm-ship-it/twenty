import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'taskPipelineStage', schema: 'core' })
@Index('IDX_TASK_PIPELINE_STAGE_PIPELINE', ['pipelineId'])
export class TaskPipelineStageEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  pipelineId: string;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: false, default: 'gray' })
  color: string;

  @Column({ type: 'double precision', nullable: false, default: 0 })
  position: number;

  // Mover una tarea a un stage "done" la marca completada.
  @Column({ type: 'boolean', nullable: false, default: false })
  isDone: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
