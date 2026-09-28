import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { DataSource, In, IsNull } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { InjectDataSource } from '@nestjs/typeorm';

import {
  type TaskPipelineDTO,
  type TaskPipelineFathomConnectionDTO,
} from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline.dto';
import {
  type TaskPipelineTaskCommentDTO,
  type TaskPipelineTaskDTO,
} from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline-task.dto';
import {
  type CreateTaskPipelineInput,
  type CreateTaskPipelineTaskInput,
  type MoveTaskPipelineTaskInput,
  type TaskPipelineStageInput,
  type UpdateTaskPipelineInput,
  type UpdateTaskPipelineTaskInput,
} from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline.inputs';
import { FathomConnectionEntity } from 'src/engine/core-modules/task-pipelines/entities/fathom-connection.entity';
import { MeetingEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting.entity';
import {
  TaskPipelineMemberEntity,
  type TaskPipelineMemberRole,
} from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-member.entity';
import { TaskPipelineStageEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-stage.entity';
import { TaskPipelineTaskCommentEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task-comment.entity';
import {
  TaskPipelineTaskEntity,
  type TaskPipelineTaskPriority,
} from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task.entity';
import { TaskPipelineEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline.entity';
import { TaskPipelineAccessService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-access.service';
import { TaskPipelineNotificationService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-notification.service';
import { TaskPipelineWorkspaceMembersService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-workspace-members.service';
import {
  ForbiddenError,
  NotFoundError,
  UserInputError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

export const DEFAULT_TASK_PIPELINE_STAGES: {
  name: string;
  color: string;
  isDone: boolean;
}[] = [
  { name: 'Por hacer', color: 'gray', isDone: false },
  { name: 'En curso', color: 'blue', isDone: false },
  { name: 'Bloqueado', color: 'red', isDone: false },
  { name: 'Hecho', color: 'green', isDone: true },
];

const POSITION_STEP = 1024;

type Actor = { workspaceId: string; workspaceMemberId: string | undefined };

@Injectable()
export class TaskPipelinesService {
  private readonly logger = new Logger(TaskPipelinesService.name);

  constructor(
    @InjectWorkspaceScopedRepository(TaskPipelineEntity)
    private readonly pipelineRepository: WorkspaceScopedRepository<TaskPipelineEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineMemberEntity)
    private readonly memberRepository: WorkspaceScopedRepository<TaskPipelineMemberEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineStageEntity)
    private readonly stageRepository: WorkspaceScopedRepository<TaskPipelineStageEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineTaskEntity)
    private readonly taskRepository: WorkspaceScopedRepository<TaskPipelineTaskEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineTaskCommentEntity)
    private readonly commentRepository: WorkspaceScopedRepository<TaskPipelineTaskCommentEntity>,
    @InjectWorkspaceScopedRepository(FathomConnectionEntity)
    private readonly connectionRepository: WorkspaceScopedRepository<FathomConnectionEntity>,
    @InjectWorkspaceScopedRepository(MeetingEntity)
    private readonly meetingRepository: WorkspaceScopedRepository<MeetingEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly accessService: TaskPipelineAccessService,
    private readonly workspaceMembersService: TaskPipelineWorkspaceMembersService,
    private readonly notificationService: TaskPipelineNotificationService,
  ) {}

  // ---------------------------------------------------------------- pipelines

  async listPipelines(actor: Actor): Promise<TaskPipelineDTO[]> {
    const workspaceMemberId = this.requireMember(actor);
    const memberships = await this.accessService.listMemberships(
      actor.workspaceId,
      workspaceMemberId,
    );

    if (memberships.length === 0) {
      return [];
    }

    const pipelines = await this.pipelineRepository.find(actor.workspaceId, {
      where: {
        id: In(memberships.map((membership) => membership.pipelineId)),
        archivedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });

    return this.toPipelineDTOs(actor.workspaceId, pipelines, memberships);
  }

  async getPipeline(actor: Actor, pipelineId: string): Promise<TaskPipelineDTO> {
    const { pipeline, membership } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
    });

    const [dto] = await this.toPipelineDTOs(actor.workspaceId, [pipeline], [membership]);

    return dto;
  }

  async createPipeline(
    actor: Actor & { userWorkspaceId: string | undefined },
    input: CreateTaskPipelineInput,
  ): Promise<TaskPipelineDTO> {
    const workspaceMemberId = this.requireMember(actor);

    if (input.visibility === 'WORKSPACE') {
      const canCreate = await this.accessService.canCreateWorkspacePipelines({
        workspaceId: actor.workspaceId,
        userWorkspaceId: actor.userWorkspaceId,
      });

      if (!canCreate) {
        throw new ForbiddenError(
          'Only workspace admins can create shared pipelines. You can create a personal one.',
        );
      }
    }

    const stages =
      input.stages && input.stages.length > 0
        ? input.stages.map((stage) => ({
            name: stage.name.trim(),
            color: stage.color,
            isDone: stage.isDone ?? false,
          }))
        : DEFAULT_TASK_PIPELINE_STAGES;

    const pipelineId = await this.coreDataSource.transaction(async (manager) => {
      const pipeline = await manager.save(
        manager.create(TaskPipelineEntity, {
          workspaceId: actor.workspaceId,
          name: input.name.trim(),
          color: input.color ?? 'blue',
          visibility: input.visibility,
          ownerWorkspaceMemberId: workspaceMemberId,
          labels: [],
          archivedAt: null,
        }),
      );

      await manager.save(
        manager.create(TaskPipelineMemberEntity, {
          workspaceId: actor.workspaceId,
          pipelineId: pipeline.id,
          workspaceMemberId,
          role: 'ADMIN',
          aliases: [],
        }),
      );

      await manager.save(
        stages.map((stage, index) =>
          manager.create(TaskPipelineStageEntity, {
            workspaceId: actor.workspaceId,
            pipelineId: pipeline.id,
            name: stage.name,
            color: stage.color,
            isDone: stage.isDone,
            position: index * POSITION_STEP,
          }),
        ),
      );

      return pipeline.id;
    });

    return this.getPipeline(actor, pipelineId);
  }

  async updatePipeline(
    actor: Actor,
    pipelineId: string,
    input: UpdateTaskPipelineInput,
  ): Promise<TaskPipelineDTO> {
    await this.accessService.getAccessOrThrow({ ...actor, pipelineId, requireAdmin: true });

    const patch: QueryDeepPartialEntity<TaskPipelineEntity> & Record<string, unknown> = {};

    if (isDefined(input.name)) {
      patch.name = input.name.trim();
    }

    if (isDefined(input.color)) {
      patch.color = input.color;
    }

    if (isDefined(input.labels)) {
      const seen = new Set<string>();

      patch.labels = input.labels
        .map((label) => ({ name: label.name.trim(), color: label.color }))
        .filter((label) => {
          const key = label.name.toLowerCase();

          if (label.name.length === 0 || seen.has(key)) {
            return false;
          }

          seen.add(key);

          return true;
        });
    }

    if (Object.keys(patch).length > 0) {
      await this.pipelineRepository.update(actor.workspaceId, { id: pipelineId }, patch);
    }

    return this.getPipeline(actor, pipelineId);
  }

  async deletePipeline(actor: Actor, pipelineId: string): Promise<boolean> {
    await this.accessService.getAccessOrThrow({ ...actor, pipelineId, requireAdmin: true });

    // Las conexiones de Fathom se desconectan antes (lo hace el resolver con
    // FathomConnectionsService); aquí solo se borra en cascada.
    await this.pipelineRepository.delete(actor.workspaceId, { id: pipelineId });

    return true;
  }

  async saveStages(
    actor: Actor,
    pipelineId: string,
    stages: TaskPipelineStageInput[],
    fallbackStageId: string | null | undefined,
  ): Promise<TaskPipelineDTO> {
    await this.accessService.getAccessOrThrow({ ...actor, pipelineId, requireAdmin: true });

    if (stages.length === 0) {
      throw new UserInputError('A pipeline needs at least one stage');
    }

    const existing = await this.stageRepository.find(actor.workspaceId, {
      where: { pipelineId },
    });
    const existingIds = new Set(existing.map((stage) => stage.id));

    for (const stage of stages) {
      if (isDefined(stage.id) && !existingIds.has(stage.id)) {
        throw new UserInputError('Unknown stage in this pipeline');
      }
    }

    await this.coreDataSource.transaction(async (manager) => {
      const keptIds: string[] = [];

      for (const [index, stage] of stages.entries()) {
        if (isDefined(stage.id)) {
          await manager.update(
            TaskPipelineStageEntity,
            { id: stage.id, workspaceId: actor.workspaceId },
            {
              name: stage.name.trim(),
              color: stage.color,
              isDone: stage.isDone ?? false,
              position: index * POSITION_STEP,
            },
          );
          keptIds.push(stage.id);
        } else {
          const created = await manager.save(
            manager.create(TaskPipelineStageEntity, {
              workspaceId: actor.workspaceId,
              pipelineId,
              name: stage.name.trim(),
              color: stage.color,
              isDone: stage.isDone ?? false,
              position: index * POSITION_STEP,
            }),
          );

          keptIds.push(created.id);
        }
      }

      const removedIds = existing
        .map((stage) => stage.id)
        .filter((stageId) => !keptIds.includes(stageId));

      if (removedIds.length > 0) {
        // Las tareas de un stage borrado no se pierden: pasan al stage elegido
        // (o al primero) al final de la columna.
        const targetStageId =
          isDefined(fallbackStageId) && keptIds.includes(fallbackStageId)
            ? fallbackStageId
            : keptIds[0];

        const maxRow = await manager
          .createQueryBuilder(TaskPipelineTaskEntity, 'task')
          .select('COALESCE(MAX(task.position), 0)', 'max')
          .where('task.stageId = :stageId', { stageId: targetStageId })
          .getRawOne<{ max: number }>();

        const tasksToMove = await manager.find(TaskPipelineTaskEntity, {
          where: { pipelineId, stageId: In(removedIds), workspaceId: actor.workspaceId },
          order: { position: 'ASC' },
        });

        let position = Number(maxRow?.max ?? 0);

        for (const task of tasksToMove) {
          position += POSITION_STEP;
          await manager.update(
            TaskPipelineTaskEntity,
            { id: task.id },
            { stageId: targetStageId, position },
          );
        }

        await manager.delete(TaskPipelineStageEntity, {
          id: In(removedIds),
          workspaceId: actor.workspaceId,
        });
      }
    });

    return this.getPipeline(actor, pipelineId);
  }

  // ------------------------------------------------------------------ members

  async addMember(
    actor: Actor,
    pipelineId: string,
    workspaceMemberId: string,
    role: TaskPipelineMemberRole,
  ): Promise<TaskPipelineDTO> {
    await this.accessService.getAccessOrThrow({ ...actor, pipelineId, requireAdmin: true });

    const exists = await this.workspaceMembersService.exists(actor.workspaceId, workspaceMemberId);

    if (!exists) {
      throw new UserInputError('That person is not a member of this workspace');
    }

    const current = await this.memberRepository.findOne(actor.workspaceId, {
      where: { pipelineId, workspaceMemberId },
    });

    if (isDefined(current)) {
      await this.memberRepository.update(actor.workspaceId, { id: current.id }, { role });
    } else {
      await this.memberRepository.insert(actor.workspaceId, {
        pipelineId,
        workspaceMemberId,
        role,
        aliases: [],
      });
    }

    return this.getPipeline(actor, pipelineId);
  }

  async updateMember(
    actor: Actor,
    pipelineId: string,
    workspaceMemberId: string,
    patch: { role?: TaskPipelineMemberRole | null; aliases?: string[] | null },
  ): Promise<TaskPipelineDTO> {
    const actorMemberId = this.requireMember(actor);
    const { isAdmin } = await this.accessService.getAccessOrThrow({ ...actor, pipelineId });

    // Cada quien puede editar sus propios alias; el rol y los alias de otros, solo admins.
    const isSelf = actorMemberId === workspaceMemberId;

    if (!isAdmin && (!isSelf || isDefined(patch.role))) {
      throw new ForbiddenError('Only admins of this pipeline can do that');
    }

    const target = await this.memberRepository.findOne(actor.workspaceId, {
      where: { pipelineId, workspaceMemberId },
    });

    if (!isDefined(target)) {
      throw new NotFoundError('Member not found in this pipeline');
    }

    const update: QueryDeepPartialEntity<TaskPipelineMemberEntity> & Record<string, unknown> = {};

    if (isDefined(patch.role) && patch.role !== target.role) {
      if (target.role === 'ADMIN' && patch.role !== 'ADMIN') {
        await this.assertAnotherAdminRemains(actor.workspaceId, pipelineId, workspaceMemberId);
      }

      update.role = patch.role;
    }

    if (isDefined(patch.aliases)) {
      update.aliases = [
        ...new Set(
          patch.aliases.map((alias) => alias.trim()).filter((alias) => alias.length > 0),
        ),
      ].slice(0, 30);
    }

    if (Object.keys(update).length > 0) {
      await this.memberRepository.update(actor.workspaceId, { id: target.id }, update);
    }

    return this.getPipeline(actor, pipelineId);
  }

  async removeMember(
    actor: Actor,
    pipelineId: string,
    workspaceMemberId: string,
  ): Promise<boolean> {
    const actorMemberId = this.requireMember(actor);
    const { isAdmin } = await this.accessService.getAccessOrThrow({ ...actor, pipelineId });

    // Salirse uno mismo siempre se puede (si no es el último admin); sacar a otros, solo admins.
    if (!isAdmin && actorMemberId !== workspaceMemberId) {
      throw new ForbiddenError('Only admins of this pipeline can do that');
    }

    const target = await this.memberRepository.findOne(actor.workspaceId, {
      where: { pipelineId, workspaceMemberId },
    });

    if (!isDefined(target)) {
      return true;
    }

    if (target.role === 'ADMIN') {
      await this.assertAnotherAdminRemains(actor.workspaceId, pipelineId, workspaceMemberId);
    }

    await this.memberRepository.delete(actor.workspaceId, { id: target.id });

    // Sus tareas en este tablero quedan sin asignar (y marcadas para reasignar).
    await this.taskRepository.update(
      actor.workspaceId,
      { pipelineId, assigneeWorkspaceMemberId: workspaceMemberId },
      { assigneeWorkspaceMemberId: null, needsAssignment: true },
    );

    return true;
  }

  // -------------------------------------------------------------------- tasks

  async listTasks(
    actor: Actor,
    pipelineId: string,
    includeArchived: boolean,
  ): Promise<TaskPipelineTaskDTO[]> {
    const { pipeline } = await this.accessService.getAccessOrThrow({ ...actor, pipelineId });

    const tasks = await this.taskRepository.find(actor.workspaceId, {
      where: includeArchived ? { pipelineId } : { pipelineId, archivedAt: IsNull() },
      order: { position: 'ASC', createdAt: 'ASC' },
    });

    return this.toTaskDTOs(actor.workspaceId, tasks, new Map([[pipeline.id, pipeline.name]]));
  }

  // Todas mis tareas abiertas de todos mis tableros.
  async listMyTasks(actor: Actor): Promise<TaskPipelineTaskDTO[]> {
    const workspaceMemberId = this.requireMember(actor);
    const memberships = await this.accessService.listMemberships(
      actor.workspaceId,
      workspaceMemberId,
    );

    if (memberships.length === 0) {
      return [];
    }

    const pipelines = await this.pipelineRepository.find(actor.workspaceId, {
      where: {
        id: In(memberships.map((membership) => membership.pipelineId)),
        archivedAt: IsNull(),
      },
    });

    if (pipelines.length === 0) {
      return [];
    }

    const tasks = await this.taskRepository.find(actor.workspaceId, {
      where: {
        pipelineId: In(pipelines.map((pipeline) => pipeline.id)),
        assigneeWorkspaceMemberId: workspaceMemberId,
        archivedAt: IsNull(),
        completedAt: IsNull(),
      },
      order: { dueAt: 'ASC', createdAt: 'ASC' },
    });

    return this.toTaskDTOs(
      actor.workspaceId,
      tasks,
      new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name])),
    );
  }

  async getTask(actor: Actor, taskId: string): Promise<TaskPipelineTaskDTO> {
    const { task, pipeline } = await this.getTaskWithAccess(actor, taskId);
    const [dto] = await this.toTaskDTOs(
      actor.workspaceId,
      [task],
      new Map([[pipeline.id, pipeline.name]]),
    );

    return dto;
  }

  async createTask(actor: Actor, input: CreateTaskPipelineTaskInput): Promise<TaskPipelineTaskDTO> {
    const workspaceMemberId = this.requireMember(actor);
    const { pipeline } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId: input.pipelineId,
    });

    const stageId = await this.resolveStageId(actor.workspaceId, pipeline.id, input.stageId);

    if (isDefined(input.assigneeWorkspaceMemberId)) {
      await this.assertPipelineMember(actor.workspaceId, pipeline.id, input.assigneeWorkspaceMemberId);
    }

    const stage = await this.stageRepository.findOneOrFail(actor.workspaceId, {
      where: { id: stageId },
    });

    const created = await this.taskRepository.insertAndReturnOne(actor.workspaceId, {
      pipelineId: pipeline.id,
      stageId,
      position: await this.nextPosition(actor.workspaceId, stageId),
      title: input.title.trim(),
      body: input.body ?? '',
      assigneeWorkspaceMemberId: input.assigneeWorkspaceMemberId ?? null,
      dueAt: input.dueAt ?? null,
      priority: (input.priority as TaskPipelineTaskPriority | null | undefined) ?? null,
      labels: this.sanitizeLabels(input.labels),
      checklist: [],
      relatedRecords: input.relatedRecords ?? [],
      source: input.source === 'EMAIL' ? 'EMAIL' : 'MANUAL',
      sourceLink: input.sourceLink ?? null,
      meetingId: null,
      externalKey: null,
      originalText: null,
      needsAssignment: false,
      createdByWorkspaceMemberId: workspaceMemberId,
      completedAt: stage.isDone ? new Date() : null,
      archivedAt: null,
    });

    await this.logActivity(actor.workspaceId, created.id, workspaceMemberId, 'created this task');

    if (
      isDefined(created.assigneeWorkspaceMemberId) &&
      created.assigneeWorkspaceMemberId !== workspaceMemberId
    ) {
      await this.notificationService.notifyAssigned({
        workspaceId: actor.workspaceId,
        task: created,
        pipelineName: pipeline.name,
        assignedByWorkspaceMemberId: workspaceMemberId,
      });
    }

    return this.getTask(actor, created.id);
  }

  async updateTask(
    actor: Actor,
    taskId: string,
    input: UpdateTaskPipelineTaskInput,
  ): Promise<TaskPipelineTaskDTO> {
    const workspaceMemberId = this.requireMember(actor);
    const { task, pipeline } = await this.getTaskWithAccess(actor, taskId);

    const patch: QueryDeepPartialEntity<TaskPipelineTaskEntity> & Record<string, unknown> = {};
    const activity: string[] = [];

    if (isDefined(input.title) && input.title.trim() !== task.title) {
      patch.title = input.title.trim();
    }

    if (isDefined(input.body) && input.body !== task.body) {
      patch.body = input.body;
    }

    let newAssignee: string | null | undefined;

    if (input.clearAssignee === true && isDefined(task.assigneeWorkspaceMemberId)) {
      newAssignee = null;
    } else if (
      isDefined(input.assigneeWorkspaceMemberId) &&
      input.assigneeWorkspaceMemberId !== task.assigneeWorkspaceMemberId
    ) {
      await this.assertPipelineMember(actor.workspaceId, pipeline.id, input.assigneeWorkspaceMemberId);
      newAssignee = input.assigneeWorkspaceMemberId;
    }

    if (newAssignee !== undefined) {
      patch.assigneeWorkspaceMemberId = newAssignee;
      patch.needsAssignment = false;

      const [member] = isDefined(newAssignee)
        ? await this.workspaceMembersService.findMembers(actor.workspaceId, [newAssignee])
        : [];

      activity.push(
        isDefined(member)
          ? `assigned this to ${[member.firstName, member.lastName].filter(Boolean).join(' ')}`
          : 'removed the assignee',
      );
    }

    if (input.clearDueAt === true) {
      patch.dueAt = null;
    } else if (isDefined(input.dueAt)) {
      patch.dueAt = input.dueAt;
    }

    if (isDefined(input.priority)) {
      patch.priority =
        input.priority === 'NONE' ? null : (input.priority as TaskPipelineTaskPriority);
    }

    if (isDefined(input.labels)) {
      patch.labels = this.sanitizeLabels(input.labels);
    }

    if (isDefined(input.checklist)) {
      patch.checklist = input.checklist.map((item) => ({
        id: item.id,
        text: item.text.trim(),
        done: item.done,
      }));
    }

    if (isDefined(input.relatedRecords)) {
      patch.relatedRecords = input.relatedRecords;
    }

    if (input.sourceLink !== undefined && input.sourceLink !== task.sourceLink) {
      patch.sourceLink = input.sourceLink;
    }

    if (Object.keys(patch).length > 0) {
      await this.taskRepository.update(actor.workspaceId, { id: task.id }, patch);
    }

    for (const line of activity) {
      await this.logActivity(actor.workspaceId, task.id, workspaceMemberId, line);
    }

    if (isDefined(newAssignee) && newAssignee !== workspaceMemberId) {
      await this.notificationService.notifyAssigned({
        workspaceId: actor.workspaceId,
        task: {
          id: task.id,
          pipelineId: task.pipelineId,
          title: (patch.title as string | undefined) ?? task.title,
          body: (patch.body as string | undefined) ?? task.body,
          dueAt: patch.dueAt !== undefined ? (patch.dueAt as Date | null) : task.dueAt,
          assigneeWorkspaceMemberId: newAssignee,
        },
        pipelineName: pipeline.name,
        assignedByWorkspaceMemberId: workspaceMemberId,
      });
    }

    return this.getTask(actor, task.id);
  }

  async moveTask(actor: Actor, input: MoveTaskPipelineTaskInput): Promise<TaskPipelineTaskDTO> {
    const workspaceMemberId = this.requireMember(actor);
    const { task } = await this.getTaskWithAccess(actor, input.taskId);

    const targetStage = await this.stageRepository.findOne(actor.workspaceId, {
      where: { id: input.stageId, pipelineId: task.pipelineId },
    });

    if (!isDefined(targetStage)) {
      throw new UserInputError('That stage does not belong to this pipeline');
    }

    const position = isDefined(input.position)
      ? input.position
      : await this.nextPosition(actor.workspaceId, targetStage.id);

    const patch: QueryDeepPartialEntity<TaskPipelineTaskEntity> & Record<string, unknown> = { stageId: targetStage.id, position };

    if (targetStage.isDone && !isDefined(task.completedAt)) {
      patch.completedAt = new Date();
    }

    if (!targetStage.isDone && isDefined(task.completedAt)) {
      patch.completedAt = null;
    }

    await this.taskRepository.update(actor.workspaceId, { id: task.id }, patch);

    if (targetStage.id !== task.stageId) {
      await this.logActivity(
        actor.workspaceId,
        task.id,
        workspaceMemberId,
        `moved this to ${targetStage.name}`,
      );
    }

    return this.getTask(actor, task.id);
  }

  async setTaskArchived(actor: Actor, taskId: string, archived: boolean): Promise<TaskPipelineTaskDTO> {
    const workspaceMemberId = this.requireMember(actor);
    const { task } = await this.getTaskWithAccess(actor, taskId);

    await this.taskRepository.update(
      actor.workspaceId,
      { id: task.id },
      { archivedAt: archived ? new Date() : null },
    );
    await this.logActivity(
      actor.workspaceId,
      task.id,
      workspaceMemberId,
      archived ? 'archived this task' : 'restored this task',
    );

    return this.getTask(actor, task.id);
  }

  async deleteTask(actor: Actor, taskId: string): Promise<boolean> {
    const workspaceMemberId = this.requireMember(actor);
    const { task, isAdmin } = await this.getTaskWithAccess(actor, taskId);

    // Borrar para siempre: admins del tablero o quien la creó.
    if (!isAdmin && task.createdByWorkspaceMemberId !== workspaceMemberId) {
      throw new ForbiddenError('Only admins of this pipeline or the creator can delete a task');
    }

    await this.taskRepository.delete(actor.workspaceId, { id: task.id });

    return true;
  }

  // ----------------------------------------------------------------- comments

  async listComments(actor: Actor, taskId: string): Promise<TaskPipelineTaskCommentDTO[]> {
    await this.getTaskWithAccess(actor, taskId);

    const comments = await this.commentRepository.find(actor.workspaceId, {
      where: { taskId },
      order: { createdAt: 'ASC' },
    });

    return comments.map((comment) => this.toCommentDTO(comment));
  }

  async addComment(actor: Actor, taskId: string, body: string): Promise<TaskPipelineTaskCommentDTO> {
    const workspaceMemberId = this.requireMember(actor);

    await this.getTaskWithAccess(actor, taskId);

    const trimmed = body.trim();

    if (trimmed.length === 0) {
      throw new UserInputError('Comment cannot be empty');
    }

    const comment = await this.commentRepository.insertAndReturnOne(actor.workspaceId, {
      taskId,
      authorWorkspaceMemberId: workspaceMemberId,
      kind: 'COMMENT',
      body: trimmed,
    });

    // Toca updatedAt de la tarea para que "actividad reciente" la refleje.
    await this.taskRepository.update(actor.workspaceId, { id: taskId }, { updatedAt: new Date() });

    return this.toCommentDTO(comment);
  }

  async updateComment(
    actor: Actor,
    commentId: string,
    body: string,
  ): Promise<TaskPipelineTaskCommentDTO> {
    const comment = await this.getOwnComment(actor, commentId);
    const trimmed = body.trim();

    if (trimmed.length === 0) {
      throw new UserInputError('Comment cannot be empty');
    }

    await this.commentRepository.update(actor.workspaceId, { id: comment.id }, { body: trimmed });

    return this.toCommentDTO({ ...comment, body: trimmed, updatedAt: new Date() });
  }

  async deleteComment(actor: Actor, commentId: string): Promise<boolean> {
    const comment = await this.getOwnComment(actor, commentId);

    await this.commentRepository.delete(actor.workspaceId, { id: comment.id });

    return true;
  }

  // ------------------------------------------------------------------ helpers

  async logActivity(
    workspaceId: string,
    taskId: string,
    workspaceMemberId: string | null,
    body: string,
  ): Promise<void> {
    await this.commentRepository.insert(workspaceId, {
      taskId,
      authorWorkspaceMemberId: workspaceMemberId,
      kind: 'ACTIVITY',
      body,
    });
  }

  async nextPosition(workspaceId: string, stageId: string): Promise<number> {
    const max = await this.taskRepository.maximum(workspaceId, 'position', { stageId });

    return (max ?? 0) + POSITION_STEP;
  }

  async resolveStageId(
    workspaceId: string,
    pipelineId: string,
    stageId: string | null | undefined,
  ): Promise<string> {
    if (isDefined(stageId)) {
      const stage = await this.stageRepository.findOne(workspaceId, {
        where: { id: stageId, pipelineId },
      });

      if (!isDefined(stage)) {
        throw new UserInputError('That stage does not belong to this pipeline');
      }

      return stage.id;
    }

    const [first] = await this.stageRepository.find(workspaceId, {
      where: { pipelineId },
      order: { position: 'ASC' },
      take: 1,
    });

    if (!isDefined(first)) {
      throw new UserInputError('This pipeline has no stages');
    }

    return first.id;
  }

  private requireMember(actor: Actor): string {
    if (!isDefined(actor.workspaceMemberId)) {
      throw new ForbiddenError('A workspace member is required');
    }

    return actor.workspaceMemberId;
  }

  private sanitizeLabels(labels: string[] | null | undefined): string[] {
    return [
      ...new Set((labels ?? []).map((label) => label.trim()).filter((label) => label.length > 0)),
    ].slice(0, 20);
  }

  private async assertPipelineMember(
    workspaceId: string,
    pipelineId: string,
    workspaceMemberId: string,
  ): Promise<void> {
    const member = await this.memberRepository.findOne(workspaceId, {
      where: { pipelineId, workspaceMemberId },
    });

    if (!isDefined(member)) {
      throw new UserInputError('Tasks can only be assigned to members of this pipeline');
    }
  }

  private async assertAnotherAdminRemains(
    workspaceId: string,
    pipelineId: string,
    leavingWorkspaceMemberId: string,
  ): Promise<void> {
    const admins = await this.memberRepository.find(workspaceId, {
      where: { pipelineId, role: 'ADMIN' },
    });

    if (admins.every((admin) => admin.workspaceMemberId === leavingWorkspaceMemberId)) {
      throw new UserInputError('A pipeline needs at least one admin. Promote someone else first.');
    }
  }

  private async getTaskWithAccess(actor: Actor, taskId: string) {
    const task = await this.taskRepository.findOne(actor.workspaceId, { where: { id: taskId } });

    if (!isDefined(task)) {
      throw new NotFoundError('Task not found');
    }

    const access = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId: task.pipelineId,
    });

    return { task, ...access };
  }

  private async getOwnComment(actor: Actor, commentId: string) {
    const workspaceMemberId = this.requireMember(actor);
    const comment = await this.commentRepository.findOne(actor.workspaceId, {
      where: { id: commentId },
    });

    if (!isDefined(comment)) {
      throw new NotFoundError('Comment not found');
    }

    await this.getTaskWithAccess(actor, comment.taskId);

    if (comment.kind !== 'COMMENT' || comment.authorWorkspaceMemberId !== workspaceMemberId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    return comment;
  }

  private toCommentDTO(comment: TaskPipelineTaskCommentEntity): TaskPipelineTaskCommentDTO {
    return {
      id: comment.id,
      taskId: comment.taskId,
      authorWorkspaceMemberId: comment.authorWorkspaceMemberId,
      kind: comment.kind,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private async toPipelineDTOs(
    workspaceId: string,
    pipelines: TaskPipelineEntity[],
    myMemberships: TaskPipelineMemberEntity[],
  ): Promise<TaskPipelineDTO[]> {
    if (pipelines.length === 0) {
      return [];
    }

    const pipelineIds = pipelines.map((pipeline) => pipeline.id);

    const [stages, members, connections, openCounts] = await Promise.all([
      this.stageRepository.find(workspaceId, {
        where: { pipelineId: In(pipelineIds) },
        order: { position: 'ASC' },
      }),
      this.memberRepository.find(workspaceId, {
        where: { pipelineId: In(pipelineIds) },
        order: { createdAt: 'ASC' },
      }),
      this.connectionRepository.find(workspaceId, {
        where: { pipelineId: In(pipelineIds) },
        order: { createdAt: 'ASC' },
      }),
      this.coreDataSource.query(
        `SELECT "pipelineId", COUNT(*)::int AS "count"
           FROM "core"."taskPipelineTask"
          WHERE "workspaceId" = $1 AND "pipelineId" = ANY($2)
            AND "archivedAt" IS NULL AND "completedAt" IS NULL
          GROUP BY "pipelineId"`,
        [workspaceId, pipelineIds],
      ) as Promise<{ pipelineId: string; count: number }[]>,
    ]);

    const roleByPipeline = new Map(
      myMemberships.map((membership) => [membership.pipelineId, membership.role]),
    );
    const countByPipeline = new Map(openCounts.map((row) => [row.pipelineId, row.count]));

    return pipelines.map((pipeline) => {
      const myRole = roleByPipeline.get(pipeline.id) ?? 'MEMBER';

      return {
        id: pipeline.id,
        name: pipeline.name,
        color: pipeline.color,
        visibility: pipeline.visibility,
        ownerWorkspaceMemberId: pipeline.ownerWorkspaceMemberId,
        myRole,
        labels: pipeline.labels ?? [],
        stages: stages
          .filter((stage) => stage.pipelineId === pipeline.id)
          .map((stage) => ({
            id: stage.id,
            name: stage.name,
            color: stage.color,
            position: stage.position,
            isDone: stage.isDone,
          })),
        members: members
          .filter((member) => member.pipelineId === pipeline.id)
          .map((member) => ({
            workspaceMemberId: member.workspaceMemberId,
            role: member.role,
            aliases: member.aliases ?? [],
          })),
        fathomConnections:
          myRole === 'ADMIN'
            ? connections
                .filter((connection) => connection.pipelineId === pipeline.id)
                .map((connection) => this.toConnectionDTO(connection))
            : [],
        openTaskCount: countByPipeline.get(pipeline.id) ?? 0,
        createdAt: pipeline.createdAt,
      };
    });
  }

  toConnectionDTO(connection: FathomConnectionEntity): TaskPipelineFathomConnectionDTO {
    return {
      id: connection.id,
      label: connection.label,
      apiKeyHint: connection.apiKeyHint,
      fathomUserEmail: connection.fathomUserEmail,
      status: connection.status,
      lastError: connection.lastError,
      lastSyncAt: connection.lastSyncAt,
      lastMeetingAt: connection.lastMeetingAt,
      hasWebhook: isDefined(connection.fathomWebhookId),
      connectedByWorkspaceMemberId: connection.connectedByWorkspaceMemberId,
    };
  }

  async toTaskDTOs(
    workspaceId: string,
    tasks: TaskPipelineTaskEntity[],
    pipelineNames: Map<string, string>,
  ): Promise<TaskPipelineTaskDTO[]> {
    if (tasks.length === 0) {
      return [];
    }

    const taskIds = tasks.map((task) => task.id);
    const meetingIds = [...new Set(tasks.map((task) => task.meetingId).filter(isDefined))];

    const [commentCounts, meetings] = await Promise.all([
      this.coreDataSource.query(
        `SELECT "taskId", COUNT(*)::int AS "count"
           FROM "core"."taskPipelineTaskComment"
          WHERE "workspaceId" = $1 AND "taskId" = ANY($2) AND "kind" = 'COMMENT'
          GROUP BY "taskId"`,
        [workspaceId, taskIds],
      ) as Promise<{ taskId: string; count: number }[]>,
      meetingIds.length > 0
        ? this.meetingRepository.find(workspaceId, {
            where: { id: In(meetingIds) },
            select: { id: true, title: true, startedAt: true },
          })
        : Promise.resolve([] as MeetingEntity[]),
    ]);

    const countByTask = new Map(commentCounts.map((row) => [row.taskId, row.count]));
    const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));

    return tasks.map((task) => {
      const meeting = isDefined(task.meetingId) ? meetingById.get(task.meetingId) : undefined;

      return {
        id: task.id,
        pipelineId: task.pipelineId,
        pipelineName: pipelineNames.get(task.pipelineId) ?? '',
        stageId: task.stageId,
        position: task.position,
        title: task.title,
        body: task.body,
        assigneeWorkspaceMemberId: task.assigneeWorkspaceMemberId,
        dueAt: task.dueAt,
        priority: task.priority,
        labels: task.labels ?? [],
        checklist: task.checklist ?? [],
        relatedRecords: task.relatedRecords ?? [],
        source: task.source,
        sourceLink: task.sourceLink,
        meeting: isDefined(meeting)
          ? { id: meeting.id, title: meeting.title, startedAt: meeting.startedAt }
          : null,
        originalText: task.originalText,
        needsAssignment: task.needsAssignment,
        createdByWorkspaceMemberId: task.createdByWorkspaceMemberId,
        completedAt: task.completedAt,
        archivedAt: task.archivedAt,
        commentCount: countByTask.get(task.id) ?? 0,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    });
  }
}
