import { InjectDataSource } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ensureTaskPipelineTables } from 'src/database/commands/upgrade-version-command/2-34/utils/ensure-task-pipeline-tables.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// PTS AI: crea las tablas de Tasks + Reuniones en instancias que ya estaban en
// 2.34 (ver ensure-task-pipeline-tables.util.ts). La primera pasada crea todo;
// las siguientes (un workspace más) no hacen nada.
@RegisteredWorkspaceCommand('2.34.0', 1787471738700)
@Command({
  name: 'upgrade:2-34:ensure-task-pipeline-tables',
  description: 'Create the PTS AI task pipeline and meeting tables if they do not exist',
})
export class EnsureTaskPipelineTablesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs): Promise<void> {
    if (options.dryRun) {
      this.logger.log(`[dry-run] would ensure task pipeline tables (workspace ${workspaceId})`);

      return;
    }

    await ensureTaskPipelineTables(this.coreDataSource);
    this.logger.log(`Task pipeline tables ensured (workspace ${workspaceId})`);
  }
}
