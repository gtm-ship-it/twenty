import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { DataSource, In } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { type FathomConnectionEntity } from 'src/engine/core-modules/task-pipelines/entities/fathom-connection.entity';
import { MeetingActionItemEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting-action-item.entity';
import {
  MeetingEntity,
  type MeetingParticipant,
  type MeetingTranscriptLine,
} from 'src/engine/core-modules/task-pipelines/entities/meeting.entity';
import { TaskPipelineMemberEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-member.entity';
import { TaskPipelineStageEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-stage.entity';
import { TaskPipelineTaskEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task.entity';
import { TaskPipelineEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline.entity';
import { type FathomMeeting } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { LibreTranslateService } from 'src/engine/core-modules/task-pipelines/services/libre-translate.service';
import { TaskPipelineNotificationService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-notification.service';
import { TaskPipelineWorkspaceMembersService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-workspace-members.service';
import { computeActionItemKey } from 'src/engine/core-modules/task-pipelines/utils/compute-action-item-key.util';
import {
  type AssignableMember,
  resolveActionItemAssignee,
} from 'src/engine/core-modules/task-pipelines/utils/resolve-action-item-assignee.util';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

const POSITION_STEP = 1024;
const MAX_TITLE_LENGTH = 500;

export type MeetingIngestionResult = {
  meetingId: string | null;
  actionItemsSeen: number;
  tasksCreated: number;
};

const toDate = (value: string | null | undefined): Date | null => {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

// Convierte una reunión de Fathom en: la reunión guardada (video, resumen,
// transcripción), sus accionables, y una tarea por accionable asignada a la
// persona correcta DEL tablero. Idempotente: reprocesar la misma reunión no
// duplica nada y respeta lo que la gente ya editó o borró.
@Injectable()
export class FathomIngestionService {
  private readonly logger = new Logger(FathomIngestionService.name);

  constructor(
    @InjectWorkspaceScopedRepository(MeetingEntity)
    private readonly meetingRepository: WorkspaceScopedRepository<MeetingEntity>,
    @InjectWorkspaceScopedRepository(MeetingActionItemEntity)
    private readonly actionItemRepository: WorkspaceScopedRepository<MeetingActionItemEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineEntity)
    private readonly pipelineRepository: WorkspaceScopedRepository<TaskPipelineEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineMemberEntity)
    private readonly memberRepository: WorkspaceScopedRepository<TaskPipelineMemberEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineStageEntity)
    private readonly stageRepository: WorkspaceScopedRepository<TaskPipelineStageEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineTaskEntity)
    private readonly taskRepository: WorkspaceScopedRepository<TaskPipelineTaskEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly translateService: LibreTranslateService,
    private readonly workspaceMembersService: TaskPipelineWorkspaceMembersService,
    private readonly notificationService: TaskPipelineNotificationService,
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

    const meeting = await this.upsertMeeting(workspaceId, recordingId, fathomMeeting, pipeline.id);

    const rawItems = (fathomMeeting.action_items ?? []).filter((item) =>
      isNonEmptyString(item.description?.trim()),
    );

    // Traducción (texto de accionables + resumen) en una sola pasada.
    const texts = rawItems.map((item) => (item.description ?? '').trim());
    const translatedTexts = await this.translateService.translateMany(texts);

    if (isDefined(meeting.summaryMarkdown) && !isDefined(meeting.summaryMarkdownEs)) {
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

    const members = await this.getAssignableMembers(workspaceId, pipeline.id);
    const invitees = meeting.participants.map((participant) => ({
      name: participant.name,
      email: participant.email,
    }));
    const transcriptHints = meeting.transcript.map((line) => ({
      speakerName: line.speakerName,
      speakerEmail: line.speakerEmail,
      timestamp: line.timestamp,
    }));

    const stages = await this.stageRepository.find(workspaceId, {
      where: { pipelineId: pipeline.id },
      order: { position: 'ASC' },
    });
    const firstStage = stages[0];
    const doneStage = stages.find((stage) => stage.isDone) ?? stages[stages.length - 1];

    if (!isDefined(firstStage)) {
      return { meetingId: meeting.id, actionItemsSeen: rawItems.length, tasksCreated: 0 };
    }

    const keys = rawItems.map((item) =>
      computeActionItemKey({
        recordingId,
        recordingTimestamp: item.recording_timestamp ?? null,
        description: (item.description ?? '').trim(),
      }),
    );

    const existingItems =
      keys.length > 0
        ? await this.actionItemRepository.find(workspaceId, {
            where: { pipelineId: pipeline.id, externalKey: In(keys) },
          })
        : [];
    const existingByKey = new Map(existingItems.map((item) => [item.externalKey, item]));

    let tasksCreated = 0;

    for (const [index, item] of rawItems.entries()) {
      const externalKey = keys[index];
      const textEn = texts[index];
      const textEs = translatedTexts?.[index]?.trim() || null;
      const existing = existingByKey.get(externalKey);

      if (isDefined(existing)) {
        // Ya procesado: solo completar la traducción si faltaba (y el título
        // de la tarea si nadie lo cambió).
        if (!isDefined(existing.textEs) && isDefined(textEs)) {
          await this.actionItemRepository.update(workspaceId, { id: existing.id }, { textEs });

          if (isDefined(existing.taskId)) {
            await this.taskRepository.update(
              workspaceId,
              { id: existing.taskId, title: truncate(textEn, MAX_TITLE_LENGTH) },
              { title: truncate(textEs, MAX_TITLE_LENGTH) },
            );
          }
        }

        continue;
      }

      const resolved = resolveActionItemAssignee({
        assignee: item.assignee
          ? { name: item.assignee.name ?? null, email: item.assignee.email ?? null }
          : null,
        description: textEn,
        recordingTimestamp: item.recording_timestamp ?? null,
        invitees,
        transcript: transcriptHints,
        members,
      });

      const isCompleted = item.completed === true;
      const stage = isCompleted && isDefined(doneStage) ? doneStage : firstStage;

      const created = await this.createTaskIfMissing({
        workspaceId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        stageIsDone: stage.isDone,
        externalKey,
        title: truncate(textEs ?? textEn, MAX_TITLE_LENGTH),
        body: this.buildTaskBody({ meeting, item, textEn, textEs }),
        assigneeWorkspaceMemberId: resolved.workspaceMemberId,
        needsAssignment: !isDefined(resolved.workspaceMemberId),
        sourceLink: item.recording_playback_url ?? meeting.shareUrl ?? null,
        meetingId: meeting.id,
        originalText: textEn,
        resolution: resolved.resolution,
      });

      const actionItem = await this.actionItemRepository.insertAndReturnOne(workspaceId, {
        meetingId: meeting.id,
        pipelineId: pipeline.id,
        connectionId: connection.id,
        externalKey,
        textEn,
        textEs,
        assigneeName: item.assignee?.name ?? null,
        assigneeEmail: item.assignee?.email ?? null,
        recordingTimestamp: item.recording_timestamp ?? null,
        playbackUrl: item.recording_playback_url ?? null,
        completed: isCompleted,
        resolvedWorkspaceMemberId: resolved.workspaceMemberId,
        resolution: resolved.resolution,
        taskId: created?.id ?? null,
      });

      if (isDefined(created)) {
        tasksCreated++;

        if (isDefined(created.assigneeWorkspaceMemberId) && !isCompleted) {
          await this.notificationService.notifyAssigned({
            workspaceId,
            task: created,
            pipelineName: pipeline.name,
            assignedByWorkspaceMemberId: null,
            meetingTitle: meeting.title,
          });
        }
      }

      this.logger.log(
        `Fathom meeting ${recordingId} → action item ${actionItem.id} (${resolved.resolution})${created ? ` task ${created.id}` : ''}`,
      );
    }

    return { meetingId: meeting.id, actionItemsSeen: rawItems.length, tasksCreated };
  }

  private async upsertMeeting(
    workspaceId: string,
    recordingId: string,
    fathomMeeting: FathomMeeting,
    pipelineId: string,
  ): Promise<MeetingEntity> {
    const participants: MeetingParticipant[] = (fathomMeeting.calendar_invitees ?? []).map(
      (invitee) => ({
        name: invitee.name ?? null,
        email: invitee.email?.toLowerCase() ?? null,
        isExternal: invitee.is_external === true,
      }),
    );
    const transcript: MeetingTranscriptLine[] = (fathomMeeting.transcript ?? [])
      .filter((line) => isNonEmptyString(line.text))
      .map((line) => ({
        speakerName: line.speaker?.display_name ?? null,
        speakerEmail: line.speaker?.matched_calendar_invitee_email?.toLowerCase() ?? null,
        timestamp: line.timestamp ?? '00:00:00',
        text: line.text ?? '',
      }));
    const summary = fathomMeeting.default_summary?.markdown_formatted?.trim() || null;

    const existing = await this.meetingRepository.findOne(workspaceId, {
      where: { recordingId },
    });

    const fields: QueryDeepPartialEntity<MeetingEntity> & Record<string, unknown> = {
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
      endedAt: toDate(fathomMeeting.recording_end_time) ?? existing?.endedAt ?? null,
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

    if (transcript.length > 0) {
      fields.transcript = transcript;
    }

    if (isDefined(summary) && summary !== existing?.summaryMarkdown) {
      fields.summaryMarkdown = summary;
      fields.summaryMarkdownEs = null;
      fields.translatedTo = null;
    }

    if (!isDefined(existing)) {
      return this.meetingRepository.insertAndReturnOne(workspaceId, {
        recordingId,
        participants: [],
        transcript: [],
        summaryMarkdown: null,
        summaryMarkdownEs: null,
        translatedTo: null,
        ...fields,
        pipelineIds: [pipelineId],
      });
    }

    const pipelineIds = existing.pipelineIds.includes(pipelineId)
      ? existing.pipelineIds
      : [...existing.pipelineIds, pipelineId];

    await this.meetingRepository.update(workspaceId, { id: existing.id }, { ...fields, pipelineIds });

    return (await this.meetingRepository.findOneOrFail(workspaceId, {
      where: { id: existing.id },
    })) as MeetingEntity;
  }

  private async getAssignableMembers(
    workspaceId: string,
    pipelineId: string,
  ): Promise<AssignableMember[]> {
    const memberships = await this.memberRepository.find(workspaceId, {
      where: { pipelineId },
    });
    const people = await this.workspaceMembersService.findMembers(
      workspaceId,
      memberships.map((membership) => membership.workspaceMemberId),
    );
    const personById = new Map(people.map((person) => [person.id, person]));

    return memberships
      .map((membership) => {
        const person = personById.get(membership.workspaceMemberId);

        if (!isDefined(person)) {
          return null;
        }

        return {
          workspaceMemberId: membership.workspaceMemberId,
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          aliases: membership.aliases ?? [],
        };
      })
      .filter(isDefined);
  }

  private async createTaskIfMissing(input: {
    workspaceId: string;
    pipelineId: string;
    stageId: string;
    stageIsDone: boolean;
    externalKey: string;
    title: string;
    body: string;
    assigneeWorkspaceMemberId: string | null;
    needsAssignment: boolean;
    sourceLink: string | null;
    meetingId: string;
    originalText: string;
    resolution: string;
  }): Promise<TaskPipelineTaskEntity | null> {
    const existing = await this.taskRepository.findOne(input.workspaceId, {
      where: { pipelineId: input.pipelineId, externalKey: input.externalKey },
    });

    if (isDefined(existing)) {
      return null;
    }

    const max = await this.taskRepository.maximum(input.workspaceId, 'position', {
      stageId: input.stageId,
    });

    try {
      const task = await this.taskRepository.insertAndReturnOne(input.workspaceId, {
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        position: (max ?? 0) + POSITION_STEP,
        title: input.title,
        body: input.body,
        assigneeWorkspaceMemberId: input.assigneeWorkspaceMemberId,
        dueAt: null,
        priority: null,
        labels: [],
        checklist: [],
        relatedRecords: [],
        source: 'FATHOM',
        sourceLink: input.sourceLink,
        meetingId: input.meetingId,
        externalKey: input.externalKey,
        originalText: input.originalText,
        needsAssignment: input.needsAssignment,
        createdByWorkspaceMemberId: null,
        completedAt: input.stageIsDone ? new Date() : null,
        archivedAt: null,
      });

      await this.coreDataSource.query(
        `INSERT INTO "core"."taskPipelineTaskComment" ("workspaceId", "taskId", "authorWorkspaceMemberId", "kind", "body")
         VALUES ($1, $2, NULL, 'ACTIVITY', $3)`,
        [
          input.workspaceId,
          task.id,
          input.needsAssignment
            ? 'created this from a meeting — nobody in this pipeline matched the assignee, please assign it'
            : `created this from a meeting (assigned by ${input.resolution.toLowerCase().replace('_', ' ')})`,
        ],
      );

      return task;
    } catch (error) {
      // Dos procesamientos a la vez (webhook + sync): el índice único gana.
      if ((error as { code?: string }).code === '23505') {
        return null;
      }

      throw error;
    }
  }

  private buildTaskBody({
    meeting,
    item,
    textEn,
    textEs,
  }: {
    meeting: MeetingEntity;
    item: NonNullable<FathomMeeting['action_items']>[number];
    textEn: string;
    textEs: string | null;
  }): string {
    const lines: string[] = [];
    const date = meeting.startedAt
      ? meeting.startedAt.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    lines.push(`**Reunión:** ${meeting.title}${date ? ` (${date})` : ''}`);

    if (isNonEmptyString(item.recording_timestamp)) {
      lines.push(
        `**Momento:** ${item.recording_timestamp}${item.recording_playback_url ? ` — [ver en la grabación](${item.recording_playback_url})` : ''}`,
      );
    }

    if (isNonEmptyString(item.assignee?.name) || isNonEmptyString(item.assignee?.email)) {
      lines.push(
        `**Asignado en Fathom:** ${[item.assignee?.name, item.assignee?.email].filter(isNonEmptyString).join(' · ')}`,
      );
    }

    if (isDefined(textEs) && textEs !== textEn) {
      lines.push('', `> ${textEn}`);
    }

    return lines.join('\n');
  }
}
