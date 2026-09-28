import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';
import { ensureTaskPipelineTables } from 'src/database/commands/upgrade-version-command/2-34/utils/ensure-task-pipeline-tables.util';

// PTS AI: tableros de tareas (pipelines con stages propios, miembros con rol,
// comentarios) + reuniones de Fathom y sus accionables. Todas las tablas viven
// en "core" (no en el esquema del workspace), así la API genérica no las expone
// y el acceso pasa solo por los resolvers con guard de membresía.
// Idempotente (IF NOT EXISTS) para poder re-ejecutar el upgrade sin riesgo.
@RegisteredInstanceCommand('2.34.0', 1787471608500)
export class AddTaskPipelinesAndMeetingsFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureTaskPipelineTables(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'meetingActionItem',
      'fathomConnection',
      'taskPipelineTaskComment',
      'taskPipelineTask',
      'meeting',
      'taskPipelineStage',
      'taskPipelineMember',
      'taskPipeline',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "core"."${table}"`);
    }
  }
}
