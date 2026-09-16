export type AtlasTenant = {
  key: string;
  label: string;
};

export type AtlasCampaign = {
  id: string;
  name: string;
  status: string | null;
  callType: string | null;
  timeWindows: string | null;
  timezone: string | null;
};

export type AtlasCallTarget = {
  recordId: string;
  objectNameSingular: string;
  recordLabel: string;
  personId: string | null;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  phone: string | null;
  phoneSource: string | null;
  reason: string | null;
};

export type AtlasScheduleCallResult = {
  recordId: string;
  phone: string;
  ok: boolean;
  sequenceNumber: number | null;
  error: string | null;
};

export type AtlasScheduleCallsResult = {
  scheduledCount: number;
  failedCount: number;
  campaignName: string;
  tenantLabel: string;
  results: AtlasScheduleCallResult[];
};
