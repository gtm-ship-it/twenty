import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

export type TaskPipelineVisibility = 'WORKSPACE' | 'PERSONAL';

// Un tablero de tareas. WORKSPACE = lo crea un admin del workspace y se comparte
// con los miembros que él agregue; PERSONAL = privado de su dueño (ni los admins
// del workspace lo ven), salvo que el dueño invite a alguien.
@Entity({ name: 'taskPipeline', schema: 'core' })
@Index('IDX_TASK_PIPELINE_WORKSPACE_ID', ['workspaceId'])
export class TaskPipelineEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: false, default: 'blue' })
  color: string;

  @Column({ type: 'varchar', nullable: false })
  visibility: TaskPipelineVisibility;

  @Column({ type: 'uuid', nullable: false })
  ownerWorkspaceMemberId: string;

  // Etiquetas disponibles en el tablero: [{ name, color }]
  @Column({ type: 'jsonb', nullable: false, default: [] })
  labels: { name: string; color: string }[];

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
