import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { type FathomSyncResultDTO } from 'src/engine/core-modules/task-pipelines/dtos/meeting.dto';
import { type TaskPipelineFathomConnectionDTO } from 'src/engine/core-modules/task-pipelines/dtos/task-pipeline.dto';
import { FathomConnectionEntity } from 'src/engine/core-modules/task-pipelines/entities/fathom-connection.entity';
import {
  FathomApiClientService,
  FathomApiError,
} from 'src/engine/core-modules/task-pipelines/fathom/fathom-api-client.service';
import { FathomIngestionService } from 'src/engine/core-modules/task-pipelines/fathom/fathom-ingestion.service';
import { type FathomMeeting } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { TaskPipelineAccessService } from 'src/engine/core-modules/task-pipelines/services/task-pipeline-access.service';
import { TaskPipelinesService } from 'src/engine/core-modules/task-pipelines/services/task-pipelines.service';
import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import {
  NotFoundError,
  UserInputError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

const FIRST_SYNC_LOOKBACK_DAYS = 14;
const MAX_SYNC_PAGES = 20;
const BACKUP_SYNC_INTERVAL_MS = 30 * 60 * 1000;
// Margen hacia atrás en cada sync para no perder reuniones que Fathom terminó
// de procesar tarde (el resumen puede tardar varios minutos).
const SYNC_OVERLAP_MS = 24 * 60 * 60 * 1000;

type Actor = { workspaceId: string; workspaceMemberId: string | undefined };

// El respaldo periódico solo corre en el proceso del servidor web (no en el
// worker ni en los comandos de upgrade, que comparten módulos).
const isWebServerProcess = (): boolean => {
  const argv = process.argv.join(' ');

  if (process.env.JEST_WORKER_ID !== undefined) {
    return false;
  }

  return !/queue-worker|command|jest|typeorm/.test(argv);
};

@Injectable()
export class FathomConnectionsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(FathomConnectionsService.name);
  private backupTimer: NodeJS.Timeout | null = null;
  private readonly runningSyncs = new Set<string>();

  constructor(
    @InjectWorkspaceScopedRepository(FathomConnectionEntity)
    private readonly connectionRepository: WorkspaceScopedRepository<FathomConnectionEntity>,
    // El webhook y el respaldo periódico llegan sin workspace en contexto.
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(FathomConnectionEntity)
    private readonly connectionRepositoryUnscoped: Repository<FathomConnectionEntity>,
    private readonly fathomApiClient: FathomApiClientService,
    private readonly ingestionService: FathomIngestionService,
    private readonly secretEncryptionService: SecretEncryptionService,
    private readonly twentyConfigService: TwentyConfigService,
    private readonly accessService: TaskPipelineAccessService,
    private readonly taskPipelinesService: TaskPipelinesService,
  ) {}

  onApplicationBootstrap() {
    if (!isWebServerProcess()) {
      return;
    }

    this.backupTimer = setInterval(() => {
      void this.syncAllActiveConnections();
    }, BACKUP_SYNC_INTERVAL_MS);
    this.backupTimer.unref();
  }

  onModuleDestroy() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
  }

  buildWebhookUrl(connectionId: string): string {
    const base =
      this.twentyConfigService.get('FATHOM_WEBHOOK_BASE_URL') ||
      this.twentyConfigService.get('SERVER_URL');

    return `${String(base).replace(/\/$/, '')}/webhooks/fathom/${connectionId}`;
  }

  decryptApiKey(connection: FathomConnectionEntity): string {
    return this.secretEncryptionService.decryptVersionedOrThrow(
      connection.apiKeyEncrypted as EncryptedString,
      { workspaceId: connection.workspaceId },
    );
  }

  decryptWebhookSecret(connection: FathomConnectionEntity): string | null {
    if (!isNonEmptyString(connection.webhookSecretEncrypted)) {
      return null;
    }

    return this.secretEncryptionService.decryptVersionedOrThrow(
      connection.webhookSecretEncrypted as EncryptedString,
      { workspaceId: connection.workspaceId },
    );
  }

  async findConnectionForWebhook(connectionId: string): Promise<FathomConnectionEntity | null> {
    if (!/^[0-9a-f-]{36}$/i.test(connectionId)) {
      return null;
    }

    return this.connectionRepositoryUnscoped.findOne({ where: { id: connectionId } });
  }

  async connect(
    actor: Actor,
    pipelineId: string,
    label: string,
    apiKey: string,
  ): Promise<TaskPipelineFathomConnectionDTO> {
    await this.accessService.getAccessOrThrow({ ...actor, pipelineId, requireAdmin: true });

    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 10) {
      throw new UserInputError('That does not look like a Fathom API key');
    }

    // 1) La llave funciona (y de paso sabemos de quién es).
    let sample: FathomMeeting[] = [];

    try {
      const { items } = await this.fathomApiClient.listMeetings(trimmedKey, {
        includeDetails: false,
      });

      sample = items;
    } catch (error) {
      throw new UserInputError(
        error instanceof FathomApiError ? error.message : 'Could not validate the Fathom API key',
      );
    }

    const existingConnections = await this.connectionRepository.find(actor.workspaceId, {
      where: { pipelineId },
    });

    for (const existing of existingConnections) {
      if (this.decryptApiKey(existing) === trimmedKey) {
        throw new UserInputError('This Fathom account is already connected to this pipeline');
      }
    }

    const recordedBy = sample.find((meeting) => isNonEmptyString(meeting.recorded_by?.email))
      ?.recorded_by;

    const connection = await this.connectionRepository.insertAndReturnOne(actor.workspaceId, {
      pipelineId,
      label: label.trim() || recordedBy?.name || 'Fathom',
      apiKeyEncrypted: this.secretEncryptionService.encryptVersioned(
        trimmedKey as PlaintextString,
        { workspaceId: actor.workspaceId },
      ),
      apiKeyHint: `…${trimmedKey.slice(-4)}`,
      fathomUserEmail: recordedBy?.email?.toLowerCase() ?? null,
      fathomUserName: recordedBy?.name ?? null,
      connectedByWorkspaceMemberId: actor.workspaceMemberId ?? null,
      status: 'ACTIVE',
      lastError: null,
      fathomWebhookId: null,
      webhookSecretEncrypted: null,
    });

    // 2) Webhook en vivo. Si Fathom no puede llegar a nuestra URL (p. ej. en
    // local) la conexión sigue viva con el respaldo periódico.
    await this.ensureWebhook(connection, trimmedKey);

    // 3) Primera importación de las últimas 2 semanas, sin bloquear la respuesta.
    void this.syncConnection(connection.id).catch((error) =>
      this.logger.warn(`Initial Fathom sync failed: ${(error as Error).message}`),
    );

    const refreshed = await this.connectionRepository.findOneOrFail(actor.workspaceId, {
      where: { id: connection.id },
    });

    return this.taskPipelinesService.toConnectionDTO(refreshed);
  }

  async ensureWebhook(connection: FathomConnectionEntity, apiKey: string): Promise<void> {
    try {
      const webhook = await this.fathomApiClient.createWebhook(
        apiKey,
        this.buildWebhookUrl(connection.id),
      );

      await this.connectionRepository.update(
        connection.workspaceId,
        { id: connection.id },
        {
          fathomWebhookId: webhook.id,
          webhookSecretEncrypted: this.secretEncryptionService.encryptVersioned(
            webhook.secret as PlaintextString,
            { workspaceId: connection.workspaceId },
          ),
          lastError: null,
        },
      );
    } catch (error) {
      this.logger.warn(`Could not register Fathom webhook: ${(error as Error).message}`);
      await this.connectionRepository.update(
        connection.workspaceId,
        { id: connection.id },
        {
          lastError: `Live updates are off (${(error as Error).message}). Meetings still sync every 30 minutes.`,
        },
      );
    }
  }

  async disconnect(actor: Actor, connectionId: string): Promise<boolean> {
    const connection = await this.connectionRepository.findOne(actor.workspaceId, {
      where: { id: connectionId },
    });

    if (!isDefined(connection)) {
      throw new NotFoundError('Fathom connection not found');
    }

    await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId: connection.pipelineId,
      requireAdmin: true,
    });

    await this.removeRemoteWebhook(connection);
    await this.connectionRepository.delete(actor.workspaceId, { id: connection.id });

    return true;
  }

  // Se llama antes de borrar un tablero: sin esto quedarían webhooks huérfanos en Fathom.
  async disconnectAllForPipeline(workspaceId: string, pipelineId: string): Promise<void> {
    const connections = await this.connectionRepository.find(workspaceId, {
      where: { pipelineId },
    });

    for (const connection of connections) {
      await this.removeRemoteWebhook(connection);
    }
  }

  private async removeRemoteWebhook(connection: FathomConnectionEntity): Promise<void> {
    if (!isNonEmptyString(connection.fathomWebhookId)) {
      return;
    }

    try {
      await this.fathomApiClient.deleteWebhook(
        this.decryptApiKey(connection),
        connection.fathomWebhookId,
      );
    } catch (error) {
      this.logger.warn(
        `Could not delete Fathom webhook ${connection.fathomWebhookId}: ${(error as Error).message}`,
      );
    }
  }

  async syncForActor(actor: Actor, connectionId: string): Promise<FathomSyncResultDTO> {
    const connection = await this.connectionRepository.findOne(actor.workspaceId, {
      where: { id: connectionId },
    });

    if (!isDefined(connection)) {
      throw new NotFoundError('Fathom connection not found');
    }

    await this.accessService.getAccessOrThrow({
      ...actor,
      pipelineId: connection.pipelineId,
      requireAdmin: true,
    });

    return this.syncConnection(connection.id);
  }

  async syncConnection(connectionId: string): Promise<FathomSyncResultDTO> {
    if (this.runningSyncs.has(connectionId)) {
      return { meetingsProcessed: 0, tasksCreated: 0, actionItemsSeen: 0, error: 'A sync is already running' };
    }

    this.runningSyncs.add(connectionId);

    try {
      const connection = await this.connectionRepositoryUnscoped.findOne({
        where: { id: connectionId },
      });

      if (!isDefined(connection)) {
        return { meetingsProcessed: 0, tasksCreated: 0, actionItemsSeen: 0, error: 'Connection not found' };
      }

      const startedAt = new Date();
      const createdAfter = isDefined(connection.lastSyncAt)
        ? new Date(connection.lastSyncAt.getTime() - SYNC_OVERLAP_MS)
        : new Date(startedAt.getTime() - FIRST_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

      const result = { meetingsProcessed: 0, tasksCreated: 0, actionItemsSeen: 0, error: null as string | null };
      let latestMeetingAt = connection.lastMeetingAt;

      try {
        const apiKey = this.decryptApiKey(connection);
        let cursor: string | null = null;

        for (let page = 0; page < MAX_SYNC_PAGES; page++) {
          const { items, nextCursor } = await this.fathomApiClient.listMeetings(apiKey, {
            createdAfter,
            cursor,
            includeDetails: true,
          });

          for (const meeting of items) {
            // Sin resumen Fathom aún no terminó de procesarla: la próxima pasada la toma.
            if (!isNonEmptyString(meeting.default_summary?.markdown_formatted)) {
              continue;
            }

            const ingestion = await this.ingestionService.ingestMeeting(connection, meeting);

            result.meetingsProcessed++;
            result.tasksCreated += ingestion.tasksCreated;
            result.actionItemsSeen += ingestion.actionItemsSeen;

            const meetingDate = meeting.recording_start_time
              ? new Date(meeting.recording_start_time)
              : null;

            if (meetingDate && (!latestMeetingAt || meetingDate > latestMeetingAt)) {
              latestMeetingAt = meetingDate;
            }
          }

          if (!isNonEmptyString(nextCursor)) {
            break;
          }

          cursor = nextCursor;
        }

        await this.connectionRepositoryUnscoped.update(
          { id: connection.id },
          {
            lastSyncAt: startedAt,
            lastMeetingAt: latestMeetingAt,
            status: 'ACTIVE',
            // El aviso de "sin webhook" se conserva; un error viejo de sync se limpia.
            lastError: isNonEmptyString(connection.fathomWebhookId) ? null : connection.lastError,
          },
        );
      } catch (error) {
        result.error = (error as Error).message;
        this.logger.warn(`Fathom sync failed for connection ${connection.id}: ${result.error}`);
        await this.connectionRepositoryUnscoped.update(
          { id: connection.id },
          {
            status: error instanceof FathomApiError && error.status === 401 ? 'ERROR' : connection.status,
            lastError: result.error,
          },
        );
      }

      return result;
    } finally {
      this.runningSyncs.delete(connectionId);
    }
  }

  async processWebhookMeeting(connection: FathomConnectionEntity, meeting: FathomMeeting) {
    const result = await this.ingestionService.ingestMeeting(connection, meeting);

    await this.connectionRepositoryUnscoped.update(
      { id: connection.id },
      {
        lastMeetingAt: meeting.recording_start_time
          ? new Date(meeting.recording_start_time)
          : new Date(),
      },
    );

    return result;
  }

  private async syncAllActiveConnections(): Promise<void> {
    try {
      const connections = await this.connectionRepositoryUnscoped.find({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      for (const connection of connections) {
        await this.syncConnection(connection.id);
      }
    } catch (error) {
      this.logger.warn(`Fathom backup sync failed: ${(error as Error).message}`);
    }
  }
}
