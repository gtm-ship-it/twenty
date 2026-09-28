import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { type TaskPipelineTaskEntity } from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task.entity';
import { TaskPipelineWorkspaceMembersService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-workspace-members.service';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Correo "te asignaron una tarea". Nunca rompe el flujo que lo llama: si el
// envío falla solo queda en el log.
@Injectable()
export class TaskPipelineNotificationService {
  private readonly logger = new Logger(TaskPipelineNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly twentyConfigService: TwentyConfigService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
    private readonly workspaceMembersService: TaskPipelineWorkspaceMembersService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  buildTaskUrl(
    workspace: WorkspaceEntity,
    pipelineId: string,
    taskId: string,
  ): string {
    return this.workspaceDomainsService
      .buildWorkspaceURL({
        workspace,
        pathname: '/tasks',
        searchParams: { pipeline: pipelineId, task: taskId },
      })
      .toString();
  }

  async notifyAssigned({
    workspaceId,
    task,
    pipelineName,
    assignedByWorkspaceMemberId,
    meetingTitle,
  }: {
    workspaceId: string;
    task: Pick<
      TaskPipelineTaskEntity,
      | 'id'
      | 'pipelineId'
      | 'title'
      | 'body'
      | 'dueAt'
      | 'assigneeWorkspaceMemberId'
    >;
    pipelineName: string;
    assignedByWorkspaceMemberId: string | null;
    meetingTitle?: string | null;
  }): Promise<void> {
    try {
      if (!isDefined(task.assigneeWorkspaceMemberId)) {
        return;
      }

      const ids = [
        task.assigneeWorkspaceMemberId,
        assignedByWorkspaceMemberId,
      ].filter(isDefined);
      const members = await this.workspaceMembersService.findMembers(
        workspaceId,
        ids,
      );
      const assignee = members.find(
        (member) => member.id === task.assigneeWorkspaceMemberId,
      );
      const assigner = members.find(
        (member) => member.id === assignedByWorkspaceMemberId,
      );

      if (!isDefined(assignee?.email)) {
        return;
      }

      const workspace = await this.workspaceRepository.findOne({
        where: { id: workspaceId },
      });

      if (!isDefined(workspace)) {
        return;
      }

      const url = this.buildTaskUrl(workspace, task.pipelineId, task.id);
      const assignerName = isDefined(assigner)
        ? [assigner.firstName, assigner.lastName].filter(Boolean).join(' ')
        : null;
      const origin = isDefined(meetingTitle)
        ? `de la reunión “${escapeHtml(meetingTitle)}”`
        : isDefined(assignerName) && assignerName.length > 0
          ? `por ${escapeHtml(assignerName)}`
          : '';
      const due = isDefined(task.dueAt)
        ? `<p style="margin:0 0 8px;color:#666">Vence: ${new Date(task.dueAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`
        : '';
      const body = task.body?.trim()
        ? `<p style="margin:0 0 16px;color:#333;white-space:pre-wrap">${escapeHtml(task.body.slice(0, 1200))}</p>`
        : '';

      await this.emailService.send({
        from: `${this.twentyConfigService.get('EMAIL_FROM_NAME')} <${this.twentyConfigService.get('EMAIL_FROM_ADDRESS')}>`,
        to: assignee.email,
        subject: `Nueva tarea: ${task.title.slice(0, 120)}`,
        text: `Te asignaron una tarea en ${pipelineName}: ${task.title}\n${url}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px">
<p style="margin:0 0 4px;color:#666">Te asignaron una tarea en <b>${escapeHtml(pipelineName)}</b> ${origin}</p>
<h2 style="margin:0 0 12px;font-size:18px;color:#111">${escapeHtml(task.title)}</h2>
${due}${body}
<a href="${url}" style="display:inline-block;background:#1961ED;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir tarea</a>
</div>`,
      });
    } catch (error) {
      this.logger.warn(
        `Could not send task assignment email for task ${task.id}: ${(error as Error).message}`,
      );
    }
  }
}
