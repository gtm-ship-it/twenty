import { Injectable } from '@nestjs/common';

import { In } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

export type TaskPipelineWorkspaceMember = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  locale: string | null;
};

// Lectura de miembros del workspace (nombre + correo de login) sin pasar por
// los permisos del usuario: la usan la asignación automática y los avisos.
@Injectable()
export class TaskPipelineWorkspaceMembersService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async findMembers(
    workspaceId: string,
    workspaceMemberIds?: string[],
  ): Promise<TaskPipelineWorkspaceMember[]> {
    if (workspaceMemberIds && workspaceMemberIds.length === 0) {
      return [];
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const members = await repository.find({
          where: workspaceMemberIds ? { id: In(workspaceMemberIds) } : {},
        });

        return members.map((member) => ({
          id: member.id,
          userId: member.userId,
          firstName: member.name?.firstName ?? null,
          lastName: member.name?.lastName ?? null,
          email: member.userEmail ?? null,
          locale: (member as { locale?: string | null }).locale ?? null,
        }));
      },
      authContext,
    );
  }

  async exists(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<boolean> {
    const members = await this.findMembers(workspaceId, [workspaceMemberId]);

    return members.length === 1;
  }
}
