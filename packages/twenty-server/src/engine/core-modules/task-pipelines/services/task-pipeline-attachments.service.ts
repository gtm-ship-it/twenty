import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { EMAIL_IMAGE_MIME_TYPES } from 'twenty-shared/constants';
import { FileFolder } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';
import { v4 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import { extractFileInfoOrThrow } from 'src/engine/core-modules/file/utils/extract-file-info-or-throw.utils';
import { type TaskPipelineTaskAttachmentDTO } from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline-task.dto';
import {
  TaskPipelineTaskAttachmentEntity,
  type TaskPipelineAttachmentPurpose,
} from 'src/engine/core-modules/task-pipelines/entities/task-pipeline-task-attachment.entity';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

const IMAGE_MIME_TYPES = new Set<string>(EMAIL_IMAGE_MIME_TYPES);
const MAX_NAME_LENGTH = 255;

export const isTaskImageMimeType = (mimeType: string | null | undefined) =>
  isDefined(mimeType) && IMAGE_MIME_TYPES.has(mimeType);

// Adjuntos de las tarjetas (archivos, fotos de los pasos, imágenes pegadas en
// descripción/comentarios). Se guardan con el almacenamiento de Twenty:
//  - imágenes en EmailImage: su URL no caduca, así que sirve pegada en markdown;
//  - el resto en EmailAttachment: su URL caduca en 1 día y se vuelve a firmar
//    cada vez que se lee la tarjeta.
// El acceso lo decide el llamador (miembro del tablero de la tarjeta).
@Injectable()
export class TaskPipelineAttachmentsService {
  private readonly logger = new Logger(TaskPipelineAttachmentsService.name);

  constructor(
    @InjectWorkspaceScopedRepository(TaskPipelineTaskAttachmentEntity)
    private readonly attachmentRepository: WorkspaceScopedRepository<TaskPipelineTaskAttachmentEntity>,
    private readonly fileStorageService: FileStorageService,
    private readonly applicationService: ApplicationService,
    private readonly fileUrlService: FileUrlService,
  ) {}

  async upload({
    workspaceId,
    taskId,
    file,
    filename,
    purpose,
    checklistItemId,
    uploadedByWorkspaceMemberId,
  }: {
    workspaceId: string;
    taskId: string;
    file: Buffer;
    filename: string;
    purpose: TaskPipelineAttachmentPurpose;
    checklistItemId: string | null;
    uploadedByWorkspaceMemberId: string;
  }): Promise<TaskPipelineTaskAttachmentEntity> {
    const { mimeType, ext } = await extractFileInfoOrThrow({ file, filename });
    const fileFolder = isTaskImageMimeType(mimeType)
      ? FileFolder.EmailImage
      : FileFolder.EmailAttachment;
    const fileId = v4();
    const resourcePath = `${fileId}${isNonEmptyString(ext) ? `.${ext}` : ''}`;

    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    await this.fileStorageService.writeFile({
      sourceFile: file,
      resourcePath,
      fileFolder,
      applicationUniversalIdentifier:
        workspaceCustomFlatApplication.universalIdentifier,
      workspaceId,
      fileId,
      settings: { isTemporaryFile: false, toDelete: false },
    });

    return this.attachmentRepository.insertAndReturnOne(workspaceId, {
      taskId,
      fileId,
      fileFolder,
      name: (filename.trim() || resourcePath).slice(0, MAX_NAME_LENGTH),
      mimeType,
      size: String(file.length),
      purpose,
      checklistItemId,
      uploadedByWorkspaceMemberId,
    });
  }

  async findOne(workspaceId: string, attachmentId: string) {
    return this.attachmentRepository.findOne(workspaceId, {
      where: { id: attachmentId },
    });
  }

  async listByTaskIds(workspaceId: string, taskIds: string[]) {
    if (taskIds.length === 0) {
      return [];
    }

    return this.attachmentRepository.find(workspaceId, {
      where: { taskId: In(taskIds) },
      order: { createdAt: 'ASC' },
    });
  }

  async delete(
    workspaceId: string,
    attachment: TaskPipelineTaskAttachmentEntity,
  ): Promise<void> {
    await this.attachmentRepository.delete(workspaceId, { id: attachment.id });

    try {
      await this.fileStorageService.deleteByFileId({
        fileId: attachment.fileId,
        workspaceId,
        fileFolder: attachment.fileFolder as FileFolder,
      });
    } catch (error) {
      // La fila ya no existe; el archivo huérfano no rompe nada.
      this.logger.warn(
        `Could not delete file ${attachment.fileId}: ${(error as Error).message}`,
      );
    }
  }

  // Al quitar puntos de una checklist, sus fotos se van con ellos.
  async deleteForChecklistItems(
    workspaceId: string,
    taskId: string,
    checklistItemIds: string[],
  ): Promise<void> {
    if (checklistItemIds.length === 0) {
      return;
    }

    const attachments = await this.attachmentRepository.find(workspaceId, {
      where: { taskId, checklistItemId: In(checklistItemIds) },
    });

    for (const attachment of attachments) {
      await this.delete(workspaceId, attachment);
    }
  }

  async toDTOs(
    workspaceId: string,
    attachments: TaskPipelineTaskAttachmentEntity[],
  ): Promise<TaskPipelineTaskAttachmentDTO[]> {
    return Promise.all(
      attachments.map(async (attachment) => ({
        id: attachment.id,
        taskId: attachment.taskId,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: isDefined(attachment.size) ? Number(attachment.size) : null,
        purpose: attachment.purpose,
        checklistItemId: attachment.checklistItemId,
        isImage: isTaskImageMimeType(attachment.mimeType),
        url: await this.fileUrlService.signFileByIdUrl({
          fileId: attachment.fileId,
          workspaceId,
          fileFolder: attachment.fileFolder as FileFolder,
        }),
        uploadedByWorkspaceMemberId: attachment.uploadedByWorkspaceMemberId,
        createdAt: attachment.createdAt,
      })),
    );
  }
}
