import { Injectable } from '@nestjs/common';

import { createHmac, timingSafeEqual } from 'crypto';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const TOKEN_TTL_SECONDS = 4 * 60 * 60;

// El <video> no puede mandar el token de sesión en un header, así que el
// reproductor recibe un token firmado de corta duración atado a UNA reunión.
@Injectable()
export class MeetingVideoTokenService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  private sign(payload: string): string {
    return createHmac(
      'sha256',
      `${this.twentyConfigService.get('APP_SECRET')}:meeting-video`,
    )
      .update(payload)
      .digest('base64url');
  }

  createToken(
    workspaceId: string,
    meetingId: string,
    workspaceMemberId: string,
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const payload = `${workspaceId}.${meetingId}.${workspaceMemberId}.${expiresAt}`;

    return `${Buffer.from(payload).toString('base64url')}.${this.sign(payload)}`;
  }

  verifyToken(
    token: string | undefined,
    meetingId: string,
  ): { workspaceId: string; workspaceMemberId: string } | null {
    if (!token || !token.includes('.')) {
      return null;
    }

    const [encodedPayload, signature] = token.split('.');
    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const [workspaceId, tokenMeetingId, workspaceMemberId, expiresAt] =
      payload.split('.');

    if (
      tokenMeetingId !== meetingId ||
      Number(expiresAt) < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    const expected = Buffer.from(this.sign(payload));
    const received = Buffer.from(signature ?? '');

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      return null;
    }

    return { workspaceId, workspaceMemberId };
  }
}
