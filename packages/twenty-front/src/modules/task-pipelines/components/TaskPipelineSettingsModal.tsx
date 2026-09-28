import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useMemo, useState } from 'react';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconTrash,
} from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { MAIN_COLOR_NAMES } from 'twenty-ui/theme';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { PipelineColorSwatches } from '@/task-pipelines/components/CreateTaskPipelineModal';
import {
  MemberAvatar,
  MemberPicker,
  StyledErrorText,
  StyledFieldLabel,
  StyledHint,
  StyledSegment,
  StyledSegmented,
  StyledSelect,
  StyledTextInput,
  TaskModal,
} from '@/task-pipelines/components/TaskPipelineUi';
import { type StageDraft, type useTaskPipelines } from '@/task-pipelines/hooks/useTaskPipelines';
import { type TaskMemberInfo } from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type TaskPipeline,
  type TaskPipelineLabel,
  type TaskPipelineRole,
} from '@/task-pipelines/types/TaskPipelineTypes';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

type SettingsTab = 'general' | 'stages' | 'members' | 'fathom';

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledStageRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  position: relative;
`;

const StyledColorButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
`;

const StyledPopup = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  left: 0;
  padding: ${themeCssVariables.spacing[2]};
  position: absolute;
  top: calc(100% + 4px);
  width: 250px;
  z-index: 30;
`;

const StyledDoneToggle = styled.label`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: 4px;
  white-space: nowrap;
`;

const StyledMemberRow = styled.div`
  align-items: flex-start;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledMemberMain = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledName = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledSub = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledChips = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledChip = styled.span`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: 4px;
  padding: 1px 6px;
`;

const StyledChipRemove = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  padding: 0;
`;

const StyledConnection = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledWarning = styled.div`
  align-items: flex-start;
  background: ${themeCssVariables.tag.background.orange};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledSteps = styled.ol`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.6;
  margin: 0;
  padding-left: ${themeCssVariables.spacing[5]};
`;

const StyledDanger = styled.div`
  border: 1px solid ${themeCssVariables.color.red};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const formatWhen = (value: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t`never`;

type PipelinesApi = ReturnType<typeof useTaskPipelines>;

export const TaskPipelineSettingsModal = ({
  pipeline,
  api,
  membersById,
  allMembers,
  currentWorkspaceMemberId,
  initialTab = 'general',
  onClose,
  onDeleted,
}: {
  pipeline: TaskPipeline;
  api: PipelinesApi;
  membersById: Map<string, TaskMemberInfo>;
  allMembers: TaskMemberInfo[];
  currentWorkspaceMemberId: string | null;
  initialTab?: SettingsTab;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const isAdmin = pipeline.myRole === 'ADMIN';
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const [tab, setTab] = useState<SettingsTab>(isAdmin ? initialTab : 'members');
  const [isBusy, setIsBusy] = useState(false);

  // General
  const [name, setName] = useState(pipeline.name);
  const [color, setColor] = useState(pipeline.color);
  const [labels, setLabels] = useState<TaskPipelineLabel[]>(pipeline.labels);
  const [newLabel, setNewLabel] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');

  // Stages
  const [stages, setStages] = useState<StageDraft[]>(
    pipeline.stages.map((stage) => ({ id: stage.id, name: stage.name, color: stage.color, isDone: stage.isDone })),
  );
  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(null);
  const [fallbackStageId, setFallbackStageId] = useState<string | null>(null);

  // Members
  const [newMemberId, setNewMemberId] = useState<string | null>(null);
  const [newMemberRole, setNewMemberRole] = useState<TaskPipelineRole>('MEMBER');
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});

  // Fathom
  const [fathomLabel, setFathomLabel] = useState('');
  const [fathomKey, setFathomKey] = useState('');
  const [fathomError, setFathomError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setIsBusy(true);

    try {
      await action();

      if (success) {
        enqueueSuccessSnackBar({ message: success });
      }

      return true;
    } catch (error) {
      enqueueErrorSnackBar({ message: error instanceof Error ? error.message : t`Something went wrong` });

      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const removedStages = pipeline.stages.filter(
    (stage) => !stages.some((draft) => draft.id === stage.id),
  );
  const keptExistingStages = stages.filter((stage) => stage.id);

  const nonMembers = useMemo(
    () => allMembers.filter((member) => !pipeline.members.some((entry) => entry.workspaceMemberId === member.id)),
    [allMembers, pipeline.members],
  );

  const tabs: { key: SettingsTab; label: string }[] = isAdmin
    ? [
        { key: 'general', label: t`General` },
        { key: 'stages', label: t`Stages` },
        { key: 'members', label: t`Members` },
        { key: 'fathom', label: t`Fathom` },
      ]
    : [{ key: 'members', label: t`Members` }];

  const moveStage = (index: number, direction: -1 | 1) =>
    setStages((previous) => {
      const target = index + direction;

      if (target < 0 || target >= previous.length) {
        return previous;
      }

      const next = [...previous];

      [next[index], next[target]] = [next[target], next[index]];

      return next;
    });

  return (
    <TaskModal title={t`${pipeline.name} · settings`} width={620} onClose={onClose}>
      <StyledSegmented>
        {tabs.map((entry) => (
          <StyledSegment key={entry.key} type="button" isActive={tab === entry.key} onClick={() => setTab(entry.key)}>
            {entry.label}
          </StyledSegment>
        ))}
      </StyledSegmented>

      {tab === 'general' && isAdmin && (
        <>
          <div>
            <StyledFieldLabel>{t`Name`}</StyledFieldLabel>
            <StyledTextInput value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <StyledFieldLabel>{t`Color`}</StyledFieldLabel>
            <PipelineColorSwatches value={color} onChange={setColor} />
          </div>
          <div>
            <StyledFieldLabel>{t`Labels available in this pipeline`}</StyledFieldLabel>
            <StyledChips>
              {labels.map((label, index) => (
                <StyledChip key={label.name}>
                  <StyledColorButton
                    type="button"
                    title={t`Change color`}
                    onClick={() => {
                      const nextColor =
                        MAIN_COLOR_NAMES[(MAIN_COLOR_NAMES.indexOf(label.color as (typeof MAIN_COLOR_NAMES)[number]) + 1) % MAIN_COLOR_NAMES.length];

                      setLabels(labels.map((entry, position) => (position === index ? { ...entry, color: nextColor } : entry)));
                    }}
                  >
                    <Tag color={label.color as TagColor} text={label.name} />
                  </StyledColorButton>
                  <StyledChipRemove type="button" aria-label={t`Remove`} onClick={() => setLabels(labels.filter((_, position) => position !== index))}>
                    ✕
                  </StyledChipRemove>
                </StyledChip>
              ))}
              <StyledTextInput
                style={{ width: 160, padding: '3px 8px', fontSize: 13 }}
                placeholder={t`New label + Enter`}
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                onKeyDown={(event) => {
                  const value = newLabel.trim();

                  if (event.key === 'Enter' && value && !labels.some((label) => label.name.toLowerCase() === value.toLowerCase())) {
                    setLabels([...labels, { name: value, color: MAIN_COLOR_NAMES[labels.length % MAIN_COLOR_NAMES.length] }]);
                    setNewLabel('');
                  }
                }}
              />
            </StyledChips>
            <StyledHint>{t`Click a label to cycle its color.`}</StyledHint>
          </div>
          <div>
            <Button
              title={t`Save`}
              accent="blue"
              disabled={isBusy || name.trim().length === 0}
              onClick={() => void run(() => api.updatePipeline(pipeline.id, { name: name.trim(), color, labels }), t`Pipeline updated`)}
            />
          </div>
          <StyledDanger>
            <StyledFieldLabel style={{ marginBottom: 0 }}>{t`Delete pipeline`}</StyledFieldLabel>
            <StyledHint>
              {t`Deletes every task, comment and Fathom connection of this pipeline. Type the pipeline name to confirm.`}
            </StyledHint>
            <StyledTextInput value={confirmDelete} placeholder={pipeline.name} onChange={(event) => setConfirmDelete(event.target.value)} />
            <div>
              <Button
                title={t`Delete forever`}
                accent="danger"
                Icon={IconTrash}
                disabled={isBusy || confirmDelete !== pipeline.name}
                onClick={() =>
                  void run(() => api.deletePipeline(pipeline.id), t`Pipeline deleted`).then((ok) => {
                    if (ok) {
                      onDeleted();
                    }
                  })
                }
              />
            </div>
          </StyledDanger>
        </>
      )}

      {tab === 'stages' && isAdmin && (
        <>
          <StyledList>
            {stages.map((stage, index) => (
              <StyledStageRow key={stage.id ?? `new-${index}`}>
                <StyledColorButton type="button" title={t`Change color`} onClick={() => setColorPickerIndex(colorPickerIndex === index ? null : index)}>
                  <Tag color={stage.color as TagColor} text={stage.name || '…'} />
                </StyledColorButton>
                {colorPickerIndex === index && (
                  <StyledPopup>
                    <PipelineColorSwatches
                      value={stage.color}
                      onChange={(nextColor) => {
                        setStages(stages.map((entry, position) => (position === index ? { ...entry, color: nextColor } : entry)));
                        setColorPickerIndex(null);
                      }}
                    />
                  </StyledPopup>
                )}
                <StyledTextInput
                  style={{ flex: 1, padding: '4px 8px' }}
                  value={stage.name}
                  maxLength={60}
                  onChange={(event) =>
                    setStages(stages.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)))
                  }
                />
                <StyledDoneToggle title={t`Tasks moved here count as done`}>
                  <input
                    type="checkbox"
                    checked={stage.isDone ?? false}
                    onChange={() =>
                      setStages(stages.map((entry, position) => (position === index ? { ...entry, isDone: !entry.isDone } : entry)))
                    }
                  />
                  {t`Done`}
                </StyledDoneToggle>
                <IconButton Icon={IconChevronUp} size="small" variant="tertiary" disabled={index === 0} onClick={() => moveStage(index, -1)} />
                <IconButton Icon={IconChevronDown} size="small" variant="tertiary" disabled={index === stages.length - 1} onClick={() => moveStage(index, 1)} />
                <IconButton
                  Icon={IconTrash}
                  size="small"
                  variant="tertiary"
                  disabled={stages.length <= 1}
                  onClick={() => setStages(stages.filter((_, position) => position !== index))}
                />
              </StyledStageRow>
            ))}
          </StyledList>
          <div>
            <Button
              title={t`+ Add stage`}
              size="small"
              variant="secondary"
              onClick={() => setStages([...stages, { id: null, name: '', color: 'gray', isDone: false }])}
            />
          </div>
          {removedStages.length > 0 && (
            <StyledWarning>
              <IconAlertTriangle size={16} />
              <div>
                {t`Tasks in ${removedStages.map((stage) => stage.name).join(', ')} will move to:`}{' '}
                <StyledSelect value={fallbackStageId ?? keptExistingStages[0]?.id ?? ''} onChange={(event) => setFallbackStageId(event.target.value)}>
                  {keptExistingStages.map((stage) => (
                    <option key={stage.id ?? ''} value={stage.id ?? ''}>
                      {stage.name}
                    </option>
                  ))}
                </StyledSelect>
              </div>
            </StyledWarning>
          )}
          <div>
            <Button
              title={t`Save stages`}
              accent="blue"
              disabled={isBusy || stages.some((stage) => stage.name.trim().length === 0)}
              onClick={() =>
                void run(
                  () =>
                    api.saveStages(
                      pipeline.id,
                      stages.map((stage) => ({ ...stage, name: stage.name.trim() })),
                      fallbackStageId ?? keptExistingStages[0]?.id ?? null,
                    ),
                  t`Stages saved`,
                )
              }
            />
          </div>
        </>
      )}

      {tab === 'members' && (
        <>
          {isAdmin && pipeline.visibility === 'WORKSPACE' && nonMembers.length > 0 && (
            <div>
              <StyledFieldLabel>{t`Add a person`}</StyledFieldLabel>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <MemberPicker members={nonMembers} value={newMemberId} onChange={setNewMemberId} placeholder={t`Pick a workspace member`} />
                </div>
                <StyledSelect value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value as TaskPipelineRole)}>
                  <option value="MEMBER">{t`Member`}</option>
                  <option value="ADMIN">{t`Admin`}</option>
                </StyledSelect>
                <Button
                  title={t`Add`}
                  accent="blue"
                  disabled={!newMemberId || isBusy}
                  onClick={() =>
                    void run(async () => {
                      await api.addMember(pipeline.id, newMemberId!, newMemberRole);
                      setNewMemberId(null);
                    }, t`Member added`)
                  }
                />
              </div>
            </div>
          )}
          {isAdmin && pipeline.visibility === 'PERSONAL' && (
            <StyledHint>
              {t`This is a personal pipeline: only you see it. Invite someone only if you want them to see and work on these tasks.`}
            </StyledHint>
          )}
          {isAdmin && pipeline.visibility === 'PERSONAL' && nonMembers.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <MemberPicker members={nonMembers} value={newMemberId} onChange={setNewMemberId} placeholder={t`Invite a workspace member`} />
              </div>
              <Button
                title={t`Invite`}
                variant="secondary"
                disabled={!newMemberId || isBusy}
                onClick={() =>
                  void run(async () => {
                    await api.addMember(pipeline.id, newMemberId!, 'MEMBER');
                    setNewMemberId(null);
                  }, t`Member added`)
                }
              />
            </div>
          )}
          <StyledList>
            {pipeline.members.map((member) => {
              const info = membersById.get(member.workspaceMemberId);
              const isSelf = member.workspaceMemberId === currentWorkspaceMemberId;
              const canEditAliases = isAdmin || isSelf;
              const aliasDraft = aliasDrafts[member.workspaceMemberId] ?? '';

              return (
                <StyledMemberRow key={member.workspaceMemberId}>
                  <MemberAvatar member={info} size="md" />
                  <StyledMemberMain>
                    <StyledName>
                      {info?.fullName ?? t`Former member`} {isSelf && <StyledSub as="span">({t`you`})</StyledSub>}
                    </StyledName>
                    <StyledSub>{info?.email}</StyledSub>
                    <StyledChips>
                      <StyledSub as="span">{t`Also known in meetings as:`}</StyledSub>
                      {member.aliases.map((alias) => (
                        <StyledChip key={alias}>
                          {alias}
                          {canEditAliases && (
                            <StyledChipRemove
                              type="button"
                              aria-label={t`Remove alias`}
                              onClick={() =>
                                void run(() =>
                                  api.updateMember(pipeline.id, member.workspaceMemberId, {
                                    aliases: member.aliases.filter((entry) => entry !== alias),
                                  }),
                                )
                              }
                            >
                              ✕
                            </StyledChipRemove>
                          )}
                        </StyledChip>
                      ))}
                      {canEditAliases && (
                        <StyledTextInput
                          style={{ width: 170, padding: '2px 8px', fontSize: 13 }}
                          placeholder={t`name or email + Enter`}
                          value={aliasDraft}
                          onChange={(event) => setAliasDrafts({ ...aliasDrafts, [member.workspaceMemberId]: event.target.value })}
                          onKeyDown={(event) => {
                            const value = aliasDraft.trim();

                            if (event.key === 'Enter' && value) {
                              setAliasDrafts({ ...aliasDrafts, [member.workspaceMemberId]: '' });
                              void run(() =>
                                api.updateMember(pipeline.id, member.workspaceMemberId, {
                                  aliases: [...member.aliases, value],
                                }),
                              );
                            }
                          }}
                        />
                      )}
                    </StyledChips>
                  </StyledMemberMain>
                  {isAdmin ? (
                    <StyledSelect
                      value={member.role}
                      onChange={(event) =>
                        void run(
                          () => api.updateMember(pipeline.id, member.workspaceMemberId, { role: event.target.value as TaskPipelineRole }),
                          t`Role updated`,
                        )
                      }
                    >
                      <option value="ADMIN">{t`Admin`}</option>
                      <option value="MEMBER">{t`Member`}</option>
                    </StyledSelect>
                  ) : (
                    <Tag color={member.role === 'ADMIN' ? 'blue' : 'gray'} text={member.role === 'ADMIN' ? t`Admin` : t`Member`} />
                  )}
                  {(isAdmin || isSelf) && (
                    <IconButton
                      Icon={IconTrash}
                      size="small"
                      variant="tertiary"
                      ariaLabel={isSelf ? t`Leave pipeline` : t`Remove member`}
                      onClick={() =>
                        void run(async () => {
                          await api.removeMember(pipeline.id, member.workspaceMemberId);

                          if (isSelf) {
                            onDeleted();
                          }
                        }, isSelf ? t`You left the pipeline` : t`Member removed`)
                      }
                    />
                  )}
                </StyledMemberRow>
              );
            })}
          </StyledList>
          <StyledHint>
            {t`Aliases help assign meeting action items: Fathom sometimes hears names wrong, so add every name or email a person may appear with.`}
          </StyledHint>
        </>
      )}

      {tab === 'fathom' && isAdmin && (
        <>
          <StyledHint>
            {t`Connect one or more Fathom accounts. After every recorded meeting its summary, transcript and action items arrive here, and each action item becomes a task assigned to the right member of this pipeline.`}
          </StyledHint>
          {pipeline.fathomConnections.map((connection) => (
            <StyledConnection key={connection.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StyledName style={{ flex: 1 }}>
                  {connection.label} <StyledSub as="span">· {t`key`} {connection.apiKeyHint}</StyledSub>
                </StyledName>
                <Tag color={connection.status === 'ACTIVE' ? 'green' : 'red'} text={connection.status === 'ACTIVE' ? t`Active` : t`Error`} />
              </div>
              <StyledSub>
                {connection.fathomUserEmail && `${connection.fathomUserEmail} · `}
                {connection.hasWebhook ? t`Live updates on` : t`Live updates off`} · {t`last sync`} {formatWhen(connection.lastSyncAt)} ·{' '}
                {t`last meeting`} {formatWhen(connection.lastMeetingAt)}
              </StyledSub>
              {connection.lastError && <StyledErrorText>{connection.lastError}</StyledErrorText>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  title={t`Sync now`}
                  size="small"
                  variant="secondary"
                  Icon={IconRefresh}
                  disabled={isBusy}
                  onClick={() =>
                    void run(async () => {
                      const result = await api.syncFathom(connection.id);

                      if (result?.error) {
                        throw new Error(result.error);
                      }

                      enqueueSuccessSnackBar({
                        message: t`${result?.meetingsProcessed ?? 0} meetings checked · ${result?.tasksCreated ?? 0} new tasks`,
                      });
                    })
                  }
                />
                <Button
                  title={t`Disconnect`}
                  size="small"
                  variant="secondary"
                  accent="danger"
                  disabled={isBusy}
                  onClick={() => void run(() => api.disconnectFathom(connection.id), t`Fathom disconnected`)}
                />
              </div>
            </StyledConnection>
          ))}
          <StyledConnection>
            <StyledFieldLabel style={{ marginBottom: 0 }}>{t`Connect a Fathom account`}</StyledFieldLabel>
            <StyledSteps>
              <li>{t`Open Fathom → Settings → API Access (fathom.video/customize#api-access-header).`}</li>
              <li>{t`Generate an API key and paste it below. It is stored encrypted and never shown again.`}</li>
            </StyledSteps>
            <StyledTextInput placeholder={t`Label (e.g. Mauricio's Fathom)`} value={fathomLabel} onChange={(event) => setFathomLabel(event.target.value)} />
            <StyledTextInput
              type="password"
              autoComplete="off"
              placeholder={t`Fathom API key`}
              value={fathomKey}
              onChange={(event) => setFathomKey(event.target.value)}
            />
            {fathomError && <StyledErrorText>{fathomError}</StyledErrorText>}
            <div>
              <Button
                title={isBusy ? t`Connecting…` : t`Connect`}
                accent="blue"
                disabled={isBusy || fathomKey.trim().length < 10}
                onClick={() => {
                  setFathomError(null);
                  void (async () => {
                    setIsBusy(true);

                    try {
                      await api.connectFathom(pipeline.id, fathomLabel.trim(), fathomKey.trim());
                      setFathomKey('');
                      setFathomLabel('');
                      enqueueSuccessSnackBar({ message: t`Fathom connected — importing the last two weeks of meetings` });
                    } catch (error) {
                      setFathomError(error instanceof Error ? error.message : t`Could not connect Fathom`);
                    } finally {
                      setIsBusy(false);
                    }
                  })();
                }}
              />
            </div>
          </StyledConnection>
        </>
      )}
    </TaskModal>
  );
};
