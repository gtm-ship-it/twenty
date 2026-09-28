import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceDomainsModule } from 'src/engine/core-modules/domain/workspace-domains/workspace-domains.module';
import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { FathomWebhookController } from 'src/engine/core-modules/task-pipelines/controllers/fathom-webhook.controller';
import { MeetingVideoController } from 'src/engine/core-modules/task-pipelines/controllers/meeting-video.controller';
import { FathomConnectionEntity } from 'src/engine/core-modules/task-pipelines/entities/fathom-connection.entity';
import { MeetingActionItemEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting-action-item.entity';
import { MeetingEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting.entity';
import { TaskPipelineMemberEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-member.entity';
import { TaskPipelineStageEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-stage.entity';
import { TaskPipelineTaskCommentEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task-comment.entity';
import { TaskPipelineTaskEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task.entity';
import { TaskPipelineEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline.entity';
import { FathomApiClientService } from 'src/engine/core-modules/task-pipelines/fathom/fathom-api-client.service';
import { FathomConnectionsService } from 'src/engine/core-modules/task-pipelines/fathom/fathom-connections.service';
import { FathomIngestionService } from 'src/engine/core-modules/task-pipelines/fathom/fathom-ingestion.service';
import { TaskPipelinesResolver } from 'src/engine/core-modules/task-pipelines/resolvers/task-pipelines.resolver';
import { LibreTranslateService } from 'src/engine/core-modules/task-pipelines/services/libre-translate.service';
import { MeetingVideoTokenService } from 'src/engine/core-modules/task-pipelines/services/meeting-video-token.service';
import { MeetingsService } from 'src/engine/core-modules/task-pipelines/services/meetings.service';
import { TaskPipelineAccessService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-access.service';
import { TaskPipelineNotificationService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-notification.service';
import { TaskPipelineWorkspaceMembersService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-workspace-members.service';
import { TaskPipelinesService } from 'src/engine/core-modules/task-pipelines/services/task-pipelines.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';

const TASK_PIPELINE_ENTITIES = [
  TaskPipelineEntity,
  TaskPipelineMemberEntity,
  TaskPipelineStageEntity,
  TaskPipelineTaskEntity,
  TaskPipelineTaskCommentEntity,
  FathomConnectionEntity,
  MeetingEntity,
  MeetingActionItemEntity,
];

// PTS AI: tableros de tareas (pipelines con stages y miembros propios) +
// reuniones de Fathom que se convierten en tareas asignadas. Tablas en "core",
// acceso solo por estos resolvers (guard de membresía por tablero).
@Module({
  imports: [
    TypeOrmModule.forFeature([...TASK_PIPELINE_ENTITIES, WorkspaceEntity]),
    PermissionsModule,
    SecretEncryptionModule,
    WorkspaceDomainsModule,
  ],
  controllers: [FathomWebhookController, MeetingVideoController],
  providers: [
    ...TASK_PIPELINE_ENTITIES.map((entity) => provideWorkspaceScopedRepository(entity)),
    TaskPipelinesResolver,
    TaskPipelinesService,
    TaskPipelineAccessService,
    TaskPipelineWorkspaceMembersService,
    TaskPipelineNotificationService,
    LibreTranslateService,
    FathomApiClientService,
    FathomIngestionService,
    FathomConnectionsService,
    MeetingsService,
    MeetingVideoTokenService,
  ],
  exports: [TaskPipelinesService],
})
export class TaskPipelinesModule {}
