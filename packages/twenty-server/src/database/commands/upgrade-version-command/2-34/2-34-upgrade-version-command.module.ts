import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { AddMessageBodyHtmlFieldCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787471608400-add-message-body-html-field.command';
import { AddTimelineActivityTypeSnapshotCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787471608319-add-timeline-activity-type-snapshot.command';
import { ConfigureTimelineActivityRoutingCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787471608317-configure-timeline-activity-routing.command';
import { ConfigureStandardTimelineRenderersCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787471608318-configure-standard-timeline-renderers.command';
import { EnsureTaskPipelineTablesCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787471738700-ensure-task-pipeline-tables.command';
import { EnsureTaskPipelineTrelloColumnsCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787471738800-ensure-task-pipeline-trello-columns.command';
import { AddAttachmentTimelineActivityTypesCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787471738599-add-attachment-timeline-activity-types.command';
import { RepairActivityTargetsJunctionTargetCommand } from 'src/database/commands/upgrade-version-command/2-34/2-34-workspace-command-1787461587487-repair-activity-targets-junction-target.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceMigrationRunnerModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/workspace-migration-runner.module';
import { WorkspaceMigrationModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration.module';

@Module({
  imports: [
    ApplicationModule,
    TypeOrmModule.forFeature([FieldMetadataEntity]),
    WorkspaceCacheModule,
    WorkspaceIteratorModule,
    WorkspaceMigrationRunnerModule,
    WorkspaceMigrationModule,
  ],
  providers: [
    AddMessageBodyHtmlFieldCommand,
    AddTimelineActivityTypeSnapshotCommand,
    ConfigureTimelineActivityRoutingCommand,
    ConfigureStandardTimelineRenderersCommand,
    AddAttachmentTimelineActivityTypesCommand,
    RepairActivityTargetsJunctionTargetCommand,
    EnsureTaskPipelineTablesCommand,
    EnsureTaskPipelineTrelloColumnsCommand,
  ],
})
export class V2_34_UpgradeVersionCommandModule {}
