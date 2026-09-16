import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type AxiosInstance } from 'axios';
import { isDefined } from 'twenty-shared/utils';

import {
  ATLAS_DEFAULT_API_BASE_URL,
  ATLAS_REQUEST_TIMEOUT_MS,
  ATLAS_TENANTS,
  type AtlasTenantKey,
} from 'src/engine/core-modules/atlas-calls/constants/atlas-calls.constants';
import { type AtlasCampaignDTO } from 'src/engine/core-modules/atlas-calls/dtos/atlas-campaign.dto';
import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export type AtlasScheduleOutcome = {
  ok: boolean;
  sequenceNumber: number | null;
  error: string | null;
};

type AtlasRawCampaign = {
  RowKey?: string;
  name?: string;
  Status?: string | null;
  CallType?: string | number | null;
  TimeWindows?: string | null;
  Timezone?: string | null;
};

@Injectable()
export class AtlasApiClientService {
  private readonly logger = new Logger(AtlasApiClientService.name);
  private readonly httpClient: AxiosInstance;

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    secureHttpClientService: SecureHttpClientService,
  ) {
    this.httpClient = secureHttpClientService.getHttpClient({
      timeout: ATLAS_REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
  }

  getBaseUrl(): string {
    const configured = this.twentyConfigService.get('ATLAS_API_BASE_URL');

    return (
      isNonEmptyString(configured) ? configured : ATLAS_DEFAULT_API_BASE_URL
    ).replace(/\/+$/, '');
  }

  getAllowedWorkspaceIds(): string[] {
    const raw = this.twentyConfigService.get('ATLAS_ALLOWED_WORKSPACE_IDS');

    if (!isNonEmptyString(raw)) {
      return [];
    }

    return raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  isWorkspaceAllowed(workspaceId: string): boolean {
    return this.getAllowedWorkspaceIds().includes(workspaceId);
  }

  getConfiguredTenants(): { key: AtlasTenantKey; label: string }[] {
    return ATLAS_TENANTS.filter((tenant) =>
      isNonEmptyString(this.twentyConfigService.get(tenant.configKey)),
    ).map(({ key, label }) => ({ key, label }));
  }

  getTenantLabel(tenantKey: string): string | null {
    return (
      ATLAS_TENANTS.find((tenant) => tenant.key === tenantKey)?.label ?? null
    );
  }

  private getApiKeyOrThrow(tenantKey: string): string {
    const tenant = ATLAS_TENANTS.find((entry) => entry.key === tenantKey);

    if (!isDefined(tenant)) {
      throw new Error(`Unknown Atlas tenant "${tenantKey}"`);
    }

    const apiKey = this.twentyConfigService.get(tenant.configKey);

    if (!isNonEmptyString(apiKey)) {
      throw new Error(`Atlas tenant "${tenantKey}" is not configured`);
    }

    return apiKey;
  }

  async listCampaigns(tenantKey: string): Promise<AtlasCampaignDTO[]> {
    const apiKey = this.getApiKeyOrThrow(tenantKey);

    const response = await this.httpClient.get(
      `${this.getBaseUrl()}/campaign`,
      {
        headers: { 'api-key': apiKey },
      },
    );

    if (response.status !== 200) {
      this.logger.warn(
        `Atlas GET /campaign (${tenantKey}) → HTTP ${response.status}`,
      );
      throw new Error(
        `Atlas returned HTTP ${response.status} listing campaigns`,
      );
    }

    const rawCampaigns: AtlasRawCampaign[] = Array.isArray(response.data?.value)
      ? response.data.value
      : Array.isArray(response.data)
        ? response.data
        : [];

    return rawCampaigns
      .filter(
        (campaign) =>
          isNonEmptyString(campaign.RowKey) && campaign.Status !== 'archived',
      )
      .map((campaign) => ({
        id: campaign.RowKey as string,
        name: (campaign.name ?? '').trim() || (campaign.RowKey as string),
        status: campaign.Status ?? null,
        callType: isDefined(campaign.CallType)
          ? String(campaign.CallType)
          : null,
        timeWindows: campaign.TimeWindows ?? null,
        timezone: campaign.Timezone ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async scheduleCall({
    tenantKey,
    campaignId,
    phone,
    firstName,
    lastName,
    info,
    scheduledAt,
  }: {
    tenantKey: string;
    campaignId: string;
    phone: string;
    firstName: string;
    lastName?: string | null;
    info?: string | null;
    scheduledAt?: string | null;
  }): Promise<AtlasScheduleOutcome> {
    const apiKey = this.getApiKeyOrThrow(tenantKey);

    // Mismo contrato que los dispatchers de n8n: scheduledDate "now" = inmediato.
    const body: Record<string, string> = {
      campaignId,
      customerPhoneNumber: phone,
      customerName: firstName,
      scheduledDate: isNonEmptyString(scheduledAt) ? scheduledAt : 'now',
    };

    if (isNonEmptyString(lastName)) {
      body.customerLastName = lastName;
    }

    if (isNonEmptyString(info)) {
      body.customerInfo = info;
    }

    try {
      const response = await this.httpClient.post(
        `${this.getBaseUrl()}/campaign/createSchedule`,
        body,
        { headers: { 'api-key': apiKey, 'Content-Type': 'application/json' } },
      );

      if (response.status >= 200 && response.status < 300) {
        const sequenceNumber = response.data?.sequenceNumber;

        return {
          ok: true,
          sequenceNumber:
            typeof sequenceNumber === 'number' ? sequenceNumber : null,
          error: null,
        };
      }

      const message =
        response.data?.error?.message ??
        response.data?.message ??
        `HTTP ${response.status}`;

      this.logger.warn(
        `Atlas createSchedule (${tenantKey}/${campaignId}) → ${message}`,
      );

      return { ok: false, sequenceNumber: null, error: String(message) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Atlas createSchedule (${tenantKey}/${campaignId}) failed: ${message}`,
      );

      return { ok: false, sequenceNumber: null, error: message };
    }
  }
}
