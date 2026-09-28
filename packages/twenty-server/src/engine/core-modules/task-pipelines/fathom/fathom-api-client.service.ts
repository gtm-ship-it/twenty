import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { type FathomMeeting } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const DEFAULT_FATHOM_API_BASE_URL = 'https://api.fathom.ai/external/v1';
const REQUEST_TIMEOUT_MS = 30_000;

export class FathomApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

// Cliente mínimo de la API pública de Fathom (llave por usuario, header X-Api-Key).
// Docs: https://developers.fathom.ai/api-overview
@Injectable()
export class FathomApiClientService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  private get baseUrl(): string {
    const configured = this.twentyConfigService.get('FATHOM_API_BASE_URL');

    return (isNonEmptyString(configured) ? configured : DEFAULT_FATHOM_API_BASE_URL).replace(
      /\/$/,
      '',
    );
  }

  private async request<T>(
    apiKey: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        const reason =
          response.status === 401 || response.status === 403
            ? 'Fathom rejected the API key'
            : response.status === 429
              ? 'Fathom rate limit reached, try again in a minute'
              : `Fathom responded ${response.status}`;

        throw new FathomApiError(`${reason}${text ? `: ${text.slice(0, 200)}` : ''}`, response.status);
      }

      return (text ? JSON.parse(text) : {}) as T;
    } catch (error) {
      if (error instanceof FathomApiError) {
        throw error;
      }

      throw new FathomApiError(
        (error as Error).name === 'AbortError'
          ? 'Fathom did not answer in time'
          : `Could not reach Fathom: ${(error as Error).message}`,
        0,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async listMeetings(
    apiKey: string,
    {
      createdAfter,
      cursor,
      includeDetails,
    }: { createdAfter?: Date; cursor?: string | null; includeDetails: boolean },
  ): Promise<{ items: FathomMeeting[]; nextCursor: string | null }> {
    const params = new URLSearchParams();

    if (createdAfter) {
      params.set('created_after', createdAfter.toISOString());
    }

    if (cursor) {
      params.set('cursor', cursor);
    }

    if (includeDetails) {
      params.set('include_action_items', 'true');
      params.set('include_summary', 'true');
      params.set('include_transcript', 'true');
    }

    const payload = await this.request<{
      items?: FathomMeeting[];
      next_cursor?: string | null;
    }>(apiKey, 'GET', `/meetings?${params.toString()}`);

    return { items: payload.items ?? [], nextCursor: payload.next_cursor ?? null };
  }

  async createWebhook(
    apiKey: string,
    destinationUrl: string,
  ): Promise<{ id: string; secret: string }> {
    const payload = await this.request<{ id?: string | number; secret?: string }>(
      apiKey,
      'POST',
      '/webhooks',
      {
        destination_url: destinationUrl,
        triggered_for: ['my_recordings', 'shared_external_recordings', 'my_shared_with_team_recordings'],
        include_action_items: true,
        include_summary: true,
        include_transcript: true,
        include_crm_matches: false,
      },
    );

    if (payload.id === undefined || !isNonEmptyString(payload.secret)) {
      throw new FathomApiError('Fathom did not return the webhook id and secret', 0);
    }

    return { id: String(payload.id), secret: payload.secret };
  }

  async deleteWebhook(apiKey: string, webhookId: string): Promise<void> {
    try {
      await this.request(apiKey, 'DELETE', `/webhooks/${encodeURIComponent(webhookId)}`);
    } catch (error) {
      // Ya no existe en Fathom: no es un error para nosotros.
      if (error instanceof FathomApiError && error.status === 404) {
        return;
      }

      throw error;
    }
  }
}
