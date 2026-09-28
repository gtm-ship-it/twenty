import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

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
    const workspaceFk = (table: string) =>
      `ALTER TABLE "core"."${table}" ADD CONSTRAINT "FK_${table}_workspace" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION`;

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."taskPipeline" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "color" character varying NOT NULL DEFAULT 'blue',
      "visibility" character varying NOT NULL,
      "ownerWorkspaceMemberId" uuid NOT NULL,
      "labels" jsonb NOT NULL DEFAULT '[]',
      "archivedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_taskPipeline" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_TASK_PIPELINE_WORKSPACE_ID" ON "core"."taskPipeline" ("workspaceId")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."taskPipelineMember" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "pipelineId" uuid NOT NULL,
      "workspaceMemberId" uuid NOT NULL,
      "role" character varying NOT NULL DEFAULT 'MEMBER',
      "aliases" jsonb NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "IDX_TASK_PIPELINE_MEMBER_PIPELINE_MEMBER_UNIQUE" UNIQUE ("pipelineId", "workspaceMemberId"),
      CONSTRAINT "PK_taskPipelineMember" PRIMARY KEY ("id"),
      CONSTRAINT "FK_taskPipelineMember_pipeline" FOREIGN KEY ("pipelineId") REFERENCES "core"."taskPipeline"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_TASK_PIPELINE_MEMBER_WORKSPACE_MEMBER" ON "core"."taskPipelineMember" ("workspaceId", "workspaceMemberId")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."taskPipelineStage" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "pipelineId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "color" character varying NOT NULL DEFAULT 'gray',
      "position" double precision NOT NULL DEFAULT 0,
      "isDone" boolean NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_taskPipelineStage" PRIMARY KEY ("id"),
      CONSTRAINT "FK_taskPipelineStage_pipeline" FOREIGN KEY ("pipelineId") REFERENCES "core"."taskPipeline"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_TASK_PIPELINE_STAGE_PIPELINE" ON "core"."taskPipelineStage" ("pipelineId")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."meeting" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "recordingId" character varying NOT NULL,
      "title" character varying NOT NULL,
      "url" text,
      "shareUrl" text,
      "startedAt" TIMESTAMP WITH TIME ZONE,
      "endedAt" TIMESTAMP WITH TIME ZONE,
      "participants" jsonb NOT NULL DEFAULT '[]',
      "recordedBy" jsonb,
      "summaryMarkdown" text,
      "summaryMarkdownEs" text,
      "transcript" jsonb NOT NULL DEFAULT '[]',
      "pipelineIds" jsonb NOT NULL DEFAULT '[]',
      "translatedTo" character varying,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "IDX_MEETING_WORKSPACE_RECORDING_UNIQUE" UNIQUE ("workspaceId", "recordingId"),
      CONSTRAINT "PK_meeting" PRIMARY KEY ("id"))`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."taskPipelineTask" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "pipelineId" uuid NOT NULL,
      "stageId" uuid NOT NULL,
      "position" double precision NOT NULL DEFAULT 0,
      "title" character varying NOT NULL,
      "body" text NOT NULL DEFAULT '',
      "assigneeWorkspaceMemberId" uuid,
      "dueAt" TIMESTAMP WITH TIME ZONE,
      "priority" character varying,
      "labels" jsonb NOT NULL DEFAULT '[]',
      "checklist" jsonb NOT NULL DEFAULT '[]',
      "relatedRecords" jsonb NOT NULL DEFAULT '[]',
      "source" character varying NOT NULL DEFAULT 'MANUAL',
      "sourceLink" text,
      "meetingId" uuid,
      "externalKey" character varying,
      "originalText" text,
      "needsAssignment" boolean NOT NULL DEFAULT false,
      "createdByWorkspaceMemberId" uuid,
      "completedAt" TIMESTAMP WITH TIME ZONE,
      "archivedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_taskPipelineTask" PRIMARY KEY ("id"),
      CONSTRAINT "FK_taskPipelineTask_pipeline" FOREIGN KEY ("pipelineId") REFERENCES "core"."taskPipeline"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_taskPipelineTask_stage" FOREIGN KEY ("stageId") REFERENCES "core"."taskPipelineStage"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_taskPipelineTask_meeting" FOREIGN KEY ("meetingId") REFERENCES "core"."meeting"("id") ON DELETE SET NULL)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_TASK_PIPELINE_TASK_PIPELINE_STAGE" ON "core"."taskPipelineTask" ("pipelineId", "stageId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_TASK_PIPELINE_TASK_ASSIGNEE" ON "core"."taskPipelineTask" ("workspaceId", "assigneeWorkspaceMemberId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TASK_PIPELINE_TASK_EXTERNAL_KEY_UNIQUE" ON "core"."taskPipelineTask" ("pipelineId", "externalKey") WHERE "externalKey" IS NOT NULL`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."taskPipelineTaskComment" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "taskId" uuid NOT NULL,
      "authorWorkspaceMemberId" uuid,
      "kind" character varying NOT NULL DEFAULT 'COMMENT',
      "body" text NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_taskPipelineTaskComment" PRIMARY KEY ("id"),
      CONSTRAINT "FK_taskPipelineTaskComment_task" FOREIGN KEY ("taskId") REFERENCES "core"."taskPipelineTask"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_TASK_PIPELINE_TASK_COMMENT_TASK" ON "core"."taskPipelineTaskComment" ("taskId")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."fathomConnection" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "pipelineId" uuid NOT NULL,
      "label" character varying NOT NULL,
      "apiKeyEncrypted" text NOT NULL,
      "apiKeyHint" character varying NOT NULL DEFAULT '',
      "fathomWebhookId" character varying,
      "webhookSecretEncrypted" text,
      "fathomUserEmail" character varying,
      "fathomUserName" character varying,
      "connectedByWorkspaceMemberId" uuid,
      "status" character varying NOT NULL DEFAULT 'ACTIVE',
      "lastError" text,
      "lastSyncAt" TIMESTAMP WITH TIME ZONE,
      "lastMeetingAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fathomConnection" PRIMARY KEY ("id"),
      CONSTRAINT "FK_fathomConnection_pipeline" FOREIGN KEY ("pipelineId") REFERENCES "core"."taskPipeline"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_FATHOM_CONNECTION_PIPELINE" ON "core"."fathomConnection" ("pipelineId")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "core"."meetingActionItem" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "workspaceId" uuid NOT NULL,
      "meetingId" uuid NOT NULL,
      "pipelineId" uuid NOT NULL,
      "connectionId" uuid,
      "externalKey" character varying NOT NULL,
      "textEn" text NOT NULL,
      "textEs" text,
      "assigneeName" character varying,
      "assigneeEmail" character varying,
      "recordingTimestamp" character varying,
      "playbackUrl" text,
      "completed" boolean NOT NULL DEFAULT false,
      "resolvedWorkspaceMemberId" uuid,
      "resolution" character varying,
      "taskId" uuid,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_meetingActionItem" PRIMARY KEY ("id"),
      CONSTRAINT "FK_meetingActionItem_meeting" FOREIGN KEY ("meetingId") REFERENCES "core"."meeting"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_meetingActionItem_pipeline" FOREIGN KEY ("pipelineId") REFERENCES "core"."taskPipeline"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_meetingActionItem_task" FOREIGN KEY ("taskId") REFERENCES "core"."taskPipelineTask"("id") ON DELETE SET NULL)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_MEETING_ACTION_ITEM_MEETING" ON "core"."meetingActionItem" ("meetingId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_MEETING_ACTION_ITEM_PIPELINE_KEY_UNIQUE" ON "core"."meetingActionItem" ("pipelineId", "externalKey")`);

    for (const table of [
      'taskPipeline',
      'taskPipelineMember',
      'taskPipelineStage',
      'meeting',
      'taskPipelineTask',
      'taskPipelineTaskComment',
      'fathomConnection',
      'meetingActionItem',
    ]) {
      const exists = await queryRunner.query(
        `SELECT 1 FROM pg_constraint WHERE conname = $1`,
        [`FK_${table}_workspace`],
      );

      if (exists.length === 0) {
        await queryRunner.query(workspaceFk(table));
      }
    }
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
