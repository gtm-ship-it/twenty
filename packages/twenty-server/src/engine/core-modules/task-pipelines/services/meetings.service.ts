import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { DataSource, In, IsNull } from 'typeorm';

import {
  type MeetingDetailDTO,
  type MeetingListItemDTO,
} from 'src/engine/core-modules/task-pipelines/dtos/meeting.dto';
import { type TaskPipelineTaskDTO } from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline-task.dto';
import { MeetingActionItemEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting-action-item.entity';
import { MeetingEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting.entity';
import { TaskPipelineStageEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-stage.entity';
import { TaskPipelineTaskEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task.entity';
import { TaskPipelineEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline.entity';
import { MeetingVideoTokenService } from 'src/engine/core-modules/task-pipelines/services/meeting-video-token.service';
import { TaskPipelineAccessService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-access.service';
import { TaskPipelinesService } from 'src/engine/core-modules/task-pipelines/services/task-pipelines.service';
import {
  ForbiddenError,
  NotFoundError,
  UserInputError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

type Actor = { workspaceId: string; workspaceMemberId: string | undefined };

const MAX_MEETINGS = 200;

@Injectable()
export class MeetingsService {
  constructor(
    @InjectWorkspaceScopedRepository(MeetingEntity)
    private readonly meetingRepository: WorkspaceScopedRepository<MeetingEntity>,
    @InjectWorkspaceScopedRepository(MeetingActionItemEntity)
    private readonly actionItemRepository: WorkspaceScopedRepository<MeetingActionItemEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineEntity)
    private readonly pipelineRepository: WorkspaceScopedRepository<TaskPipelineEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineStageEntity)
    private readonly stageRepository: WorkspaceScopedRepository<TaskPipelineStageEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineTaskEntity)
    private readonly taskRepository: WorkspaceScopedRepository<TaskPipelineTaskEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly accessService: TaskPipelineAccessService,
    private readonly taskPipelinesService: TaskPipelinesService,
    private readonly videoTokenService: MeetingVideoTokenService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  private async myPipelines(actor: Actor): Promise<TaskPipelineEntity[]> {
    if (!isDefined(actor.workspaceMemberId)) {
      throw new ForbiddenError('A workspace member is required');
    }

    const memberships = await this.accessService.listMemberships(
      actor.workspaceId,
      actor.workspaceMemberId,
    );

    if (memberships.length === 0) {
      return [];
    }

    return this.pipelineRepository.find(actor.workspaceId, {
      where: {
        id: In(memberships.map((membership) => membership.pipelineId)),
        archivedAt: IsNull(),
      },
    });
  }

  async listMeetings(
    actor: Actor,
    pipelineId?: string | null,
  ): Promise<MeetingListItemDTO[]> {
    const pipelines = await this.myPipelines(actor);
    const visibleIds = pipelines
      .map((pipeline) => pipeline.id)
      .filter((id) => !isDefined(pipelineId) || id === pipelineId);

    if (visibleIds.length === 0) {
      return [];
    }

    const rows: (MeetingEntity & { actionItemCount: number })[] =
      await this.coreDataSource.query(
        `SELECT m."id", m."title", m."startedAt", m."endedAt", m."participants", m."recordedBy", m."pipelineIds",
              (SELECT COUNT(*)::int FROM "core"."meetingActionItem" a
                WHERE a."meetingId" = m."id" AND a."pipelineId" = ANY($2::uuid[])) AS "actionItemCount"
         FROM "core"."meeting" m
        WHERE m."workspaceId" = $1
          AND m."pipelineIds" ?| $3::text[]
        ORDER BY m."startedAt" DESC NULLS LAST, m."createdAt" DESC
        LIMIT ${MAX_MEETINGS}`,
        [actor.workspaceId, visibleIds, visibleIds],
      );

    const nameById = new Map(
      pipelines.map((pipeline) => [pipeline.id, pipeline.name]),
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      endedAt: row.endedAt ? new Date(row.endedAt) : null,
      participantCount: (row.participants ?? []).length,
      actionItemCount: row.actionItemCount,
      pipelineNames: (row.pipelineIds ?? [])
        .filter((id) => visibleIds.includes(id))
        .map((id) => nameById.get(id))
        .filter(isNonEmptyString),
      recordedByName: row.recordedBy?.name ?? row.recordedBy?.email ?? null,
    }));
  }

  async getMeeting(actor: Actor, meetingId: string): Promise<MeetingDetailDTO> {
    const pipelines = await this.myPipelines(actor);
    const visibleIds = pipelines.map((pipeline) => pipeline.id);

    const meeting = await this.meetingRepository.findOne(actor.workspaceId, {
      where: { id: meetingId },
    });

    if (
      !isDefined(meeting) ||
      !meeting.pipelineIds.some((id) => visibleIds.includes(id))
    ) {
      throw new NotFoundError('Meeting not found');
    }

    const actionItems = await this.actionItemRepository.find(
      actor.workspaceId,
      {
        where: { meetingId, pipelineId: In(visibleIds) },
        order: { recordingTimestamp: 'ASC', createdAt: 'ASC' },
      },
    );

    const taskIds = actionItems.map((item) => item.taskId).filter(isDefined);
    const tasks =
      taskIds.length > 0
        ? await this.taskRepository.find(actor.workspaceId, {
            where: { id: In(taskIds) },
          })
        : [];
    const stageIds = [...new Set(tasks.map((task) => task.stageId))];
    const stages =
      stageIds.length > 0
        ? await this.stageRepository.find(actor.workspaceId, {
            where: { id: In(stageIds) },
          })
        : [];

    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const stageById = new Map(stages.map((stage) => [stage.id, stage]));
    const nameById = new Map(
      pipelines.map((pipeline) => [pipeline.id, pipeline.name]),
    );

    const serverUrl = String(
      this.twentyConfigService.get('SERVER_URL'),
    ).replace(/\/$/, '');
    const videoUrl = isNonEmptyString(meeting.shareUrl)
      ? `${serverUrl}/task-pipelines/meetings/${meeting.id}/video/playlist.m3u8?token=${encodeURIComponent(
          this.videoTokenService.createToken(
            actor.workspaceId,
            meeting.id,
            actor.workspaceMemberId as string,
          ),
        )}`
      : null;

    return {
      id: meeting.id,
      recordingId: meeting.recordingId,
      title: meeting.title,
      url: meeting.url,
      shareUrl: meeting.shareUrl,
      videoUrl,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
      participants: meeting.participants ?? [],
      recordedByName: meeting.recordedBy?.name ?? null,
      recordedByEmail: meeting.recordedBy?.email ?? null,
      summaryMarkdown: meeting.summaryMarkdown,
      summaryMarkdownEs: meeting.summaryMarkdownEs,
      transcript: meeting.transcript ?? [],
      actionItems: actionItems.map((item) => {
        const task = isDefined(item.taskId)
          ? taskById.get(item.taskId)
          : undefined;
        const stage = isDefined(task) ? stageById.get(task.stageId) : undefined;

        return {
          id: item.id,
          pipelineId: item.pipelineId,
          pipelineName: nameById.get(item.pipelineId) ?? '',
          textEn: item.textEn,
          textEs: item.textEs,
          assigneeName: item.assigneeName,
          assigneeEmail: item.assigneeEmail,
          recordingTimestamp: item.recordingTimestamp,
          playbackUrl: item.playbackUrl,
          completed: item.completed,
          resolvedWorkspaceMemberId: isDefined(task)
            ? task.assigneeWorkspaceMemberId
            : item.resolvedWorkspaceMemberId,
          resolution: item.resolution,
          taskId: isDefined(task) ? task.id : null,
          taskStageId: task?.stageId ?? null,
          taskIsDone: isDefined(task?.completedAt) || stage?.isDone === true,
        };
      }),
    };
  }

  // Un accionable sin tarea (porque la borraron) vuelve a tener tarea a mano.
  async createTaskFromActionItem(
    actor: Actor,
    actionItemId: string,
  ): Promise<TaskPipelineTaskDTO> {
    const item = await this.actionItemRepository.findOne(actor.workspaceId, {
      where: { id: actionItemId },
    });

    if (!isDefined(item)) {
      throw new NotFoundError('Action item not found');
    }

    await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId: item.pipelineId,
    });

    if (isDefined(item.taskId)) {
      const existing = await this.taskRepository.findOne(actor.workspaceId, {
        where: { id: item.taskId },
      });

      if (isDefined(existing)) {
        throw new UserInputError('This action item already has a task');
      }
    }

    const meeting = await this.meetingRepository.findOneOrFail(
      actor.workspaceId,
      {
        where: { id: item.meetingId },
      },
    );

    // Si quien estaba resuelto ya no es miembro del tablero, la tarea nace sin asignar.
    const stillMember = isDefined(item.resolvedWorkspaceMemberId)
      ? (
          await this.accessService.listMemberships(
            actor.workspaceId,
            item.resolvedWorkspaceMemberId,
          )
        ).some((membership) => membership.pipelineId === item.pipelineId)
      : false;

    const task = await this.taskPipelinesService.createTask(actor, {
      pipelineId: item.pipelineId,
      title: (item.textEs ?? item.textEn).slice(0, 500),
      body: `**Reunión:** ${meeting.title}\n\n> ${item.textEn}`,
      assigneeWorkspaceMemberId: stillMember
        ? item.resolvedWorkspaceMemberId
        : null,
      sourceLink: item.playbackUrl ?? meeting.shareUrl,
    });

    await this.taskRepository.update(
      actor.workspaceId,
      { id: task.id },
      { source: 'FATHOM', meetingId: meeting.id, originalText: item.textEn },
    );
    await this.actionItemRepository.update(
      actor.workspaceId,
      { id: item.id },
      { taskId: task.id },
    );

    return this.taskPipelinesService.getTask(actor, task.id);
  }
}
