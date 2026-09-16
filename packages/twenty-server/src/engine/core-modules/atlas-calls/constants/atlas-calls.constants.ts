export const ATLAS_DEFAULT_API_BASE_URL = 'https://api.youratlas.com/v1/api';
export const ATLAS_REQUEST_TIMEOUT_MS = 20_000;
// Espaciado entre llamadas a createSchedule: Atlas corta la conexión bajo ráfagas (visto en n8n).
export const ATLAS_SCHEDULE_SPACING_MS = 200;
export const ATLAS_MAX_TARGETS_PER_REQUEST = 300;
export const ATLAS_MAX_RECORDS_TO_RESOLVE = 500;

export type AtlasTenantKey = 'pts' | 'sunset';

export const ATLAS_TENANTS: {
  key: AtlasTenantKey;
  label: string;
  configKey: 'ATLAS_TENANT_PTS_API_KEY' | 'ATLAS_TENANT_SUNSET_API_KEY';
}[] = [
  {
    key: 'pts',
    label: 'PTS (admin.ptstax.com)',
    configKey: 'ATLAS_TENANT_PTS_API_KEY',
  },
  {
    key: 'sunset',
    label: 'Sunset Finance',
    configKey: 'ATLAS_TENANT_SUNSET_API_KEY',
  },
];
