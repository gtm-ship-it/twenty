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
  type TaskPipelineChecklist,
  TaskPipelineTaskEntity,
  type TaskPipelineTaskPriority,
} from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task.entity';
import { type TaskPipelineAttachmentPurpose } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task-attachment.entity';
import { TaskPipelineAttachmentsService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-attachments.service';
import {
  mergeIdList,
  mergeTaskChecklists,
} from 'src/engine/core-modules/task-pipelines/utils/merge-task-checklists.util';
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

export type TaskActivityEvent =
  | { type: 'created' }
  | { type: 'moved'; stage: string }
  | { type: 'assigned'; name: string }
  | { type: 'unassigned' }
  | { type: 'renamed' }
  | { type: 'description' }
  | { type: 'due'; date: string }
  | { type: 'dueCleared' }
  | { type: 'priority'; priority: string }
  | { type: 'priorityCleared' }
  | { type: 'labelAdded'; label: string }
  | { type: 'labelRemoved'; label: string }
  | { type: 'checklistAdded'; text: string }
  | { type: 'checklistDone'; text: string }
  | { type: 'checklistUndone'; text: string }
  | { type: 'memberAdded'; name: string }
  | { type: 'memberRemoved'; name: string }
  | { type: 'start'; date: string }
  | { type: 'startCleared' }
  | { type: 'checklistCreated'; title: string }
  | { type: 'checklistRemoved'; title: string }
  | { type: 'pointAssigned'; text: string; name: string }
  | { type: 'attachmentAdded'; name: string }
  | { type: 'attachmentRemoved'; name: string }
  | { type: 'coverSet' }
  | { type: 'coverCleared' }
  | { type: 'archived' }
  | { type: 'restored' }
  | { type: 'fromMeeting'; resolution: string }
  | { type: 'fromMeetingUnassigned' };

type Actor = { workspaceId: string; workspaceMemberId: string | undefined };

// Tarjetas creadas antes del 29-sep-2026 solo tienen asignado único y
// checklist simple: se leen como 1 miembro y 1 checklist.
export const getTaskMemberIds = (task: {
  memberWorkspaceMemberIds?: string[] | null;
  assigneeWorkspaceMemberId: string | null;
}): string[] => {
  const members = task.memberWorkspaceMemberIds ?? [];

  if (members.length > 0) {
    return members;
  }

  return isDefined(task.assigneeWorkspaceMemberId)
    ? [task.assigneeWorkspaceMemberId]
    : [];
};

export const getTaskChecklists = (task: {
  checklists?: TaskPipelineChecklist[] | null;
  checklist?: { id: string; text: string; done: boolean }[] | null;
}): TaskPipelineChecklist[] => {
  const checklists = task.checklists ?? [];

  if (checklists.length > 0 || (task.checklist ?? []).length === 0) {
    return checklists;
  }

  return [
    {
      id: 'legacy',
      title: 'Checklist',
      items: (task.checklist ?? []).map((item) => ({
        id: item.id,
        text: item.text,
        done: item.done,
        assigneeWorkspaceMemberId: null,
        dueAt: null,
        completedAt: null,
      })),
    },
  ];
};

const uniqueIds = (ids: string[]) => [...new Set(ids)];

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
    private readonly attachmentsService: TaskPipelineAttachmentsService,
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

  async getPipeline(
    actor: Actor,
    pipelineId: string,
  ): Promise<TaskPipelineDTO> {
    const { pipeline, membership } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
    });

    const [dto] = await this.toPipelineDTOs(
      actor.workspaceId,
      [pipeline],
      [membership],
    );

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

    const pipelineId = await this.coreDataSource.transaction(
      async (manager) => {
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
      },
    );

    return this.getPipeline(actor, pipelineId);
  }

  async updatePipeline(
    actor: Actor,
    pipelineId: string,
    input: UpdateTaskPipelineInput,
  ): Promise<TaskPipelineDTO> {
    await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
      requireAdmin: true,
    });

    const patch: QueryDeepPartialEntity<TaskPipelineEntity> &
      Record<string, unknown> = {};

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
      await this.pipelineRepository.update(
        actor.workspaceId,
        { id: pipelineId },
        patch,
      );
    }

    return this.getPipeline(actor, pipelineId);
  }

  async deletePipeline(actor: Actor, pipelineId: string): Promise<boolean> {
    await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
      requireAdmin: true,
    });

    // Las conexiones de Fathom se desconectan antes (lo hace el resolver con
    // FathomConnectionsService); aquí solo se borra en cascada.
    await this.pipelineRepository.delete(actor.workspaceId, { id: pipelineId });

    // Reuniones: se quita el tablero y se borran las que ya no alimentan a
    // ninguno (su transcripción no debe quedar guardada sin dueño).
    await this.coreDataSource.query(
      `UPDATE "core"."meeting" SET "pipelineIds" = "pipelineIds" - $2::text
        WHERE "workspaceId" = $1 AND "pipelineIds" ? $2::text`,
      [actor.workspaceId, pipelineId],
    );
    await this.coreDataSource.query(
      `DELETE FROM "core"."meeting" WHERE "workspaceId" = $1 AND jsonb_array_length("pipelineIds") = 0`,
      [actor.workspaceId],
    );

    return true;
  }

  async saveStages(
    actor: Actor,
    pipelineId: string,
    stages: TaskPipelineStageInput[],
    fallbackStageId: string | null | undefined,
  ): Promise<TaskPipelineDTO> {
    await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
      requireAdmin: true,
    });

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
          where: {
            pipelineId,
            stageId: In(removedIds),
            workspaceId: actor.workspaceId,
          },
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
    const { pipeline } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
      requireAdmin: true,
    });

    // Tablero personal: solo su dueño invita, y los invitados nunca administran
    // (así nadie puede sacar al dueño de su propio tablero).
    if (pipeline.visibility === 'PERSONAL') {
      if (actor.workspaceMemberId !== pipeline.ownerWorkspaceMemberId) {
        throw new ForbiddenError(
          'Only the owner can invite people to a personal pipeline',
        );
      }

      if (
        role === 'ADMIN' &&
        workspaceMemberId !== pipeline.ownerWorkspaceMemberId
      ) {
        throw new UserInputError(
          'People invited to a personal pipeline can only be members',
        );
      }
    }

    if (
      workspaceMemberId === pipeline.ownerWorkspaceMemberId &&
      role !== 'ADMIN'
    ) {
      throw new UserInputError('The owner of a pipeline is always an admin');
    }

    const exists = await this.workspaceMembersService.exists(
      actor.workspaceId,
      workspaceMemberId,
    );

    if (!exists) {
      throw new UserInputError('That person is not a member of this workspace');
    }

    const current = await this.memberRepository.findOne(actor.workspaceId, {
      where: { pipelineId, workspaceMemberId },
    });

    if (isDefined(current)) {
      if (current.role === 'ADMIN' && role !== 'ADMIN') {
        await this.assertAnotherAdminRemains(
          actor.workspaceId,
          pipelineId,
          workspaceMemberId,
        );
      }

      await this.memberRepository.update(
        actor.workspaceId,
        { id: current.id },
        { role },
      );
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
    const { isAdmin, pipeline } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
    });

    if (
      isDefined(patch.role) &&
      patch.role !== 'ADMIN' &&
      workspaceMemberId === pipeline.ownerWorkspaceMemberId
    ) {
      throw new UserInputError('The owner of a pipeline is always an admin');
    }

    if (
      isDefined(patch.role) &&
      patch.role === 'ADMIN' &&
      pipeline.visibility === 'PERSONAL' &&
      workspaceMemberId !== pipeline.ownerWorkspaceMemberId
    ) {
      throw new UserInputError(
        'People invited to a personal pipeline can only be members',
      );
    }

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

    const update: QueryDeepPartialEntity<TaskPipelineMemberEntity> &
      Record<string, unknown> = {};

    if (isDefined(patch.role) && patch.role !== target.role) {
      if (target.role === 'ADMIN' && patch.role !== 'ADMIN') {
        await this.assertAnotherAdminRemains(
          actor.workspaceId,
          pipelineId,
          workspaceMemberId,
        );
      }

      update.role = patch.role;
    }

    if (isDefined(patch.aliases)) {
      await this.assertAliasesDoNotImpersonate(
        actor.workspaceId,
        pipelineId,
        workspaceMemberId,
        patch.aliases,
      );
      update.aliases = [
        ...new Set(
          patch.aliases
            .map((alias) => alias.trim())
            .filter((alias) => alias.length > 0),
        ),
      ].slice(0, 30);
    }

    if (Object.keys(update).length > 0) {
      await this.memberRepository.update(
        actor.workspaceId,
        { id: target.id },
        update,
      );
    }

    return this.getPipeline(actor, pipelineId);
  }

  async removeMember(
    actor: Actor,
    pipelineId: string,
    workspaceMemberId: string,
  ): Promise<boolean> {
    const actorMemberId = this.requireMember(actor);
    const { isAdmin } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
    });

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

    const pipeline = await this.pipelineRepository.findOneOrFail(
      actor.workspaceId,
      {
        where: { id: pipelineId },
      },
    );

    if (workspaceMemberId === pipeline.ownerWorkspaceMemberId) {
      throw new UserInputError(
        'The owner cannot leave the pipeline. Delete it instead.',
      );
    }

    if (target.role === 'ADMIN') {
      await this.assertAnotherAdminRemains(
        actor.workspaceId,
        pipelineId,
        workspaceMemberId,
      );
    }

    await this.memberRepository.delete(actor.workspaceId, { id: target.id });

    // Sale de sus tarjetas en este tablero (como miembro y como responsable de
    // puntos); las que se quedan sin nadie quedan marcadas para reasignar.
    const tasks = await this.taskRepository.find(actor.workspaceId, {
      where: { pipelineId },
    });

    for (const task of tasks) {
      const members = getTaskMemberIds(task);
      const checklists = getTaskChecklists(task);
      const hasPoint = checklists.some((checklist) =>
        checklist.items.some(
          (item) => item.assigneeWorkspaceMemberId === workspaceMemberId,
        ),
      );

      if (!members.includes(workspaceMemberId) && !hasPoint) {
        continue;
      }

      const nextMembers = members.filter((id) => id !== workspaceMemberId);

      await this.taskRepository.update(
        actor.workspaceId,
        { id: task.id },
        {
          memberWorkspaceMemberIds: nextMembers,
          assigneeWorkspaceMemberId: nextMembers[0] ?? null,
          needsAssignment: nextMembers.length === 0 || task.needsAssignment,
          checklists: checklists.map((checklist) => ({
            ...checklist,
            items: checklist.items.map((item) =>
              item.assigneeWorkspaceMemberId === workspaceMemberId
                ? { ...item, assigneeWorkspaceMemberId: null }
                : item,
            ),
          })),
        },
      );
    }

    return true;
  }

  // -------------------------------------------------------------------- tasks

  async listTasks(
    actor: Actor,
    pipelineId: string,
    includeArchived: boolean,
  ): Promise<TaskPipelineTaskDTO[]> {
    const { pipeline } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId,
    });

    const tasks = await this.taskRepository.find(actor.workspaceId, {
      where: includeArchived
        ? { pipelineId }
        : { pipelineId, archivedAt: IsNull() },
      order: { position: 'ASC', createdAt: 'ASC' },
    });

    return this.toTaskDTOs(
      actor.workspaceId,
      tasks,
      new Map([[pipeline.id, pipeline.name]]),
    );
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

    // Mías = soy miembro de la tarjeta o tengo algún punto de sus checklists.
    const openTasks = await this.taskRepository.find(actor.workspaceId, {
      where: {
        pipelineId: In(pipelines.map((pipeline) => pipeline.id)),
        archivedAt: IsNull(),
        completedAt: IsNull(),
      },
      order: { dueAt: 'ASC', createdAt: 'ASC' },
    });
    const tasks = openTasks.filter(
      (task) =>
        getTaskMemberIds(task).includes(workspaceMemberId) ||
        getTaskChecklists(task).some((checklist) =>
          checklist.items.some(
            (item) => item.assigneeWorkspaceMemberId === workspaceMemberId,
          ),
        ),
    );

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

  async createTask(
    actor: Actor,
    input: CreateTaskPipelineTaskInput,
  ): Promise<TaskPipelineTaskDTO> {
    const workspaceMemberId = this.requireMember(actor);
    const { pipeline } = await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId: input.pipelineId,
    });

    const stageId = await this.resolveStageId(
      actor.workspaceId,
      pipeline.id,
      input.stageId,
    );

    const memberIds = uniqueIds([
      ...(input.memberWorkspaceMemberIds ?? []),
      ...(isDefined(input.assigneeWorkspaceMemberId)
        ? [input.assigneeWorkspaceMemberId]
        : []),
    ]);

    for (const memberId of memberIds) {
      await this.assertPipelineMember(actor.workspaceId, pipeline.id, memberId);
    }

    const stage = await this.stageRepository.findOneOrFail(actor.workspaceId, {
      where: { id: stageId },
    });

    const created = await this.taskRepository.insertAndReturnOne(
      actor.workspaceId,
      {
        pipelineId: pipeline.id,
        stageId,
        position: await this.nextPosition(actor.workspaceId, stageId),
        title: input.title.trim(),
        body: input.body ?? '',
        assigneeWorkspaceMemberId: memberIds[0] ?? null,
        memberWorkspaceMemberIds: memberIds,
        startAt: input.startAt ?? null,
        dueAt: input.dueAt ?? null,
        priority:
          (input.priority as TaskPipelineTaskPriority | null | undefined) ??
          null,
        labels: this.sanitizeLabels(input.labels),
        checklist: [],
        checklists: [],
        coverAttachmentId: null,
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
      },
    );

    await this.logActivity(actor.workspaceId, created.id, workspaceMemberId, {
      type: 'created',
    });

    for (const memberId of memberIds) {
      if (memberId !== workspaceMemberId) {
        void this.notificationService.notifyAssigned({
          workspaceId: actor.workspaceId,
          task: { ...created, assigneeWorkspaceMemberId: memberId },
          pipelineName: pipeline.name,
          assignedByWorkspaceMemberId: workspaceMemberId,
        });
      }
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

    const patch: QueryDeepPartialEntity<TaskPipelineTaskEntity> &
      Record<string, unknown> = {};
    const activity: TaskActivityEvent[] = [];

    if (isDefined(input.title) && input.title.trim() !== task.title) {
      patch.title = input.title.trim();
      activity.push({ type: 'renamed' });
    }

    if (isDefined(input.body) && input.body !== task.body) {
      patch.body = input.body;
      activity.push({ type: 'description' });
    }

    // Miembros: `memberWorkspaceMemberIds` reemplaza la lista; los campos
    // viejos (asignado único) siguen funcionando.
    const previousMembers = getTaskMemberIds(task);
    let nextMembers: string[] | undefined;

    if (isDefined(input.memberWorkspaceMemberIds)) {
      nextMembers = uniqueIds(
        isDefined(input.baseMemberWorkspaceMemberIds)
          ? mergeIdList({
              current: previousMembers,
              base: input.baseMemberWorkspaceMemberIds,
              next: input.memberWorkspaceMemberIds,
            })
          : input.memberWorkspaceMemberIds,
      );
    } else if (input.clearAssignee === true) {
      nextMembers = [];
    } else if (
      isDefined(input.assigneeWorkspaceMemberId) &&
      input.assigneeWorkspaceMemberId !== task.assigneeWorkspaceMemberId
    ) {
      nextMembers = uniqueIds([
        input.assigneeWorkspaceMemberId,
        ...previousMembers.filter(
          (memberId) => memberId !== task.assigneeWorkspaceMemberId,
        ),
      ]);
    }

    const addedMembers =
      nextMembers?.filter((memberId) => !previousMembers.includes(memberId)) ??
      [];
    const removedMembers =
      nextMembers !== undefined
        ? previousMembers.filter((memberId) => !nextMembers?.includes(memberId))
        : [];

    if (
      nextMembers !== undefined &&
      (addedMembers.length > 0 ||
        removedMembers.length > 0 ||
        nextMembers[0] !== task.assigneeWorkspaceMemberId)
    ) {
      for (const memberId of addedMembers) {
        await this.assertPipelineMember(
          actor.workspaceId,
          pipeline.id,
          memberId,
        );
      }

      patch.memberWorkspaceMemberIds = nextMembers;
      patch.assigneeWorkspaceMemberId = nextMembers[0] ?? null;

      if (nextMembers.length > 0) {
        patch.needsAssignment = false;
      }

      const names = await this.memberNames(actor.workspaceId, [
        ...addedMembers,
        ...removedMembers,
      ]);

      addedMembers.forEach((memberId) =>
        activity.push({ type: 'memberAdded', name: names.get(memberId) ?? '' }),
      );
      removedMembers.forEach((memberId) =>
        activity.push({
          type: 'memberRemoved',
          name: names.get(memberId) ?? '',
        }),
      );
    }

    if (input.clearStartAt === true) {
      if (isDefined(task.startAt)) {
        patch.startAt = null;
        activity.push({ type: 'startCleared' });
      }
    } else if (
      isDefined(input.startAt) &&
      new Date(input.startAt).getTime() !== task.startAt?.getTime()
    ) {
      patch.startAt = input.startAt;
      activity.push({
        type: 'start',
        date: new Date(input.startAt).toISOString(),
      });
    }

    if (input.clearDueAt === true) {
      if (isDefined(task.dueAt)) {
        patch.dueAt = null;
        activity.push({ type: 'dueCleared' });
      }
    } else if (
      isDefined(input.dueAt) &&
      new Date(input.dueAt).getTime() !== task.dueAt?.getTime()
    ) {
      patch.dueAt = input.dueAt;
      activity.push({ type: 'due', date: new Date(input.dueAt).toISOString() });
    }

    if (isDefined(input.priority)) {
      const nextPriority =
        input.priority === 'NONE'
          ? null
          : (input.priority as TaskPipelineTaskPriority);

      if (nextPriority !== task.priority) {
        patch.priority = nextPriority;
        activity.push(
          isDefined(nextPriority)
            ? { type: 'priority', priority: nextPriority }
            : { type: 'priorityCleared' },
        );
      }
    }

    if (isDefined(input.labels)) {
      const previousLabels = task.labels ?? [];
      const nextLabels = this.sanitizeLabels(
        isDefined(input.baseLabels)
          ? mergeIdList({
              current: previousLabels,
              base: this.sanitizeLabels(input.baseLabels),
              next: this.sanitizeLabels(input.labels),
            })
          : input.labels,
      );

      patch.labels = nextLabels;
      nextLabels
        .filter((label) => !previousLabels.includes(label))
        .forEach((label) => activity.push({ type: 'labelAdded', label }));
      previousLabels
        .filter((label) => !nextLabels.includes(label))
        .forEach((label) => activity.push({ type: 'labelRemoved', label }));
    }

    if (isDefined(input.checklist)) {
      const nextChecklist = input.checklist.map((item) => ({
        id: item.id,
        text: item.text.trim(),
        done: item.done,
      }));
      const previousById = new Map(
        (task.checklist ?? []).map((item) => [item.id, item]),
      );

      patch.checklist = nextChecklist;

      for (const item of nextChecklist) {
        const previous = previousById.get(item.id);

        if (!isDefined(previous)) {
          activity.push({ type: 'checklistAdded', text: item.text });
        } else if (previous.done !== item.done) {
          activity.push({
            type: item.done ? 'checklistDone' : 'checklistUndone',
            text: item.text,
          });
        }
      }
    }

    const newPointAssignees: string[] = [];

    if (isDefined(input.checklists)) {
      const result = await this.applyChecklists(
        actor.workspaceId,
        pipeline.id,
        task,
        input.checklists,
        input.baseChecklists ?? null,
      );

      patch.checklists = result.checklists;
      activity.push(...result.activity);
      newPointAssignees.push(...result.newAssignees);

      await this.attachmentsService.deleteForChecklistItems(
        actor.workspaceId,
        task.id,
        result.removedItemIds,
      );

      if (result.removedItemIds.length > 0 || result.checklists.length > 0) {
        // la checklist vieja ya quedó migrada a `checklists`
        patch.checklist = [];
      }
    }

    if (input.clearCover === true) {
      if (isDefined(task.coverAttachmentId)) {
        patch.coverAttachmentId = null;
        activity.push({ type: 'coverCleared' });
      }
    } else if (
      isDefined(input.coverAttachmentId) &&
      input.coverAttachmentId !== task.coverAttachmentId
    ) {
      const attachment = await this.attachmentsService.findOne(
        actor.workspaceId,
        input.coverAttachmentId,
      );

      if (
        !isDefined(attachment) ||
        attachment.taskId !== task.id ||
        !attachment.mimeType?.startsWith('image/')
      ) {
        throw new UserInputError(
          'La portada tiene que ser una imagen de esta tarjeta',
        );
      }

      patch.coverAttachmentId = attachment.id;
      activity.push({ type: 'coverSet' });
    }

    if (isDefined(input.relatedRecords)) {
      patch.relatedRecords = input.relatedRecords;
    }

    if (
      input.sourceLink !== undefined &&
      input.sourceLink !== task.sourceLink
    ) {
      patch.sourceLink = input.sourceLink;
    }

    if (Object.keys(patch).length > 0) {
      await this.taskRepository.update(
        actor.workspaceId,
        { id: task.id },
        patch,
      );
    }

    for (const line of activity) {
      await this.logActivity(
        actor.workspaceId,
        task.id,
        workspaceMemberId,
        line,
      );
    }

    const toNotify = uniqueIds([...addedMembers, ...newPointAssignees]).filter(
      (memberId) => memberId !== workspaceMemberId,
    );

    for (const memberId of toNotify) {
      void this.notificationService.notifyAssigned({
        workspaceId: actor.workspaceId,
        task: {
          id: task.id,
          pipelineId: task.pipelineId,
          title: (patch.title as string | undefined) ?? task.title,
          body: (patch.body as string | undefined) ?? task.body,
          dueAt:
            patch.dueAt !== undefined
              ? (patch.dueAt as Date | null)
              : task.dueAt,
          assigneeWorkspaceMemberId: memberId,
        },
        pipelineName: pipeline.name,
        assignedByWorkspaceMemberId: workspaceMemberId,
      });
    }

    return this.getTask(actor, task.id);
  }

  async moveTask(
    actor: Actor,
    input: MoveTaskPipelineTaskInput,
  ): Promise<TaskPipelineTaskDTO> {
    const workspaceMemberId = this.requireMember(actor);
    const { task } = await this.getTaskWithAccess(actor, input.taskId);

    const targetStage = await this.stageRepository.findOne(actor.workspaceId, {
      where: { id: input.stageId, pipelineId: task.pipelineId },
    });

    if (!isDefined(targetStage)) {
      throw new UserInputError('That stage does not belong to this pipeline');
    }

    if (
      isDefined(input.position) &&
      (!Number.isFinite(input.position) || Math.abs(input.position) > 1e12)
    ) {
      throw new UserInputError('Invalid position');
    }

    const position = isDefined(input.position)
      ? input.position
      : await this.nextPosition(actor.workspaceId, targetStage.id);

    const patch: QueryDeepPartialEntity<TaskPipelineTaskEntity> &
      Record<string, unknown> = { stageId: targetStage.id, position };

    if (targetStage.isDone && !isDefined(task.completedAt)) {
      patch.completedAt = new Date();
    }

    if (!targetStage.isDone && isDefined(task.completedAt)) {
      patch.completedAt = null;
    }

    await this.taskRepository.update(actor.workspaceId, { id: task.id }, patch);

    if (targetStage.id !== task.stageId) {
      await this.logActivity(actor.workspaceId, task.id, workspaceMemberId, {
        type: 'moved',
        stage: targetStage.name,
      });
    }

    return this.getTask(actor, task.id);
  }

  async setTaskArchived(
    actor: Actor,
    taskId: string,
    archived: boolean,
  ): Promise<TaskPipelineTaskDTO> {
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
      archived ? { type: 'archived' } : { type: 'restored' },
    );

    return this.getTask(actor, task.id);
  }

  async deleteTask(actor: Actor, taskId: string): Promise<boolean> {
    const workspaceMemberId = this.requireMember(actor);
    const { task, isAdmin } = await this.getTaskWithAccess(actor, taskId);

    // Borrar para siempre: admins del tablero o quien la creó.
    if (!isAdmin && task.createdByWorkspaceMemberId !== workspaceMemberId) {
      throw new ForbiddenError(
        'Only admins of this pipeline or the creator can delete a task',
      );
    }

    await this.taskRepository.delete(actor.workspaceId, { id: task.id });

    return true;
  }

  // ----------------------------------------------------------------- comments

  async listComments(
    actor: Actor,
    taskId: string,
  ): Promise<TaskPipelineTaskCommentDTO[]> {
    await this.getTaskWithAccess(actor, taskId);

    const comments = await this.commentRepository.find(actor.workspaceId, {
      where: { taskId },
      order: { createdAt: 'ASC' },
    });

    return comments.map((comment) => this.toCommentDTO(comment));
  }

  async addComment(
    actor: Actor,
    taskId: string,
    body: string,
  ): Promise<TaskPipelineTaskCommentDTO> {
    const workspaceMemberId = this.requireMember(actor);

    await this.getTaskWithAccess(actor, taskId);

    const trimmed = body.trim();

    if (trimmed.length === 0) {
      throw new UserInputError('Comment cannot be empty');
    }

    const comment = await this.commentRepository.insertAndReturnOne(
      actor.workspaceId,
      {
        taskId,
        authorWorkspaceMemberId: workspaceMemberId,
        kind: 'COMMENT',
        body: trimmed,
      },
    );

    // Toca updatedAt de la tarea para que "actividad reciente" la refleje.
    await this.taskRepository.update(
      actor.workspaceId,
      { id: taskId },
      { updatedAt: new Date() },
    );

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

    await this.commentRepository.update(
      actor.workspaceId,
      { id: comment.id },
      { body: trimmed },
    );

    return this.toCommentDTO({
      ...comment,
      body: trimmed,
      updatedAt: new Date(),
    });
  }

  async deleteComment(actor: Actor, commentId: string): Promise<boolean> {
    const comment = await this.getOwnComment(actor, commentId);

    await this.commentRepository.delete(actor.workspaceId, { id: comment.id });

    return true;
  }

  // ------------------------------------------------------------------ helpers

  // Actividad estructurada ({type, ...datos}) como JSON: el front la muestra
  // traducida al idioma de quien la lee.
  async logActivity(
    workspaceId: string,
    taskId: string,
    workspaceMemberId: string | null,
    event: TaskActivityEvent,
  ): Promise<void> {
    await this.commentRepository.insert(workspaceId, {
      taskId,
      authorWorkspaceMemberId: workspaceMemberId,
      kind: 'ACTIVITY',
      body: JSON.stringify(event),
    });
  }

  async nextPosition(workspaceId: string, stageId: string): Promise<number> {
    const max = await this.taskRepository.maximum(workspaceId, 'position', {
      stageId,
    });

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

  // ------------------------------------------------------------- attachments

  async uploadAttachment(
    actor: Actor,
    {
      taskId,
      file,
      filename,
      purpose,
      checklistItemId,
    }: {
      taskId: string;
      file: Buffer;
      filename: string;
      purpose: TaskPipelineAttachmentPurpose;
      checklistItemId: string | null;
    },
  ) {
    const workspaceMemberId = this.requireMember(actor);
    const { task } = await this.getTaskWithAccess(actor, taskId);

    if (purpose === 'CHECKLIST_ITEM') {
      const exists = getTaskChecklists(task).some((checklist) =>
        checklist.items.some((item) => item.id === checklistItemId),
      );

      if (!exists) {
        throw new UserInputError('Ese punto ya no existe en la tarjeta');
      }
    }

    const attachment = await this.attachmentsService.upload({
      workspaceId: actor.workspaceId,
      taskId: task.id,
      file,
      filename,
      purpose,
      checklistItemId: purpose === 'CHECKLIST_ITEM' ? checklistItemId : null,
      uploadedByWorkspaceMemberId: workspaceMemberId,
    });

    if (purpose === 'ATTACHMENT') {
      await this.logActivity(actor.workspaceId, task.id, workspaceMemberId, {
        type: 'attachmentAdded',
        name: attachment.name,
      });
    }

    const [dto] = await this.attachmentsService.toDTOs(actor.workspaceId, [
      attachment,
    ]);

    return dto;
  }

  async deleteAttachment(actor: Actor, attachmentId: string): Promise<boolean> {
    const workspaceMemberId = this.requireMember(actor);
    const attachment = await this.attachmentsService.findOne(
      actor.workspaceId,
      attachmentId,
    );

    if (!isDefined(attachment)) {
      throw new NotFoundError('Adjunto no encontrado');
    }

    const { task } = await this.getTaskWithAccess(actor, attachment.taskId);

    if (task.coverAttachmentId === attachment.id) {
      await this.taskRepository.update(
        actor.workspaceId,
        { id: task.id },
        { coverAttachmentId: null },
      );
    }

    await this.attachmentsService.delete(actor.workspaceId, attachment);

    if (attachment.purpose === 'ATTACHMENT') {
      await this.logActivity(actor.workspaceId, task.id, workspaceMemberId, {
        type: 'attachmentRemoved',
        name: attachment.name,
      });
    }

    return true;
  }

  private async memberNames(
    workspaceId: string,
    memberIds: string[],
  ): Promise<Map<string, string>> {
    if (memberIds.length === 0) {
      return new Map();
    }

    const members = await this.workspaceMembersService.findMembers(
      workspaceId,
      uniqueIds(memberIds),
    );

    return new Map(
      members.map((member) => [
        member.id,
        [member.firstName, member.lastName].filter(Boolean).join(' '),
      ]),
    );
  }

  // Valida las checklists que manda el front (responsables = miembros del
  // tablero) y calcula el historial: checklists/puntos nuevos, hechos,
  // reasignados, y qué puntos desaparecieron (para borrar sus fotos).
  private async applyChecklists(
    workspaceId: string,
    pipelineId: string,
    task: TaskPipelineTaskEntity,
    requested: NonNullable<UpdateTaskPipelineTaskInput['checklists']>,
    base: UpdateTaskPipelineTaskInput['baseChecklists'],
  ): Promise<{
    checklists: TaskPipelineChecklist[];
    activity: TaskActivityEvent[];
    newAssignees: string[];
    removedItemIds: string[];
  }> {
    const previous = getTaskChecklists(task);
    const toShape = (
      checklists: NonNullable<UpdateTaskPipelineTaskInput['checklists']>,
    ) =>
      checklists.map((checklist) => ({
        id: checklist.id,
        title: checklist.title,
        items: checklist.items.map((item) => ({
          id: item.id,
          text: item.text,
          done: item.done,
          assigneeWorkspaceMemberId: item.assigneeWorkspaceMemberId ?? null,
          dueAt: isDefined(item.dueAt)
            ? new Date(item.dueAt).toISOString()
            : null,
        })),
      }));
    const merged = isDefined(base)
      ? mergeTaskChecklists({
          current: previous,
          base: toShape(base),
          next: toShape(requested),
        })
      : null;
    const input = merged !== null ? merged.checklists : toShape(requested);
    const previousChecklistById = new Map(
      previous.map((checklist) => [checklist.id, checklist]),
    );
    const previousItemById = new Map(
      previous.flatMap((checklist) =>
        checklist.items.map((item) => [item.id, item] as const),
      ),
    );

    // Solo se validan los responsables que ESTE cambio puso: si alguien salió
    // del tablero, sus puntos viejos no deben bloquear marcar otra casilla.
    const assigneeIds = uniqueIds(
      input.flatMap((checklist) =>
        checklist.items
          .filter(
            (item) =>
              isDefined(item.assigneeWorkspaceMemberId) &&
              item.assigneeWorkspaceMemberId !==
                (previousItemById.get(item.id)?.assigneeWorkspaceMemberId ??
                  null),
          )
          .map((item) => item.assigneeWorkspaceMemberId as string),
      ),
    );

    for (const assigneeId of assigneeIds) {
      await this.assertPipelineMember(workspaceId, pipelineId, assigneeId);
    }

    const names = await this.memberNames(workspaceId, assigneeIds);
    const activity: TaskActivityEvent[] = [];
    const newAssignees: string[] = [];
    const now = new Date().toISOString();
    const seenItemIds = new Set<string>();

    const checklists: TaskPipelineChecklist[] = input.map((checklist) => {
      const title = checklist.title.trim() || 'Checklist';

      if (!previousChecklistById.has(checklist.id)) {
        activity.push({ type: 'checklistCreated', title });
      }

      return {
        id: checklist.id,
        title,
        items: checklist.items
          .filter((item) => {
            // ids repetidos = el front mandó basura; se queda el primero
            if (seenItemIds.has(item.id)) {
              return false;
            }

            seenItemIds.add(item.id);

            return item.text.trim().length > 0;
          })
          .map((item) => {
            const text = item.text.trim();
            const before = previousItemById.get(item.id);
            const assignee = item.assigneeWorkspaceMemberId ?? null;

            if (!isDefined(before)) {
              activity.push({ type: 'checklistAdded', text });
            } else if (before.done !== item.done) {
              activity.push({
                type: item.done ? 'checklistDone' : 'checklistUndone',
                text,
              });
            }

            if (
              isDefined(assignee) &&
              assignee !== (before?.assigneeWorkspaceMemberId ?? null)
            ) {
              newAssignees.push(assignee);
              activity.push({
                type: 'pointAssigned',
                text,
                name: names.get(assignee) ?? '',
              });
            }

            return {
              id: item.id,
              text,
              done: item.done,
              assigneeWorkspaceMemberId: assignee,
              dueAt: isDefined(item.dueAt)
                ? new Date(item.dueAt).toISOString()
                : null,
              completedAt: item.done
                ? before?.done
                  ? (before.completedAt ?? now)
                  : now
                : null,
            };
          }),
      };
    });

    previous
      .filter(
        (checklist) =>
          !checklists.some((candidate) => candidate.id === checklist.id),
      )
      .forEach((checklist) =>
        activity.push({ type: 'checklistRemoved', title: checklist.title }),
      );

    const removedItemIds =
      merged !== null
        ? merged.removedItemIds
        : [...previousItemById.keys()].filter(
            (itemId) => !seenItemIds.has(itemId),
          );

    return { checklists, activity, newAssignees, removedItemIds };
  }

  private requireMember(actor: Actor): string {
    if (!isDefined(actor.workspaceMemberId)) {
      throw new ForbiddenError('A workspace member is required');
    }

    return actor.workspaceMemberId;
  }

  private sanitizeLabels(labels: string[] | null | undefined): string[] {
    return [
      ...new Set(
        (labels ?? [])
          .map((label) => label.trim())
          .filter((label) => label.length > 0),
      ),
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
      throw new UserInputError(
        'Tasks can only be assigned to members of this pipeline',
      );
    }
  }

  // Un alias no puede ser el nombre o el correo de OTRO miembro del tablero:
  // si no, alguien podría quedarse con los accionables dirigidos a otra persona.
  private async assertAliasesDoNotImpersonate(
    workspaceId: string,
    pipelineId: string,
    workspaceMemberId: string,
    aliases: string[],
  ): Promise<void> {
    const memberships = await this.memberRepository.find(workspaceId, {
      where: { pipelineId },
    });
    const others = memberships.filter(
      (membership) => membership.workspaceMemberId !== workspaceMemberId,
    );
    const people = await this.workspaceMembersService.findMembers(
      workspaceId,
      others.map((membership) => membership.workspaceMemberId),
    );
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    const taken = new Set<string>();

    for (const person of people) {
      const fullName = normalize(
        `${person.firstName ?? ''} ${person.lastName ?? ''}`,
      );
      const firstName = normalize(person.firstName ?? '');

      [fullName, firstName, normalize(person.email ?? '')]
        .filter((entry) => entry.length > 0)
        .forEach((entry) => taken.add(entry));
    }

    for (const membership of others) {
      (membership.aliases ?? []).forEach((alias) =>
        taken.add(normalize(alias)),
      );
    }

    const clash = aliases.find((alias) => taken.has(normalize(alias)));

    if (isDefined(clash)) {
      throw new UserInputError(
        `"${clash}" already identifies another member of this pipeline`,
      );
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

    if (
      admins.every(
        (admin) => admin.workspaceMemberId === leavingWorkspaceMemberId,
      )
    ) {
      throw new UserInputError(
        'A pipeline needs at least one admin. Promote someone else first.',
      );
    }
  }

  private async getTaskWithAccess(actor: Actor, taskId: string) {
    const task = await this.taskRepository.findOne(actor.workspaceId, {
      where: { id: taskId },
    });

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

    if (
      comment.kind !== 'COMMENT' ||
      comment.authorWorkspaceMemberId !== workspaceMemberId
    ) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    return comment;
  }

  private toCommentDTO(
    comment: TaskPipelineTaskCommentEntity,
  ): TaskPipelineTaskCommentDTO {
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
      myMemberships.map((membership) => [
        membership.pipelineId,
        membership.role,
      ]),
    );
    const countByPipeline = new Map(
      openCounts.map((row) => [row.pipelineId, row.count]),
    );

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

  toConnectionDTO(
    connection: FathomConnectionEntity,
  ): TaskPipelineFathomConnectionDTO {
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
    const meetingIds = [
      ...new Set(tasks.map((task) => task.meetingId).filter(isDefined)),
    ];

    const [commentCounts, meetings, attachments] = await Promise.all([
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
      this.attachmentsService
        .listByTaskIds(workspaceId, taskIds)
        .then((rows) => this.attachmentsService.toDTOs(workspaceId, rows)),
    ]);

    const attachmentsByTask = new Map<string, typeof attachments>();

    for (const attachment of attachments) {
      attachmentsByTask.set(attachment.taskId, [
        ...(attachmentsByTask.get(attachment.taskId) ?? []),
        attachment,
      ]);
    }

    const countByTask = new Map(
      commentCounts.map((row) => [row.taskId, row.count]),
    );
    const meetingById = new Map(
      meetings.map((meeting) => [meeting.id, meeting]),
    );

    return tasks.map((task) => {
      const meeting = isDefined(task.meetingId)
        ? meetingById.get(task.meetingId)
        : undefined;
      const checklists = getTaskChecklists(task);
      const points = checklists.flatMap((checklist) => checklist.items);
      const taskAttachments = attachmentsByTask.get(task.id) ?? [];
      const cover = taskAttachments.find(
        (attachment) => attachment.id === task.coverAttachmentId,
      );

      return {
        id: task.id,
        pipelineId: task.pipelineId,
        pipelineName: pipelineNames.get(task.pipelineId) ?? '',
        stageId: task.stageId,
        position: task.position,
        title: task.title,
        body: task.body,
        assigneeWorkspaceMemberId: task.assigneeWorkspaceMemberId,
        memberWorkspaceMemberIds: getTaskMemberIds(task),
        startAt: task.startAt ?? null,
        dueAt: task.dueAt,
        priority: task.priority,
        labels: task.labels ?? [],
        checklist: task.checklist ?? [],
        checklists: checklists.map((checklist) => ({
          id: checklist.id,
          title: checklist.title,
          items: checklist.items.map((item) => ({
            id: item.id,
            text: item.text,
            done: item.done,
            assigneeWorkspaceMemberId: item.assigneeWorkspaceMemberId ?? null,
            dueAt: isDefined(item.dueAt) ? new Date(item.dueAt) : null,
            completedAt: isDefined(item.completedAt)
              ? new Date(item.completedAt)
              : null,
          })),
        })),
        checklistDoneCount: points.filter((item) => item.done).length,
        checklistTotalCount: points.length,
        attachments: taskAttachments,
        coverAttachmentId: isDefined(cover) ? cover.id : null,
        coverUrl: cover?.url ?? null,
        relatedRecords: task.relatedRecords ?? [],
        source: task.source,
        sourceLink: task.sourceLink,
        meeting: isDefined(meeting)
          ? {
              id: meeting.id,
              title: meeting.title,
              startedAt: meeting.startedAt,
            }
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
