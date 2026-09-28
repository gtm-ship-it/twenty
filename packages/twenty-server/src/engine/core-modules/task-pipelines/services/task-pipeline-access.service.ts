import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { PermissionFlagType } from 'twenty-shared/constants';

import { TaskPipelineMemberEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-member.entity';
import { TaskPipelineEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline.entity';
import {
  ForbiddenError,
  NotFoundError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

export type TaskPipelineAccess = {
  pipeline: TaskPipelineEntity;
  membership: TaskPipelineMemberEntity;
  isAdmin: boolean;
};

// Único punto donde se decide quién ve y quién administra un tablero.
// Regla: solo los MIEMBROS del tablero lo ven (tampoco los admins del workspace
// ven un tablero personal ajeno). Los admins del tablero lo configuran.
@Injectable()
export class TaskPipelineAccessService {
  constructor(
    @InjectWorkspaceScopedRepository(TaskPipelineEntity)
    private readonly pipelineRepository: WorkspaceScopedRepository<TaskPipelineEntity>,
    @InjectWorkspaceScopedRepository(TaskPipelineMemberEntity)
    private readonly memberRepository: WorkspaceScopedRepository<TaskPipelineMemberEntity>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async getAccessOrThrow({
    workspaceId,
    pipelineId,
    workspaceMemberId,
    requireAdmin = false,
  }: {
    workspaceId: string;
    pipelineId: string;
    workspaceMemberId: string | undefined;
    requireAdmin?: boolean;
  }): Promise<TaskPipelineAccess> {
    if (!isDefined(workspaceMemberId)) {
      throw new ForbiddenError('A workspace member is required');
    }

    const pipeline = await this.pipelineRepository.findOne(workspaceId, {
      where: { id: pipelineId },
    });

    // Mismo error si no existe o si no eres miembro: no se filtra la existencia.
    const membership = isDefined(pipeline)
      ? await this.memberRepository.findOne(workspaceId, {
          where: { pipelineId, workspaceMemberId },
        })
      : null;

    if (
      !isDefined(pipeline) ||
      !isDefined(membership) ||
      isDefined(pipeline.archivedAt)
    ) {
      throw new NotFoundError('Task pipeline not found');
    }

    const isAdmin = membership.role === 'ADMIN';

    if (requireAdmin && !isAdmin) {
      throw new ForbiddenError('Only admins of this pipeline can do that');
    }

    return { pipeline, membership, isAdmin };
  }

  async listMemberships(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<TaskPipelineMemberEntity[]> {
    return this.memberRepository.find(workspaceId, {
      where: { workspaceMemberId },
    });
  }

  // Crear tableros compartidos del workspace = admins del workspace
  // (permiso de gestionar miembros). Los personales los crea cualquiera.
  async canCreateWorkspacePipelines({
    workspaceId,
    userWorkspaceId,
  }: {
    workspaceId: string;
    userWorkspaceId: string | undefined;
  }): Promise<boolean> {
    if (!isDefined(userWorkspaceId)) {
      return false;
    }

    return this.permissionsService.userHasWorkspaceSettingPermission({
      workspaceId,
      userWorkspaceId,
      setting: PermissionFlagType.WORKSPACE_MEMBERS,
    });
  }
}
