import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { fromZonedTime } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconAlertTriangle, IconCheck, IconPhone } from 'twenty-ui/icon';
import { Button, Checkbox } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useSnackBarOnQueryError } from '@/apollo/hooks/useSnackBarOnQueryError';
import {
  ATLAS_SCHEDULE_CALLS,
  GET_ATLAS_CALL_CAMPAIGNS,
  GET_ATLAS_CALL_TARGETS,
  GET_ATLAS_CALL_TENANTS,
} from '@/atlas-calls/graphql/atlasCallsGraphql';
import { useAtlasCallNotes } from '@/atlas-calls/hooks/useAtlasCallNotes';
import {
  ATLAS_MAX_TARGET_RECORDS,
  useAtlasTargetRecordIds,
} from '@/atlas-calls/hooks/useAtlasTargetRecordIds';
import {
  type AtlasCallTarget,
  type AtlasCampaign,
  type AtlasScheduleCallsResult,
  type AtlasTenant,
} from '@/atlas-calls/types/AtlasCallTypes';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Select } from '@/ui/input/components/Select';
import { useUserTimezone } from '@/ui/input/components/internal/date/hooks/useUserTimezone';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { SidePanelProvider } from '@/ui/layout/side-panel/contexts/SidePanelContext';

const ATLAS_CALL_CONFIRMATION_MODAL_ID = 'atlas-call-confirmation';

type ScheduleMode = 'now' | 'later';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const StyledContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSectionTitle = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  text-transform: uppercase;
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledWarning = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledDateTimeInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[2]};
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const StyledTargetList = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
`;

const StyledTargetRow = styled.label<{ disabled: boolean }>`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
  padding: ${themeCssVariables.spacing[2]};

  &:last-child {
    border-bottom: none;
  }
`;

const StyledTargetText = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

const StyledTargetName = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledTargetMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledPhone = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  white-space: nowrap;
`;

const StyledFooter = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledResultLine = styled.div<{ ok: boolean }>`
  align-items: center;
  color: ${({ ok }) =>
    ok ? themeCssVariables.font.color.primary : themeCssVariables.color.red};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const targetKey = (target: AtlasCallTarget) =>
  `${target.recordId}::${target.personId ?? ''}::${target.phone ?? ''}`;

const toDateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const AtlasCallContainer = ({
  contextStoreInstanceId,
}: {
  contextStoreInstanceId: string;
}) => {
  const { t } = useLingui();
  const apolloCoreClient = useApolloCoreClient();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const { openModal } = useModal();
  const { closeSidePanelMenu } = useSidePanelMenu();
  const { userTimezone } = useUserTimezone();
  const { createAtlasCallNotes } = useAtlasCallNotes();

  const { objectMetadataItem, fetchTargetRecordIds } = useAtlasTargetRecordIds({
    contextStoreInstanceId,
  });

  const [recordIds, setRecordIds] = useState<string[] | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [tenantKey, setTenantKey] = useState<string>('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
  const [scheduledLocal, setScheduledLocal] = useState<string>(() =>
    toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [uncheckedKeys, setUncheckedKeys] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AtlasScheduleCallsResult | null>(null);

  useEffect(() => {
    let isCancelled = false;

    fetchTargetRecordIds()
      .then(({ recordIds: ids, isTruncated: truncated }) => {
        if (!isCancelled) {
          setRecordIds(ids);
          setIsTruncated(truncated);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setRecordIds([]);
        }
      });

    return () => {
      isCancelled = true;
    };
    // Solo al abrir: la selección no cambia mientras el panel está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tenantsData, loading: isLoadingTenants } = useQuery<{
    atlasCallTenants: AtlasTenant[];
  }>(GET_ATLAS_CALL_TENANTS, { client: apolloCoreClient });

  const tenants = tenantsData?.atlasCallTenants ?? [];

  useEffect(() => {
    if (tenantKey === '' && tenants.length > 0) {
      setTenantKey(tenants[0].key);
    }
  }, [tenants, tenantKey]);

  const {
    data: campaignsData,
    loading: isLoadingCampaigns,
    error: campaignsError,
  } = useQuery<{ atlasCallCampaigns: AtlasCampaign[] }>(
    GET_ATLAS_CALL_CAMPAIGNS,
    {
      client: apolloCoreClient,
      skip: tenantKey === '',
      variables: { tenantKey },
      fetchPolicy: 'network-only',
    },
  );

  useSnackBarOnQueryError(campaignsError);

  const campaigns = campaignsData?.atlasCallCampaigns ?? [];

  useEffect(() => {
    if (
      campaignId !== '' &&
      !campaigns.some((campaign) => campaign.id === campaignId)
    ) {
      setCampaignId('');
    }
  }, [campaigns, campaignId]);

  const {
    data: targetsData,
    loading: isLoadingTargets,
    error: targetsError,
  } = useQuery<{ atlasCallTargets: AtlasCallTarget[] }>(
    GET_ATLAS_CALL_TARGETS,
    {
      client: apolloCoreClient,
      skip: !isDefined(recordIds) || recordIds.length === 0,
      variables: {
        objectNameSingular: objectMetadataItem.nameSingular,
        recordIds: recordIds ?? [],
      },
      fetchPolicy: 'network-only',
    },
  );

  useSnackBarOnQueryError(targetsError);

  const targets = targetsData?.atlasCallTargets ?? [];

  const callableTargets = useMemo(
    () => targets.filter((target) => isNonEmptyString(target.phone)),
    [targets],
  );

  const selectedTargets = useMemo(
    () =>
      callableTargets.filter((target) => !uncheckedKeys.has(targetKey(target))),
    [callableTargets, uncheckedKeys],
  );

  const skippedCount = targets.length - callableTargets.length;

  const [scheduleCalls] = useMutation<{
    atlasScheduleCalls: AtlasScheduleCallsResult;
  }>(ATLAS_SCHEDULE_CALLS, { client: apolloCoreClient });

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === campaignId,
  );

  const scheduledAtIso = useMemo(() => {
    if (scheduleMode === 'now') {
      return null;
    }

    if (!isNonEmptyString(scheduledLocal)) {
      return null;
    }

    const utcDate = fromZonedTime(scheduledLocal, userTimezone);

    return Number.isNaN(utcDate.getTime()) ? null : utcDate.toISOString();
  }, [scheduleMode, scheduledLocal, userTimezone]);

  const isScheduleInvalid =
    scheduleMode === 'later' &&
    (!isDefined(scheduledAtIso) ||
      new Date(scheduledAtIso).getTime() < Date.now() - 60_000);

  const scheduledLabel =
    scheduleMode === 'now' || !isDefined(scheduledAtIso)
      ? t`as soon as possible`
      : t`scheduled for ${new Date(scheduledAtIso).toLocaleString(undefined, {
          timeZone: userTimezone,
          dateStyle: 'medium',
          timeStyle: 'short',
        })} (${userTimezone})`;

  const canSubmit =
    !isSubmitting &&
    tenantKey !== '' &&
    campaignId !== '' &&
    selectedTargets.length > 0 &&
    !isScheduleInvalid;

  const handleToggleTarget = (target: AtlasCallTarget, checked: boolean) => {
    setUncheckedKeys((previous) => {
      const next = new Set(previous);

      if (checked) {
        next.delete(targetKey(target));
      } else {
        next.add(targetKey(target));
      }

      return next;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    setUncheckedKeys(
      checked ? new Set() : new Set(callableTargets.map(targetKey)),
    );
  };

  const handleConfirmedSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data } = await scheduleCalls({
        variables: {
          input: {
            tenantKey,
            campaignId,
            scheduledAt: scheduledAtIso,
            targets: selectedTargets.map((target) => ({
              recordId: target.recordId,
              phone: target.phone,
              firstName: target.firstName,
              lastName: target.lastName,
              info: [
                isNonEmptyString(target.companyName)
                  ? `Company: ${target.companyName}`
                  : null,
                `CRM ${target.objectNameSingular}: ${target.recordLabel}`,
              ]
                .filter(isDefined)
                .join(' · '),
            })),
          },
        },
      });

      const scheduleResult = data?.atlasScheduleCalls;

      if (!isDefined(scheduleResult)) {
        throw new Error(t`Atlas did not return a result`);
      }

      setResult(scheduleResult);

      try {
        await createAtlasCallNotes({
          targets: selectedTargets,
          result: scheduleResult,
          scheduledLabel,
        });
      } catch {
        enqueueErrorSnackBar({
          message: t`Calls were sent to Atlas, but the notes could not be created in the CRM.`,
        });
      }

      if (scheduleResult.failedCount === 0) {
        enqueueSuccessSnackBar({
          message: t`${scheduleResult.scheduledCount} call(s) sent to Atlas · ${scheduleResult.campaignName}`,
        });
      }
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Could not send the calls to Atlas.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPreparing = recordIds === null || isLoadingTargets;
  const hasNoAccess = !isLoadingTenants && tenants.length === 0;

  const labelByKey = new Map(
    targets.map((target) => [targetKey(target), target]),
  );

  if (isDefined(result)) {
    return (
      <SidePanelProvider value={{ isInSidePanel: true }}>
        <StyledContainer>
          <StyledContent>
            <StyledSection>
              <StyledSectionTitle>{t`Result`}</StyledSectionTitle>
              <StyledResultLine ok>
                <IconCheck size={16} />
                {t`${result.scheduledCount} call(s) sent to "${result.campaignName}" (${result.tenantLabel}), ${scheduledLabel}.`}
              </StyledResultLine>
              {result.failedCount > 0 && (
                <StyledResultLine ok={false}>
                  <IconAlertTriangle size={16} />
                  {t`${result.failedCount} call(s) were rejected by Atlas:`}
                </StyledResultLine>
              )}
            </StyledSection>
            {result.failedCount > 0 && (
              <StyledTargetList>
                {result.results
                  .filter((entry) => !entry.ok)
                  .map((entry) => {
                    const target = selectedTargets.find(
                      (candidate) =>
                        candidate.recordId === entry.recordId &&
                        candidate.phone === entry.phone,
                    );

                    return (
                      <StyledTargetRow
                        key={`${entry.recordId}-${entry.phone}`}
                        disabled
                      >
                        <StyledTargetText>
                          <StyledTargetName>
                            {target
                              ? `${target.firstName} ${target.lastName ?? ''}`.trim()
                              : entry.recordId}
                          </StyledTargetName>
                          <StyledTargetMeta>
                            {entry.error ?? t`Unknown error`}
                          </StyledTargetMeta>
                        </StyledTargetText>
                        <StyledPhone>{entry.phone}</StyledPhone>
                      </StyledTargetRow>
                    );
                  })}
              </StyledTargetList>
            )}
            <StyledHint>
              {t`A note was added to each record that was sent. Call outcomes live in the Atlas dashboard.`}
            </StyledHint>
          </StyledContent>
          <StyledFooter>
            <Button
              title={t`Close`}
              variant="primary"
              accent="blue"
              onClick={closeSidePanelMenu}
            />
          </StyledFooter>
        </StyledContainer>
      </SidePanelProvider>
    );
  }

  return (
    <SidePanelProvider value={{ isInSidePanel: true }}>
      <StyledContainer>
        <StyledContent>
          {hasNoAccess && (
            <StyledWarning>
              <IconAlertTriangle size={16} />
              {t`Atlas calling is not enabled for this workspace. Ask the server admin to set the Atlas keys and allow this workspace.`}
            </StyledWarning>
          )}

          <StyledSection>
            <StyledSectionTitle>{t`Campaign`}</StyledSectionTitle>
            <Select
              dropdownId="atlas-call-tenant-select"
              label={t`Atlas account`}
              fullWidth
              disabled={isLoadingTenants || tenants.length === 0}
              value={tenantKey}
              options={tenants.map((tenant) => ({
                value: tenant.key,
                label: tenant.label,
              }))}
              emptyOption={{ value: '', label: t`Select an account` }}
              onChange={(value) => {
                setTenantKey(value);
                setCampaignId('');
              }}
            />
            <Select
              dropdownId="atlas-call-campaign-select"
              label={t`Atlas campaign`}
              fullWidth
              withSearchInput
              disabled={tenantKey === '' || isLoadingCampaigns}
              value={campaignId}
              options={campaigns.map((campaign) => ({
                value: campaign.id,
                label: campaign.name,
                contextualText:
                  campaign.status === 'draft' ? t`draft` : undefined,
              }))}
              emptyOption={{
                value: '',
                label: isLoadingCampaigns
                  ? t`Loading campaigns…`
                  : t`Select a campaign`,
              }}
              onChange={setCampaignId}
            />
            {isDefined(selectedCampaign) &&
              isNonEmptyString(selectedCampaign.timezone) && (
                <StyledHint>
                  {t`Campaign timezone: ${selectedCampaign.timezone}. Atlas only dials inside the campaign's time windows.`}
                </StyledHint>
              )}
          </StyledSection>

          <StyledSection>
            <StyledSectionTitle>{t`When`}</StyledSectionTitle>
            <Select<ScheduleMode>
              dropdownId="atlas-call-schedule-select"
              fullWidth
              value={scheduleMode}
              options={[
                { value: 'now', label: t`Call as soon as possible` },
                { value: 'later', label: t`Schedule for a date and time` },
              ]}
              onChange={setScheduleMode}
            />
            {scheduleMode === 'later' && (
              <>
                <StyledDateTimeInput
                  type="datetime-local"
                  value={scheduledLocal}
                  min={toDateTimeLocalValue(new Date())}
                  onChange={(event) => setScheduledLocal(event.target.value)}
                />
                <StyledHint>
                  {isScheduleInvalid
                    ? t`Pick a date and time in the future.`
                    : t`Times are in your timezone (${userTimezone}).`}
                </StyledHint>
              </>
            )}
          </StyledSection>

          <StyledSection>
            <StyledSectionTitle>
              {isPreparing
                ? t`People to call`
                : t`People to call · ${selectedTargets.length} of ${callableTargets.length} selected`}
            </StyledSectionTitle>
            {isPreparing && (
              <StyledHint>{t`Resolving phone numbers…`}</StyledHint>
            )}
            {!isPreparing && targets.length === 0 && (
              <StyledHint>{t`No records selected.`}</StyledHint>
            )}
            {isTruncated && (
              <StyledWarning>
                <IconAlertTriangle size={16} />
                {t`Only the first ${ATLAS_MAX_TARGET_RECORDS} records of the selection are included.`}
              </StyledWarning>
            )}
            {!isPreparing && callableTargets.length > 1 && (
              <StyledTargetRow disabled={false}>
                <Checkbox
                  checked={selectedTargets.length === callableTargets.length}
                  indeterminate={
                    selectedTargets.length > 0 &&
                    selectedTargets.length < callableTargets.length
                  }
                  onCheckedChange={handleToggleAll}
                />
                <StyledTargetText>
                  <StyledTargetName>{t`Select all with a phone number`}</StyledTargetName>
                </StyledTargetText>
              </StyledTargetRow>
            )}
            {!isPreparing && targets.length > 0 && (
              <StyledTargetList>
                {targets.map((target) => {
                  const key = targetKey(target);
                  const isCallable = isNonEmptyString(target.phone);
                  const isChecked = isCallable && !uncheckedKeys.has(key);
                  const fullName =
                    `${target.firstName} ${target.lastName ?? ''}`.trim();

                  return (
                    <StyledTargetRow key={key} disabled={!isCallable}>
                      <Checkbox
                        checked={isChecked}
                        disabled={!isCallable}
                        onCheckedChange={(checked) =>
                          handleToggleTarget(target, checked)
                        }
                      />
                      <StyledTargetText>
                        <StyledTargetName>{fullName}</StyledTargetName>
                        <StyledTargetMeta>
                          {[
                            target.objectNameSingular !== 'person'
                              ? target.recordLabel
                              : null,
                            target.companyName,
                            isCallable
                              ? target.phoneSource
                              : (target.reason ?? t`No phone number`),
                          ]
                            .filter(isNonEmptyString)
                            .join(' · ')}
                        </StyledTargetMeta>
                      </StyledTargetText>
                      {isCallable && <StyledPhone>{target.phone}</StyledPhone>}
                    </StyledTargetRow>
                  );
                })}
              </StyledTargetList>
            )}
            {!isPreparing && skippedCount > 0 && (
              <StyledHint>
                {t`${skippedCount} record(s) have no phone number and will be skipped.`}
              </StyledHint>
            )}
          </StyledSection>
        </StyledContent>

        <StyledFooter>
          <Button
            title={t`Cancel`}
            variant="secondary"
            onClick={closeSidePanelMenu}
            disabled={isSubmitting}
          />
          <Button
            Icon={IconPhone}
            title={
              selectedTargets.length > 0
                ? t`Send ${selectedTargets.length} call(s) to Atlas`
                : t`Send to Atlas`
            }
            variant="primary"
            accent="blue"
            disabled={!canSubmit}
            isLoading={isSubmitting}
            onClick={() => openModal(ATLAS_CALL_CONFIRMATION_MODAL_ID)}
          />
        </StyledFooter>

        <ConfirmationModal
          modalInstanceId={ATLAS_CALL_CONFIRMATION_MODAL_ID}
          title={t`Send ${selectedTargets.length} call(s) to Atlas?`}
          subtitle={t`Campaign "${selectedCampaign?.name ?? ''}" (${
            tenants.find((tenant) => tenant.key === tenantKey)?.label ?? ''
          }), ${scheduledLabel}. Atlas will dial these numbers with the campaign's AI agent.`}
          onConfirmClick={handleConfirmedSubmit}
          confirmButtonText={t`Send calls`}
          confirmButtonAccent="blue"
          loading={isSubmitting}
        />
      </StyledContainer>
    </SidePanelProvider>
  );
};
