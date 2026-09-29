import { InjectDataSource } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ensureTaskPipelineTables } from 'src/database/commands/upgrade-version-command/2-34/utils/ensure-task-pipeline-tables.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// PTS AI (29-sep-2026): columnas de tarjetas tipo Trello (miembros, checklists
// por persona, inicio, portada), adjuntos y estado de action points. Mismo DDL
// idempotente que 1787471738700; hace falta un comando NUEVO porque producción
// ya ejecutó aquel y no lo repite.
@RegisteredWorkspaceCommand('2.34.0', 1787471738800)
@Command({
  name: 'upgrade:2-34:ensure-task-pipeline-trello-columns',
  description: 'Add the PTS AI Trello-like task columns, attachments and meeting action points',
})
export class EnsureTaskPipelineTrelloColumnsCommand extends ProvisionedWorkspaceCommandRunner {
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
