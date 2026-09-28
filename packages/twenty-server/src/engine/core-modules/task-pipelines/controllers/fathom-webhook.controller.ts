import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { FathomConnectionsService } from 'src/engine/core-modules/task-pipelines/fathom/fathom-connections.service';
import { type FathomMeeting } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { verifyFathomSignature } from 'src/engine/core-modules/task-pipelines/utils/verify-fathom-signature.util';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

const RECENT_DELIVERY_TTL_MS = 60 * 60 * 1000;

// Fathom → "new-meeting-content-ready". Una URL por conexión: el id identifica
// el tablero y el secreto propio verifica la firma. Se responde enseguida y se
// procesa detrás; si algo falla, el respaldo periódico lo recupera.
@Controller('webhooks/fathom')
export class FathomWebhookController {
  private readonly logger = new Logger(FathomWebhookController.name);
  private readonly recentDeliveries = new Map<string, number>();

  constructor(private readonly fathomConnectionsService: FathomConnectionsService) {}

  @Post(':connectionId')
  @HttpCode(200)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async handle(
    @Param('connectionId') connectionId: string,
    @Headers('webhook-id') webhookId: string | undefined,
    @Headers('webhook-timestamp') webhookTimestamp: string | undefined,
    @Headers('webhook-signature') webhookSignature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ ok: boolean }> {
    const connection = await this.fathomConnectionsService.findConnectionForWebhook(connectionId);

    // Misma respuesta para "no existe" y "firma mala": no se revela nada.
    if (!isDefined(connection) || !isDefined(request.rawBody)) {
      return { ok: false };
    }

    const secret = this.fathomConnectionsService.decryptWebhookSecret(connection);

    if (
      !isDefined(secret) ||
      !verifyFathomSignature({
        secret,
        webhookId,
        webhookTimestamp,
        webhookSignature,
        rawBody: request.rawBody,
      })
    ) {
      this.logger.warn(`Rejected Fathom webhook for connection ${connectionId}: bad signature`);

      return { ok: false };
    }

    this.pruneDeliveries();

    if (isDefined(webhookId) && this.recentDeliveries.has(webhookId)) {
      return { ok: true };
    }

    if (isDefined(webhookId)) {
      this.recentDeliveries.set(webhookId, Date.now());
    }

    let meeting: FathomMeeting;

    try {
      meeting = JSON.parse(request.rawBody.toString('utf8')) as FathomMeeting;
    } catch {
      return { ok: false };
    }

    setImmediate(() => {
      this.fathomConnectionsService
        .processWebhookMeeting(connection, meeting)
        .then((result) =>
          this.logger.log(
            `Fathom webhook ${webhookId ?? '?'} → meeting ${result.meetingId}, ${result.tasksCreated} task(s)`,
          ),
        )
        .catch((error) => {
          // Se olvida la entrega para que un reintento de Fathom vuelva a intentarlo.
          if (isDefined(webhookId)) {
            this.recentDeliveries.delete(webhookId);
          }

          this.logger.error(
            `Fathom webhook processing failed for connection ${connectionId}: ${(error as Error).message}`,
          );
        });
    });

    return { ok: true };
  }

  private pruneDeliveries() {
    const cutoff = Date.now() - RECENT_DELIVERY_TTL_MS;

    for (const [id, receivedAt] of this.recentDeliveries) {
      if (receivedAt < cutoff) {
        this.recentDeliveries.delete(id);
      }
    }
  }
}
