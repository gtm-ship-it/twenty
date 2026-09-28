import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { isDefined } from 'twenty-shared/utils';

import { CoreResolver } from 'src/engine/api/graphql/graphql-config/decorators/core-resolver.decorator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import {
  FathomSyncResultDTO,
  MeetingDetailDTO,
  MeetingListItemDTO,
} from 'src/engine/core-modules/task-pipelines/dtos/meeting.dto';
import {
  TaskPipelineTaskCommentDTO,
  TaskPipelineTaskDTO,
} from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline-task.dto';
import {
  TaskPipelineDTO,
  TaskPipelineFathomConnectionDTO,
} from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline.dto';
import {
  CreateTaskPipelineInput,
  CreateTaskPipelineTaskInput,
  MoveTaskPipelineTaskInput,
  TASK_PIPELINE_ROLES,
  TaskPipelineStageInput,
  UpdateTaskPipelineInput,
  UpdateTaskPipelineTaskInput,
} from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline.inputs';
import { FathomConnectionsService } from 'src/engine/core-modules/task-pipelines/fathom/fathom-connections.service';
import { MeetingsService } from 'src/engine/core-modules/task-pipelines/services/meetings.service';
import { TaskPipelineAccessService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-access.service';
import { TaskPipelinesService } from 'src/engine/core-modules/task-pipelines/services/task-pipelines.service';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspaceMemberId } from 'src/engine/decorators/auth/auth-workspace-member-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

const assertText = (value: string, field: string, max: number) => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new UserInputError(`${field} must be between 1 and ${max} characters`);
  }
};

@UseGuards(WorkspaceAuthGuard, UserAuthGuard)
@UsePipes(ResolverValidationPipe)
@UseFilters(PreventNestToAutoLogGraphqlErrorsFilter)
@CoreResolver()
export class TaskPipelinesResolver {
  constructor(
    private readonly taskPipelinesService: TaskPipelinesService,
    private readonly accessService: TaskPipelineAccessService,
    private readonly meetingsService: MeetingsService,
    private readonly fathomConnectionsService: FathomConnectionsService,
  ) {}

  // ------------------------------------------------------------- pipelines

  @Query(() => [TaskPipelineDTO])
  async taskPipelines(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
  ): Promise<TaskPipelineDTO[]> {
    return this.taskPipelinesService.listPipelines({ workspaceId: workspace.id, workspaceMemberId });
  }

  @Query(() => Boolean)
  async canCreateWorkspaceTaskPipelines(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string | undefined,
  ): Promise<boolean> {
    return this.accessService.canCreateWorkspacePipelines({
      workspaceId: workspace.id,
      userWorkspaceId,
    });
  }

  @Mutation(() => TaskPipelineDTO)
  async createTaskPipeline(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @AuthUserWorkspaceId() userWorkspaceId: string | undefined,
    @Args('input', { type: () => CreateTaskPipelineInput }) input: CreateTaskPipelineInput,
  ): Promise<TaskPipelineDTO> {
    return this.taskPipelinesService.createPipeline(
      { workspaceId: workspace.id, workspaceMemberId, userWorkspaceId },
      input,
    );
  }

  @Mutation(() => TaskPipelineDTO)
  async updateTaskPipeline(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
    @Args('input', { type: () => UpdateTaskPipelineInput }) input: UpdateTaskPipelineInput,
  ): Promise<TaskPipelineDTO> {
    return this.taskPipelinesService.updatePipeline(
      { workspaceId: workspace.id, workspaceMemberId },
      pipelineId,
      input,
    );
  }

  @Mutation(() => Boolean)
  async deleteTaskPipeline(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
  ): Promise<boolean> {
    const actor = { workspaceId: workspace.id, workspaceMemberId };

    await this.accessService.getAccessOrThrow({ ...actor, pipelineId, requireAdmin: true });
    await this.fathomConnectionsService.disconnectAllForPipeline(workspace.id, pipelineId);

    return this.taskPipelinesService.deletePipeline(actor, pipelineId);
  }

  @Mutation(() => TaskPipelineDTO)
  async saveTaskPipelineStages(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
    @Args('stages', { type: () => [TaskPipelineStageInput] }) stages: TaskPipelineStageInput[],
    @Args('moveTasksToStageId', { type: () => UUIDScalarType, nullable: true })
    moveTasksToStageId: string | null,
  ): Promise<TaskPipelineDTO> {
    if (stages.length > 30) {
      throw new UserInputError('A pipeline can have up to 30 stages');
    }

    return this.taskPipelinesService.saveStages(
      { workspaceId: workspace.id, workspaceMemberId },
      pipelineId,
      stages,
      moveTasksToStageId,
    );
  }

  // --------------------------------------------------------------- members

  @Mutation(() => TaskPipelineDTO)
  async addTaskPipelineMember(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
    @Args('memberWorkspaceMemberId', { type: () => UUIDScalarType }) memberId: string,
    @Args('role', { type: () => String }) role: string,
  ): Promise<TaskPipelineDTO> {
    if (!(TASK_PIPELINE_ROLES as readonly string[]).includes(role)) {
      throw new UserInputError('Unknown role');
    }

    return this.taskPipelinesService.addMember(
      { workspaceId: workspace.id, workspaceMemberId },
      pipelineId,
      memberId,
      role as 'ADMIN' | 'MEMBER',
    );
  }

  @Mutation(() => TaskPipelineDTO)
  async updateTaskPipelineMember(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
    @Args('memberWorkspaceMemberId', { type: () => UUIDScalarType }) memberId: string,
    @Args('role', { type: () => String, nullable: true }) role: string | null,
    @Args('aliases', { type: () => [String], nullable: true }) aliases: string[] | null,
  ): Promise<TaskPipelineDTO> {
    if (isDefined(role) && !(TASK_PIPELINE_ROLES as readonly string[]).includes(role)) {
      throw new UserInputError('Unknown role');
    }

    if (aliases && (aliases.length > 30 || aliases.some((alias) => alias.length > 120))) {
      throw new UserInputError('Too many or too long aliases');
    }

    return this.taskPipelinesService.updateMember(
      { workspaceId: workspace.id, workspaceMemberId },
      pipelineId,
      memberId,
      { role: (role ?? null) as 'ADMIN' | 'MEMBER' | null, aliases: aliases ?? null },
    );
  }

  @Mutation(() => Boolean)
  async removeTaskPipelineMember(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
    @Args('memberWorkspaceMemberId', { type: () => UUIDScalarType }) memberId: string,
  ): Promise<boolean> {
    return this.taskPipelinesService.removeMember(
      { workspaceId: workspace.id, workspaceMemberId },
      pipelineId,
      memberId,
    );
  }

  // ----------------------------------------------------------------- tasks

  @Query(() => [TaskPipelineTaskDTO])
  async taskPipelineTasks(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
    @Args('includeArchived', { type: () => Boolean, nullable: true }) includeArchived: boolean | null,
  ): Promise<TaskPipelineTaskDTO[]> {
    return this.taskPipelinesService.listTasks(
      { workspaceId: workspace.id, workspaceMemberId },
      pipelineId,
      includeArchived === true,
    );
  }

  @Query(() => [TaskPipelineTaskDTO])
  async myTaskPipelineTasks(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
  ): Promise<TaskPipelineTaskDTO[]> {
    return this.taskPipelinesService.listMyTasks({ workspaceId: workspace.id, workspaceMemberId });
  }

  @Query(() => TaskPipelineTaskDTO)
  async taskPipelineTask(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('taskId', { type: () => UUIDScalarType }) taskId: string,
  ): Promise<TaskPipelineTaskDTO> {
    return this.taskPipelinesService.getTask({ workspaceId: workspace.id, workspaceMemberId }, taskId);
  }

  @Mutation(() => TaskPipelineTaskDTO)
  async createTaskPipelineTask(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('input', { type: () => CreateTaskPipelineTaskInput }) input: CreateTaskPipelineTaskInput,
  ): Promise<TaskPipelineTaskDTO> {
    return this.taskPipelinesService.createTask({ workspaceId: workspace.id, workspaceMemberId }, input);
  }

  @Mutation(() => TaskPipelineTaskDTO)
  async updateTaskPipelineTask(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('taskId', { type: () => UUIDScalarType }) taskId: string,
    @Args('input', { type: () => UpdateTaskPipelineTaskInput }) input: UpdateTaskPipelineTaskInput,
  ): Promise<TaskPipelineTaskDTO> {
    return this.taskPipelinesService.updateTask(
      { workspaceId: workspace.id, workspaceMemberId },
      taskId,
      input,
    );
  }

  @Mutation(() => TaskPipelineTaskDTO)
  async moveTaskPipelineTask(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('input', { type: () => MoveTaskPipelineTaskInput }) input: MoveTaskPipelineTaskInput,
  ): Promise<TaskPipelineTaskDTO> {
    return this.taskPipelinesService.moveTask({ workspaceId: workspace.id, workspaceMemberId }, input);
  }

  @Mutation(() => TaskPipelineTaskDTO)
  async setTaskPipelineTaskArchived(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('taskId', { type: () => UUIDScalarType }) taskId: string,
    @Args('archived', { type: () => Boolean }) archived: boolean,
  ): Promise<TaskPipelineTaskDTO> {
    return this.taskPipelinesService.setTaskArchived(
      { workspaceId: workspace.id, workspaceMemberId },
      taskId,
      archived,
    );
  }

  @Mutation(() => Boolean)
  async deleteTaskPipelineTask(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('taskId', { type: () => UUIDScalarType }) taskId: string,
  ): Promise<boolean> {
    return this.taskPipelinesService.deleteTask({ workspaceId: workspace.id, workspaceMemberId }, taskId);
  }

  // -------------------------------------------------------------- comments

  @Query(() => [TaskPipelineTaskCommentDTO])
  async taskPipelineTaskComments(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('taskId', { type: () => UUIDScalarType }) taskId: string,
  ): Promise<TaskPipelineTaskCommentDTO[]> {
    return this.taskPipelinesService.listComments({ workspaceId: workspace.id, workspaceMemberId }, taskId);
  }

  @Mutation(() => TaskPipelineTaskCommentDTO)
  async addTaskPipelineTaskComment(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('taskId', { type: () => UUIDScalarType }) taskId: string,
    @Args('body', { type: () => String }) body: string,
  ): Promise<TaskPipelineTaskCommentDTO> {
    assertText(body, 'Comment', 20000);

    return this.taskPipelinesService.addComment(
      { workspaceId: workspace.id, workspaceMemberId },
      taskId,
      body,
    );
  }

  @Mutation(() => TaskPipelineTaskCommentDTO)
  async updateTaskPipelineTaskComment(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('commentId', { type: () => UUIDScalarType }) commentId: string,
    @Args('body', { type: () => String }) body: string,
  ): Promise<TaskPipelineTaskCommentDTO> {
    assertText(body, 'Comment', 20000);

    return this.taskPipelinesService.updateComment(
      { workspaceId: workspace.id, workspaceMemberId },
      commentId,
      body,
    );
  }

  @Mutation(() => Boolean)
  async deleteTaskPipelineTaskComment(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('commentId', { type: () => UUIDScalarType }) commentId: string,
  ): Promise<boolean> {
    return this.taskPipelinesService.deleteComment(
      { workspaceId: workspace.id, workspaceMemberId },
      commentId,
    );
  }

  // ---------------------------------------------------------------- fathom

  @Mutation(() => TaskPipelineFathomConnectionDTO)
  async connectFathomToTaskPipeline(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType }) pipelineId: string,
    @Args('label', { type: () => String }) label: string,
    @Args('apiKey', { type: () => String }) apiKey: string,
  ): Promise<TaskPipelineFathomConnectionDTO> {
    if (label.length > 80 || apiKey.length > 500) {
      throw new UserInputError('Label or API key too long');
    }

    return this.fathomConnectionsService.connect(
      { workspaceId: workspace.id, workspaceMemberId },
      pipelineId,
      label,
      apiKey,
    );
  }

  @Mutation(() => Boolean)
  async disconnectFathomFromTaskPipeline(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('connectionId', { type: () => UUIDScalarType }) connectionId: string,
  ): Promise<boolean> {
    return this.fathomConnectionsService.disconnect(
      { workspaceId: workspace.id, workspaceMemberId },
      connectionId,
    );
  }

  @Mutation(() => FathomSyncResultDTO)
  async syncFathomConnection(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('connectionId', { type: () => UUIDScalarType }) connectionId: string,
  ): Promise<FathomSyncResultDTO> {
    return this.fathomConnectionsService.syncForActor(
      { workspaceId: workspace.id, workspaceMemberId },
      connectionId,
    );
  }

  // -------------------------------------------------------------- meetings

  @Query(() => [MeetingListItemDTO])
  async taskPipelineMeetings(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('pipelineId', { type: () => UUIDScalarType, nullable: true }) pipelineId: string | null,
  ): Promise<MeetingListItemDTO[]> {
    return this.meetingsService.listMeetings({ workspaceId: workspace.id, workspaceMemberId }, pipelineId);
  }

  @Query(() => MeetingDetailDTO)
  async taskPipelineMeeting(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('meetingId', { type: () => UUIDScalarType }) meetingId: string,
  ): Promise<MeetingDetailDTO> {
    return this.meetingsService.getMeeting({ workspaceId: workspace.id, workspaceMemberId }, meetingId);
  }

  @Mutation(() => TaskPipelineTaskDTO)
  async createTaskFromMeetingActionItem(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string | undefined,
    @Args('actionItemId', { type: () => UUIDScalarType }) actionItemId: string,
  ): Promise<TaskPipelineTaskDTO> {
    return this.meetingsService.createTaskFromActionItem(
      { workspaceId: workspace.id, workspaceMemberId },
      actionItemId,
    );
  }
}
