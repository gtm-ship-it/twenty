import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { DataSource } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { type FathomConnectionEntity } from 'src/engine/core-modules/task-pipelines/entities/fathom-connection.entity';
import {
  MeetingEntity,
  type MeetingParticipant,
  type MeetingTranscriptLine,
} from 'src/engine/core-modules/task-pipelines/entities/meeting.entity';
import { TaskPipelineEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline.entity';
import { type FathomMeeting } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { LibreTranslateService } from 'src/engine/core-modules/task-pipelines/services/libre-translate.service';
import { MeetingActionPointsService } from 'src/engine/core-modules/task-pipelines/services/meeting-action-points.service';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

export type MeetingIngestionResult = {
  meetingId: string | null;
  actionItemsSeen: number;
  tasksCreated: number;
  queued?: boolean;
};

const toDate = (value: string | null | undefined): Date | null => {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

// Guarda la reunión de Fathom (video, resumen, transcripción, accionables
// crudos) y, si es nueva, encola sus action points para la IA. Idempotente:
// reprocesar la misma reunión no duplica nada.
@Injectable()
export class FathomIngestionService {
  private readonly logger = new Logger(FathomIngestionService.name);

  constructor(
    @InjectWorkspaceScopedRepository(MeetingEntity)
    private readonly meetingRepository: WorkspaceScopedRepository<MeetingEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineEntity)
    private readonly pipelineRepository: WorkspaceScopedRepository<TaskPipelineEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly translateService: LibreTranslateService,
    private readonly actionPointsService: MeetingActionPointsService,
  ) {}

  async ingestMeeting(
    connection: FathomConnectionEntity,
    fathomMeeting: FathomMeeting,
  ): Promise<MeetingIngestionResult> {
    const workspaceId = connection.workspaceId;
    const recordingId = isDefined(fathomMeeting.recording_id)
      ? String(fathomMeeting.recording_id)
      : null;

    if (!isDefined(recordingId)) {
      return { meetingId: null, actionItemsSeen: 0, tasksCreated: 0 };
    }

    const pipeline = await this.pipelineRepository.findOne(workspaceId, {
      where: { id: connection.pipelineId },
    });

    if (!isDefined(pipeline) || isDefined(pipeline.archivedAt)) {
      return { meetingId: null, actionItemsSeen: 0, tasksCreated: 0 };
    }

    const meeting = await this.upsertMeeting(
      workspaceId,
      recordingId,
      fathomMeeting,
      pipeline.id,
    );

    // Resumen en español (si Fathom lo mandó en inglés).
    if (
      isDefined(meeting.summaryMarkdown) &&
      !isDefined(meeting.summaryMarkdownEs)
    ) {
      const translatedSummary = await this.translateService.translateMarkdown(
        meeting.summaryMarkdown,
      );

      if (isDefined(translatedSummary)) {
        await this.meetingRepository.update(
          workspaceId,
          { id: meeting.id },
          { summaryMarkdownEs: translatedSummary, translatedTo: 'es' },
        );
      }
    }

    // Los action points ya no se crean aquí: si la reunión es nueva (grabada
    // después de conectar esta cuenta) se encolan para la IA; si es vieja,
    // quedan a mano con el botón "Generar action points".
    const queued = await this.actionPointsService.enqueueIfNewMeeting({
      workspaceId,
      meeting,
      pipelineId: pipeline.id,
      connectedAt: connection.createdAt,
    });

    return {
      meetingId: meeting.id,
      actionItemsSeen: (fathomMeeting.action_items ?? []).length,
      tasksCreated: 0,
      queued,
    };
  }

  private async upsertMeeting(
    workspaceId: string,
    recordingId: string,
    fathomMeeting: FathomMeeting,
    pipelineId: string,
  ): Promise<MeetingEntity> {
    const participants: MeetingParticipant[] = (
      fathomMeeting.calendar_invitees ?? []
    ).map((invitee) => ({
      name: invitee.name ?? null,
      email: invitee.email?.toLowerCase() ?? null,
      isExternal: invitee.is_external === true,
    }));
    const transcript: MeetingTranscriptLine[] = (fathomMeeting.transcript ?? [])
      .filter((line) => isNonEmptyString(line.text))
      .map((line) => ({
        speakerName: line.speaker?.display_name ?? null,
        speakerEmail:
          line.speaker?.matched_calendar_invitee_email?.toLowerCase() ?? null,
        timestamp: line.timestamp ?? '00:00:00',
        text: line.text ?? '',
      }));
    const summary =
      fathomMeeting.default_summary?.markdown_formatted?.trim() || null;

    const existing = await this.meetingRepository.findOne(workspaceId, {
      where: { recordingId },
    });

    const fields: QueryDeepPartialEntity<MeetingEntity> &
      Record<string, unknown> = {
      title:
        fathomMeeting.title?.trim() ||
        fathomMeeting.meeting_title?.trim() ||
        existing?.title ||
        'Meeting',
      url: fathomMeeting.url ?? existing?.url ?? null,
      shareUrl: fathomMeeting.share_url ?? existing?.shareUrl ?? null,
      startedAt:
        toDate(fathomMeeting.recording_start_time) ??
        toDate(fathomMeeting.scheduled_start_time) ??
        existing?.startedAt ??
        null,
      endedAt:
        toDate(fathomMeeting.recording_end_time) ?? existing?.endedAt ?? null,
      recordedBy: fathomMeeting.recorded_by
        ? {
            name: fathomMeeting.recorded_by.name ?? null,
            email: fathomMeeting.recorded_by.email?.toLowerCase() ?? null,
          }
        : (existing?.recordedBy ?? null),
    };

    // Payloads de sync sin detalle no deben borrar lo que ya teníamos.
    if (participants.length > 0) {
      fields.participants = participants;
    }

    // La transcripción (puede pesar MB) solo se reescribe si cambió.
    if (
      transcript.length > 0 &&
      JSON.stringify(transcript) !== JSON.stringify(existing?.transcript ?? [])
    ) {
      fields.transcript = transcript;
    }

    if ((fathomMeeting.action_items ?? []).length > 0) {
      fields.fathomActionItems = fathomMeeting.action_items ?? [];
    }

    if (isDefined(summary) && summary !== existing?.summaryMarkdown) {
      fields.summaryMarkdown = summary;
      fields.summaryMarkdownEs = null;
      fields.translatedTo = null;
    }

    if (!isDefined(existing)) {
      try {
        return await this.meetingRepository.insertAndReturnOne(workspaceId, {
          recordingId,
          participants: [],
          transcript: [],
          summaryMarkdown: null,
          summaryMarkdownEs: null,
          translatedTo: null,
          actionPoints: {},
          fathomActionItems: [],
          ...fields,
          pipelineIds: [pipelineId],
        });
      } catch (error) {
        // Webhook y sync a la vez: el otro la creó primero; seguimos como update.
        if ((error as { code?: string }).code !== '23505') {
          throw error;
        }
      }
    }

    const current = await this.meetingRepository.findOneOrFail(workspaceId, {
      where: { recordingId },
    });

    await this.meetingRepository.update(
      workspaceId,
      { id: current.id },
      fields,
    );
    // Alta atómica del tablero (dos tableros a la vez no se pisan).
    await this.coreDataSource.query(
      `UPDATE "core"."meeting"
          SET "pipelineIds" = "pipelineIds" || to_jsonb($3::text)
        WHERE "workspaceId" = $1 AND "id" = $2 AND NOT ("pipelineIds" ? $3::text)`,
      [workspaceId, current.id, pipelineId],
    );

    const existingRef = current;

    return (await this.meetingRepository.findOneOrFail(workspaceId, {
      where: { id: existingRef.id },
    })) as MeetingEntity;
  }
}
