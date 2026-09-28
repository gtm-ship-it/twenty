import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

export type FathomConnectionStatus = 'ACTIVE' | 'ERROR';

// Una cuenta de Fathom conectada a un tablero. La llave y el secreto del webhook
// se guardan cifrados (enc:v2) y nunca salen del servidor.
@Entity({ name: 'fathomConnection', schema: 'core' })
@Index('IDX_FATHOM_CONNECTION_PIPELINE', ['pipelineId'])
export class FathomConnectionEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  pipelineId: string;

  @Column({ type: 'varchar', nullable: false })
  label: string;

  @Column({ type: 'text', nullable: false })
  apiKeyEncrypted: string;

  // Últimos caracteres de la llave, para reconocerla en la UI sin exponerla.
  @Column({ type: 'varchar', nullable: false, default: '' })
  apiKeyHint: string;

  @Column({ type: 'varchar', nullable: true })
  fathomWebhookId: string | null;

  @Column({ type: 'text', nullable: true })
  webhookSecretEncrypted: string | null;

  @Column({ type: 'varchar', nullable: true })
  fathomUserEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  fathomUserName: string | null;

  @Column({ type: 'uuid', nullable: true })
  connectedByWorkspaceMemberId: string | null;

  @Column({ type: 'varchar', nullable: false, default: 'ACTIVE' })
  status: FathomConnectionStatus;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMeetingAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
