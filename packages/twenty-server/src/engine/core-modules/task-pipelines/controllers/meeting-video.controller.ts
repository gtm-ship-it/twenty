import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { type Response } from 'express';
import { Readable } from 'stream';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { MeetingEntity } from 'src/engine/core-modules/task-pipelines/entities/meeting.entity';
import { MeetingVideoTokenService } from 'src/engine/core-modules/task-pipelines/services/meeting-video-token.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

const FATHOM_SHARE_PATTERN = /^https:\/\/fathom\.video\/share\/([A-Za-z0-9_-]+)/;
const UPSTREAM_TIMEOUT_MS = 30_000;

// Fathom no permite incrustar su reproductor (X-Frame-Options) ni lee su HLS
// desde otro origen (sin CORS). El servidor hace de proxy: reescribe el
// playlist para que cada fragmento pase por aquí con el mismo token firmado.
@Controller('task-pipelines/meetings')
export class MeetingVideoController {
  private readonly logger = new Logger(MeetingVideoController.name);

  constructor(
    @InjectWorkspaceScopedRepository(MeetingEntity)
    private readonly meetingRepository: WorkspaceScopedRepository<MeetingEntity>,
    private readonly tokenService: MeetingVideoTokenService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  private async resolveShareToken(meetingId: string, token: string | undefined) {
    const verified = this.tokenService.verifyToken(token, meetingId);

    if (!isDefined(verified)) {
      return null;
    }

    const meeting = await this.meetingRepository.findOne(verified.workspaceId, {
      where: { id: meetingId },
      select: { id: true, shareUrl: true },
    });
    const match = meeting?.shareUrl?.match(FATHOM_SHARE_PATTERN);

    return match?.[1] ?? null;
  }

  @Get(':meetingId/video/playlist.m3u8')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async playlist(
    @Param('meetingId') meetingId: string,
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ) {
    const shareToken = await this.resolveShareToken(meetingId, token);

    if (!isNonEmptyString(shareToken)) {
      response.status(404).end();

      return;
    }

    try {
      const upstream = await fetch(`https://fathom.video/share/${shareToken}/video.m3u8`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!upstream.ok) {
        response.status(upstream.status === 404 ? 404 : 502).end();

        return;
      }

      const serverUrl = String(this.twentyConfigService.get('SERVER_URL')).replace(/\/$/, '');
      const chunkBase = `${serverUrl}/task-pipelines/meetings/${meetingId}/video/chunk`;
      const body = (await upstream.text())
        .split('\n')
        .map((line) => {
          const chunk = line.trim().match(/video_chunk\?key=([^\s&]+)/);

          return chunk
            ? `${chunkBase}?key=${chunk[1]}&token=${encodeURIComponent(token ?? '')}`
            : line;
        })
        .join('\n');

      response
        .status(200)
        .setHeader('Content-Type', 'application/vnd.apple.mpegurl')
        .setHeader('Cache-Control', 'private, max-age=300')
        .send(body);
    } catch (error) {
      this.logger.warn(`Meeting video playlist failed: ${(error as Error).message}`);
      response.status(502).end();
    }
  }

  @Get(':meetingId/video/chunk')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async chunk(
    @Param('meetingId') meetingId: string,
    @Query('token') token: string | undefined,
    @Query('key') key: string | undefined,
    @Res() response: Response,
  ) {
    const shareToken = await this.resolveShareToken(meetingId, token);

    // La llave del fragmento debe tener la forma de Fathom (chunk/<id>/<archivo>.ts).
    if (
      !isNonEmptyString(shareToken) ||
      !isNonEmptyString(key) ||
      !/^chunk\/\d+\/[\w.-]+\.ts$/.test(key)
    ) {
      response.status(404).end();

      return;
    }

    try {
      const upstream = await fetch(
        `https://fathom.video/share/${shareToken}/video_chunk?key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), redirect: 'follow' },
      );

      if (!upstream.ok || !upstream.body) {
        response.status(502).end();

        return;
      }

      response.status(200);
      response.setHeader('Content-Type', 'video/mp2t');
      response.setHeader('Cache-Control', 'private, max-age=3600');

      const length = upstream.headers.get('content-length');

      if (length) {
        response.setHeader('Content-Length', length);
      }

      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(response);
    } catch (error) {
      this.logger.warn(`Meeting video chunk failed: ${(error as Error).message}`);

      if (!response.headersSent) {
        response.status(502).end();
      }
    }
  }
}
