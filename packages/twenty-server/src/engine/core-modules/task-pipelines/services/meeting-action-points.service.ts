import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { DataSource, In } from 'typeorm';
import { v4 } from 'uuid';

import { type FathomActionItem } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { MeetingActionItemEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting-action-item.entity';
import {
  MeetingEntity,
  type MeetingActionPointsState,
} from 'src/engine/core-modules/task-pipelines/entities/meeting.entity';
import { TaskPipelineMemberEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-member.entity';
import { TaskPipelineStageEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-stage.entity';
import { TaskPipelineTaskEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task.entity';
import { TaskPipelineEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline.entity';
import {
  LocalLlmService,
  LocalLlmUnavailableError,
} from 'src/engine/core-modules/task-pipelines/services/local-llm.service';
import { TaskPipelineAccessService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-access.service';
import { TaskPipelineNotificationService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-notification.service';
import { TaskPipelineWorkspaceMembersService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-workspace-members.service';
import {
  ACTION_POINTS_SCHEMA,
  ACTION_POINTS_SYSTEM_PROMPT,
  type ActionPointCard,
  buildActionPointsUserPrompt,
  cardsFromActionItems,
  memberDisplayName,
  normalizeLlmCards,
  playbackUrlAt,
  secondsToTimestamp,
} from 'src/engine/core-modules/task-pipelines/utils/build-action-point-cards.util';
import { extractSummaryNextSteps } from 'src/engine/core-modules/task-pipelines/utils/extract-summary-next-steps.util';
import { type AssignableMember } from 'src/engine/core-modules/task-pipelines/utils/resolve-action-item-assignee.util';
import {
  NotFoundError,
  UserInputError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

const SWEEP_INTERVAL_MS = 60 * 1000;
// Un GENERATING más viejo que esto es un proceso que murió (reinicio, OOM).
const STALE_GENERATING_MS = 20 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const POSITION_STEP = 1024;
const CHECKLIST_TITLE = 'Action points';

type Actor = { workspaceId: string; workspaceMemberId: string | undefined };

// Action points de una reunión → tarjetas del tablero, UNA sola vez por
// reunión y tablero:
//  - reunión nueva (grabada después de conectar Fathom): automático;
//  - reunión vieja: solo con el botón "Generar action points".
// Estado en meeting.actionPoints[pipelineId]. Cola en proceso, de a una
// reunión por vez (la IA local usa CPU del VPS); el barrido de cada minuto
// retoma lo pendiente tras un reinicio. El "claim" es atómico en la base, así
// que server y worker juntos no generan dos veces.
@Injectable()
export class MeetingActionPointsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MeetingActionPointsService.name);
  private running = false;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectWorkspaceScopedRepository(MeetingEntity)
    private readonly meetingRepository: WorkspaceScopedRepository<MeetingEntity>,
    @InjectWorkspaceScopedRepository(MeetingActionItemEntity)
    private readonly actionItemRepository: WorkspaceScopedRepository<MeetingActionItemEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineEntity)
    private readonly pipelineRepository: WorkspaceScopedRepository<TaskPipelineEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineStageEntity)
    private readonly stageRepository: WorkspaceScopedRepository<TaskPipelineStageEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineMemberEntity)
    private readonly memberRepository: WorkspaceScopedRepository<TaskPipelineMemberEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineTaskEntity)
    private readonly taskRepository: WorkspaceScopedRepository<TaskPipelineTaskEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly accessService: TaskPipelineAccessService,
    private readonly workspaceMembersService: TaskPipelineWorkspaceMembersService,
    private readonly notificationService: TaskPipelineNotificationService,
    private readonly localLlmService: LocalLlmService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.sweepTimer = setInterval(() => void this.kick(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
  }

  // ------------------------------------------------------------ triggers

  // Botón "Generar action points". En DONE no se regenera nunca.
  async requestManual(
    actor: Actor,
    meetingId: string,
    pipelineId: string,
  ): Promise<MeetingActionPointsState> {
    await this.accessService.getAccessOrThrow({ ...actor, pipelineId });

    const meeting = await this.meetingRepository.findOne(actor.workspaceId, {
      where: { id: meetingId },
    });

    if (!isDefined(meeting) || !meeting.pipelineIds.includes(pipelineId)) {
      throw new NotFoundError('Meeting not found');
    }

    const current = meeting.actionPoints?.[pipelineId];

    if (current?.status === 'DONE') {
      throw new UserInputError(
        'Los action points de esta reunión ya se generaron',
      );
    }

    if (current?.status === 'PENDING' || current?.status === 'GENERATING') {
      return current;
    }

    const state: MeetingActionPointsState = {
      status: 'PENDING',
      trigger: 'MANUAL',
      requestedByWorkspaceMemberId: actor.workspaceMemberId ?? null,
      requestedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      attempts: 0,
      engine: null,
      error: null,
      taskIds: [],
    };

    // Solo si nadie lo cambió entretanto (sin estado o FAILED).
    const updated: unknown[] = await this.coreDataSource.query(
      `UPDATE "core"."meeting"
          SET "actionPoints" = "actionPoints" || jsonb_build_object($3::text, $4::jsonb)
        WHERE "workspaceId" = $1 AND "id" = $2
          AND coalesce("actionPoints"->$3::text->>'status', 'NONE') IN ('NONE', 'FAILED')
        RETURNING "id"`,
      [actor.workspaceId, meetingId, pipelineId, JSON.stringify(state)],
    );

    const affected = Array.isArray(updated[0]) ? updated[0] : updated;

    if (affected.length === 0) {
      const fresh = await this.meetingRepository.findOneOrFail(
        actor.workspaceId,
        { where: { id: meetingId } },
      );

      return fresh.actionPoints?.[pipelineId] ?? state;
    }

    void this.kick();

    return state;
  }

  // Desde la ingesta de Fathom: solo reuniones grabadas DESPUÉS de conectar la
  // cuenta. Nunca pisa un estado existente.
  async enqueueIfNewMeeting({
    workspaceId,
    meeting,
    pipelineId,
    connectedAt,
  }: {
    workspaceId: string;
    meeting: MeetingEntity;
    pipelineId: string;
    connectedAt: Date;
  }): Promise<boolean> {
    const recordedAt = meeting.endedAt ?? meeting.startedAt;

    if (!isDefined(recordedAt) || recordedAt < connectedAt) {
      return false;
    }

    if (isDefined(meeting.actionPoints?.[pipelineId])) {
      return false;
    }

    const state: MeetingActionPointsState = {
      status: 'PENDING',
      trigger: 'AUTO',
      requestedByWorkspaceMemberId: null,
      requestedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      attempts: 0,
      engine: null,
      error: null,
      taskIds: [],
    };

    const updated: unknown[] = await this.coreDataSource.query(
      `UPDATE "core"."meeting"
          SET "actionPoints" = "actionPoints" || jsonb_build_object($3::text, $4::jsonb)
        WHERE "workspaceId" = $1 AND "id" = $2 AND NOT ("actionPoints" ? $3::text)
        RETURNING "id"`,
      [workspaceId, meeting.id, pipelineId, JSON.stringify(state)],
    );
    const affected = Array.isArray(updated[0]) ? updated[0] : updated;

    if (affected.length > 0) {
      void this.kick();

      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------- queue

  async kick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.recoverStale();

      for (let guard = 0; guard < 50; guard++) {
        const claimed = await this.claimNext();

        if (!isDefined(claimed)) {
          break;
        }

        await this.process(claimed);
      }
    } catch (error) {
      this.logger.error(
        `Action points queue failed: ${(error as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }

  // GENERATING colgado → PENDING otra vez, o FAILED si ya se intentó mucho.
  private async recoverStale(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_GENERATING_MS).toISOString();
    const stale: {
      id: string;
      pipelineId: string;
      attempts: number | null;
    }[] = await this.coreDataSource.query(
      `SELECT m."id", e.key AS "pipelineId", (e.value->>'attempts')::int AS "attempts"
         FROM "core"."meeting" m, jsonb_each(m."actionPoints") e
        WHERE e.value->>'status' = 'GENERATING' AND (e.value->>'startedAt') < $1`,
      [cutoff],
    );

    for (const row of stale) {
      const patch =
        (row.attempts ?? 0) >= MAX_ATTEMPTS
          ? {
              status: 'FAILED',
              error: `La generación no terminó (se intentó ${MAX_ATTEMPTS} veces)`,
              finishedAt: new Date().toISOString(),
            }
          : { status: 'PENDING' };

      // Solo si sigue colgado (otro proceso pudo terminarlo entretanto).
      await this.coreDataSource.query(
        `UPDATE "core"."meeting"
            SET "actionPoints" = jsonb_set("actionPoints", ARRAY[$2::text],
                  ("actionPoints"->$2::text) || $3::jsonb)
          WHERE "id" = $1 AND "actionPoints"->$2::text->>'status' = 'GENERATING'
            AND ("actionPoints"->$2::text->>'startedAt') < $4`,
        [row.id, row.pipelineId, JSON.stringify(patch), cutoff],
      );
    }
  }

  private async claimNext(): Promise<{
    workspaceId: string;
    meetingId: string;
    pipelineId: string;
  } | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidates: {
        id: string;
        workspaceId: string;
        pipelineId: string;
      }[] = await this.coreDataSource.query(
        `SELECT m."id", m."workspaceId", e.key AS "pipelineId"
           FROM "core"."meeting" m, jsonb_each(m."actionPoints") e
          WHERE e.value->>'status' = 'PENDING'
          ORDER BY e.value->>'requestedAt' ASC
          LIMIT 1`,
      );

      const candidate = candidates[0];

      if (!isDefined(candidate)) {
        return null;
      }

      const updated: unknown[] = await this.coreDataSource.query(
        `UPDATE "core"."meeting"
            SET "actionPoints" = jsonb_set("actionPoints", ARRAY[$2::text],
                  ("actionPoints"->$2::text) || jsonb_build_object(
                    'status', 'GENERATING',
                    'startedAt', now()::text,
                    'attempts', coalesce(("actionPoints"->$2::text->>'attempts')::int, 0) + 1))
          WHERE "id" = $1 AND "actionPoints"->$2::text->>'status' = 'PENDING'
          RETURNING "id"`,
        [candidate.id, candidate.pipelineId],
      );
      const affected = Array.isArray(updated[0]) ? updated[0] : updated;

      if (affected.length > 0) {
        return {
          workspaceId: candidate.workspaceId,
          meetingId: candidate.id,
          pipelineId: candidate.pipelineId,
        };
      }
    }

    return null;
  }

  private async setState(
    meetingId: string,
    pipelineId: string,
    patch: Partial<MeetingActionPointsState>,
  ): Promise<void> {
    await this.coreDataSource.query(
      `UPDATE "core"."meeting"
          SET "actionPoints" = jsonb_set("actionPoints", ARRAY[$2::text],
                coalesce("actionPoints"->$2::text, '{}'::jsonb) || $3::jsonb)
        WHERE "id" = $1`,
      [meetingId, pipelineId, JSON.stringify(patch)],
    );
  }

  // ------------------------------------------------------------ generation

  private async process({
    workspaceId,
    meetingId,
    pipelineId,
  }: {
    workspaceId: string;
    meetingId: string;
    pipelineId: string;
  }): Promise<void> {
    try {
      const result = await this.generate(workspaceId, meetingId, pipelineId);

      await this.setState(meetingId, pipelineId, {
        status: 'DONE',
        finishedAt: new Date().toISOString(),
        engine: result.engine,
        error: result.warning,
        taskIds: result.taskIds,
      });
      this.logger.log(
        `Meeting ${meetingId} (pipeline ${pipelineId}): ${result.taskIds.length} cards via ${result.engine}`,
      );
    } catch (error) {
      const message = (error as Error).message;

      this.logger.warn(
        `Action points failed for meeting ${meetingId} (pipeline ${pipelineId}): ${message}`,
      );
      await this.setState(meetingId, pipelineId, {
        status: 'FAILED',
        finishedAt: new Date().toISOString(),
        error: message.slice(0, 500),
      });
    }
  }

  private async generate(
    workspaceId: string,
    meetingId: string,
    pipelineId: string,
  ): Promise<{
    engine: 'AI' | 'SUMMARY';
    taskIds: string[];
    warning: string | null;
  }> {
    const meeting = await this.meetingRepository.findOne(workspaceId, {
      where: { id: meetingId },
    });
    const pipeline = await this.pipelineRepository.findOne(workspaceId, {
      where: { id: pipelineId },
    });

    if (
      !isDefined(meeting) ||
      !isDefined(pipeline) ||
      isDefined(pipeline.archivedAt)
    ) {
      throw new Error('La reunión o el tablero ya no existen');
    }

    const stages = await this.stageRepository.find(workspaceId, {
      where: { pipelineId },
      order: { position: 'ASC' },
    });
    const firstStage = stages[0];

    if (!isDefined(firstStage)) {
      throw new Error('El tablero no tiene columnas');
    }

    const members = await this.getAssignableMembers(workspaceId, pipelineId);
    const fathomItems = (meeting.fathomActionItems ?? []) as FathomActionItem[];
    const summary = meeting.summaryMarkdown?.trim() ?? '';

    if (summary.length === 0 && fathomItems.length === 0) {
      throw new Error('Fathom todavía no mandó el resumen de esta reunión');
    }

    let cards: ActionPointCard[] = [];
    let engine: 'AI' | 'SUMMARY' = 'SUMMARY';
    let warning: string | null = null;

    if (this.localLlmService.isConfigured()) {
      try {
        const raw = await this.localLlmService.chatJson<unknown>({
          system: ACTION_POINTS_SYSTEM_PROMPT,
          user: buildActionPointsUserPrompt({
            title: meeting.title,
            startedAt: meeting.startedAt,
            participants: meeting.participants ?? [],
            members,
            summaryMarkdown: summary,
            fathomActionItems: fathomItems,
          }),
          schema: ACTION_POINTS_SCHEMA as unknown as Record<string, unknown>,
        });

        cards = normalizeLlmCards(raw, members);
        engine = 'AI';
      } catch (error) {
        if (!(error instanceof LocalLlmUnavailableError)) {
          throw error;
        }

        warning = `IA no disponible, se usó el resumen: ${error.message}`;
      }
    }

    if (cards.length === 0) {
      const items =
        fathomItems.length > 0
          ? fathomItems
          : (extractSummaryNextSteps(summary)?.items ?? []);

      cards = cardsFromActionItems({
        items,
        members,
        invitees: (meeting.participants ?? []).map((participant) => ({
          name: participant.name,
          email: participant.email,
        })),
        transcript: (meeting.transcript ?? []).map((line) => ({
          speakerName: line.speakerName,
          speakerEmail: line.speakerEmail,
          timestamp: line.timestamp,
        })),
      });

      if (cards.length > 0) {
        engine = 'SUMMARY';
      }
    }

    const taskIds: string[] = [];
    const memberById = new Map(
      members.map((member) => [member.workspaceMemberId, member]),
    );

    for (const [index, card] of cards.entries()) {
      const taskId = await this.createCardTask({
        workspaceId,
        meeting,
        pipeline,
        stage: firstStage,
        card,
        index,
        engine,
        memberById,
      });

      if (isDefined(taskId)) {
        taskIds.push(taskId);
      }
    }

    return { engine, taskIds, warning };
  }

  private async createCardTask({
    workspaceId,
    meeting,
    pipeline,
    stage,
    card,
    index,
    engine,
    memberById,
  }: {
    workspaceId: string;
    meeting: MeetingEntity;
    pipeline: TaskPipelineEntity;
    stage: TaskPipelineStageEntity;
    card: ActionPointCard;
    index: number;
    engine: 'AI' | 'SUMMARY';
    memberById: Map<string, AssignableMember>;
  }): Promise<string | null> {
    const externalKey = `ap:${meeting.id}:${index}`;
    const existing = await this.taskRepository.findOne(workspaceId, {
      where: { pipelineId: pipeline.id, externalKey },
    });

    // Reintento tras un corte a medias: lo ya creado se conserva.
    if (isDefined(existing)) {
      return existing.id;
    }

    const playbackUrl = playbackUrlAt(meeting.shareUrl, card.timestampSeconds);
    const date = meeting.startedAt
      ? meeting.startedAt.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
    const body = [
      ...(isNonEmptyString(card.description) ? [card.description, ''] : []),
      `**Reunión:** ${meeting.title}${date ? ` (${date})` : ''}${
        isDefined(playbackUrl)
          ? ` — [ver en la grabación${card.timestampSeconds !== null ? ` (${secondsToTimestamp(card.timestampSeconds)})` : ''}](${playbackUrl})`
          : ''
      }`,
    ].join('\n');

    const checklistItems = card.items.map((item) => ({
      id: v4(),
      text: item.text,
      done: false,
      assigneeWorkspaceMemberId: item.assigneeId,
      dueAt: null,
      completedAt: null,
    }));

    const max = await this.taskRepository.maximum(workspaceId, 'position', {
      stageId: stage.id,
    });

    let task: TaskPipelineTaskEntity;

    try {
      task = await this.taskRepository.insertAndReturnOne(workspaceId, {
        pipelineId: pipeline.id,
        stageId: stage.id,
        position: (max ?? 0) + POSITION_STEP,
        title: card.title,
        body,
        assigneeWorkspaceMemberId: card.memberIds[0] ?? null,
        memberWorkspaceMemberIds: card.memberIds,
        startAt: null,
        dueAt: null,
        priority: null,
        labels: [],
        checklist: [],
        checklists: [
          { id: v4(), title: CHECKLIST_TITLE, items: checklistItems },
        ],
        coverAttachmentId: null,
        relatedRecords: [],
        source: 'FATHOM',
        sourceLink: playbackUrl,
        meetingId: meeting.id,
        externalKey,
        originalText: null,
        needsAssignment: card.memberIds.length === 0,
        createdByWorkspaceMemberId: null,
        completedAt: stage.isDone ? new Date() : null,
        archivedAt: null,
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        const raced = await this.taskRepository.findOne(workspaceId, {
          where: { pipelineId: pipeline.id, externalKey },
        });

        return raced?.id ?? null;
      }

      throw error;
    }

    await this.coreDataSource.query(
      `INSERT INTO "core"."taskPipelineTaskComment" ("workspaceId", "taskId", "authorWorkspaceMemberId", "kind", "body")
       VALUES ($1, $2, NULL, 'ACTIVITY', $3)`,
      [
        workspaceId,
        task.id,
        JSON.stringify(
          card.memberIds.length === 0
            ? { type: 'fromMeetingUnassigned' }
            : { type: 'fromMeeting', resolution: engine },
        ),
      ],
    );

    // Cada punto queda como action point de la reunión, enlazado a su tarjeta.
    for (const [itemIndex, item] of checklistItems.entries()) {
      const member = isDefined(item.assigneeWorkspaceMemberId)
        ? memberById.get(item.assigneeWorkspaceMemberId)
        : undefined;

      try {
        await this.actionItemRepository.insertAndReturnOne(workspaceId, {
          meetingId: meeting.id,
          pipelineId: pipeline.id,
          connectionId: null,
          externalKey: `${externalKey}:${itemIndex}`,
          textEn: item.text,
          textEs: item.text,
          assigneeName: isDefined(member) ? memberDisplayName(member) : null,
          assigneeEmail: member?.email ?? null,
          recordingTimestamp:
            card.timestampSeconds !== null
              ? secondsToTimestamp(card.timestampSeconds)
              : null,
          playbackUrl,
          completed: false,
          resolvedWorkspaceMemberId: item.assigneeWorkspaceMemberId,
          resolution: engine,
          taskId: task.id,
          checklistItemId: item.id,
        });
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') {
          throw error;
        }
      }
    }

    for (const memberId of card.memberIds) {
      void this.notificationService.notifyAssigned({
        workspaceId,
        task: { ...task, assigneeWorkspaceMemberId: memberId },
        pipelineName: pipeline.name,
        assignedByWorkspaceMemberId: null,
        meetingTitle: meeting.title,
      });
    }

    return task.id;
  }

  async getAssignableMembers(
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

  // Tareas que siguen existiendo de las generadas (para el enlace del botón).
  async existingTaskIds(
    workspaceId: string,
    taskIds: string[],
  ): Promise<string[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const tasks = await this.taskRepository.find(workspaceId, {
      where: { id: In(taskIds) },
      select: { id: true },
    });

    return tasks.map((task) => task.id);
  }
}
