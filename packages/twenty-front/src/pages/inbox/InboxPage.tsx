import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { IconInbox } from 'twenty-ui/icon';

import { themeCssVariables } from 'twenty-ui/theme-constants';

import { InboxPipelineBoard } from '@/inbox/components/InboxPipelineBoard';
import { InboxThreadList } from '@/inbox/components/InboxThreadList';
import { PipelineEditorModal } from '@/inbox/components/PipelineEditorModal';
import { SignatureEditorModal } from '@/inbox/components/SignatureEditorModal';
import { useInboxPipelines } from '@/inbox/hooks/useInboxPipelines';
import { useInboxSignature } from '@/inbox/hooks/useInboxSignature';
import { type InboxPipeline } from '@/inbox/types/InboxPipeline';
import { GET_MY_CONNECTED_ACCOUNTS } from '@/settings/accounts/graphql/queries/getMyConnectedAccounts';
import { Select } from '@/ui/input/components/Select';

const PANEL_CORNER_RADIUS_DERIVED_FROM_THEME_SCALE = `calc(${themeCssVariables.border.radius.md} + ${themeCssVariables.spacing[1]})`;

const StyledPanel = styled.div`
  background: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${PANEL_CORNER_RADIUS_DERIVED_FROM_THEME_SCALE} 0 0
    ${PANEL_CORNER_RADIUS_DERIVED_FROM_THEME_SCALE};
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledAccountTabs = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  margin-left: auto;
`;

const StyledAccountTab = styled.button<{ active: boolean }>`
  background: ${({ active }) =>
    active ? themeCssVariables.background.transparent.light : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ active }) =>
    active
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledSearchInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  max-width: 420px;
  outline: none;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }

  &:focus {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledViewTabs = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const StyledEditTabContainer = styled.div`
  margin-left: auto;
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
`;

type MyConnectedAccount = {
  id: string;
  handle: string;
  authFailedAt: string | null;
  archivedAt: string | null;
};

export const InboxPage = () => {
  const { data, loading } = useQuery<{
    myConnectedAccounts: MyConnectedAccount[];
  }>(GET_MY_CONNECTED_ACCOUNTS);

  const accounts = (data?.myConnectedAccounts ?? []).filter(
    (account) => !account.archivedAt,
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );

  const activeAccountId =
    selectedAccountId &&
    accounts.some((account) => account.id === selectedAccountId)
      ? selectedAccountId
      : (accounts[0]?.id ?? null);

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // debounce: no consultar en cada tecla
  useEffect(() => {
    const timeoutId = setTimeout(() => setSearchTerm(searchInput), 350);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const { pipelines, savePipelines } = useInboxPipelines();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    null,
  );
  const [pipelineEditorState, setPipelineEditorState] = useState<
    { pipeline: InboxPipeline | null } | null
  >(null);

  const selectedPipeline =
    pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? null;

  const handleSavePipeline = async (pipeline: InboxPipeline) => {
    const exists = pipelines.some((existing) => existing.id === pipeline.id);
    const nextPipelines = exists
      ? pipelines.map((existing) =>
          existing.id === pipeline.id ? pipeline : existing,
        )
      : [...pipelines, pipeline];

    await savePipelines(nextPipelines);
    setPipelineEditorState(null);
    setSelectedPipelineId(pipeline.id);
  };

  const handleDeletePipeline = async (pipelineId: string) => {
    await savePipelines(
      pipelines.filter((pipeline) => pipeline.id !== pipelineId),
    );
    setPipelineEditorState(null);

    if (selectedPipelineId === pipelineId) {
      setSelectedPipelineId(null);
    }
  };

  const handleMoveCard = async (threadId: string, columnIndex: number) => {
    if (!selectedPipeline) {
      return;
    }

    await savePipelines(
      pipelines.map((pipeline) =>
        pipeline.id === selectedPipeline.id
          ? {
              ...pipeline,
              cardColumns: {
                ...pipeline.cardColumns,
                [threadId]: columnIndex,
              },
            }
          : pipeline,
      ),
    );
  };

  const { signature, saveSignature, isSaving: isSavingSignature } =
    useInboxSignature();
  const [isSignatureEditorOpen, setIsSignatureEditorOpen] = useState(false);

  const handleExcludeRule = async (rule: string, threadId: string) => {
    if (!selectedPipeline) {
      return;
    }

    await savePipelines(
      pipelines.map((pipeline) => {
        if (pipeline.id !== selectedPipeline.id) {
          return pipeline;
        }

        const { [threadId]: _removed, ...remainingCardColumns } =
          pipeline.cardColumns;

        return {
          ...pipeline,
          rules:
            pipeline.mode === 'EXCLUDE'
              ? pipeline.rules.includes(rule)
                ? pipeline.rules
                : [...pipeline.rules, rule]
              : pipeline.rules.filter(
                  (existingRule) =>
                    existingRule !== rule &&
                    !(
                      rule.startsWith('@') && existingRule.endsWith(rule)
                    ),
                ),
          cardColumns: remainingCardColumns,
        };
      }),
    );
  };

  const handleRemoveFromPipeline = async (threadId: string) => {
    if (!selectedPipeline) {
      return;
    }

    await savePipelines(
      pipelines.map((pipeline) => {
        if (pipeline.id !== selectedPipeline.id) {
          return pipeline;
        }

        const { [threadId]: _removed, ...remainingCardColumns } =
          pipeline.cardColumns;

        return { ...pipeline, cardColumns: remainingCardColumns };
      }),
    );
  };

  const handleAddToPipeline = async (threadId: string, pipelineId: string) => {
    await savePipelines(
      pipelines.map((pipeline) =>
        pipeline.id === pipelineId
          ? {
              ...pipeline,
              cardColumns: {
                ...pipeline.cardColumns,
                [threadId]: pipeline.cardColumns[threadId] ?? 0,
              },
            }
          : pipeline,
      ),
    );
  };

  return (
    <StyledPanel>
      <StyledHeader>
        <IconInbox size={16} />
        <StyledTitle>{t`Email`}</StyledTitle>
        <StyledSearchInput
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t`Search emails by name, address, subject or text`}
        />
        {accounts.length > 1 && !selectedPipeline && (
          <StyledAccountTabs>
            <Select
              dropdownId="inbox-account-select"
              options={accounts.map((account) => ({
                value: account.id,
                label: account.handle,
              }))}
              value={activeAccountId ?? undefined}
              onChange={(value) => setSelectedAccountId(value)}
            />
          </StyledAccountTabs>
        )}
      </StyledHeader>
            {!loading && accounts.length === 0 && (
        <StyledEmptyState>
          {t`Connect an email account in Settings → Accounts to see your inbox here.`}
        </StyledEmptyState>
      )}
      {activeAccountId && (
        <StyledViewTabs>
          <StyledAccountTab
            active={selectedPipeline === null}
            onClick={() => setSelectedPipelineId(null)}
          >
            {t`Inbox`}
          </StyledAccountTab>
          {pipelines.map((pipeline) => (
            <StyledAccountTab
              key={pipeline.id}
              active={pipeline.id === selectedPipelineId}
              onClick={() => setSelectedPipelineId(pipeline.id)}
              onDoubleClick={() => setPipelineEditorState({ pipeline })}
            >
              {pipeline.name}
            </StyledAccountTab>
          ))}
          <StyledAccountTab
            active={false}
            onClick={() => setPipelineEditorState({ pipeline: null })}
          >
            {t`+ Pipeline`}
          </StyledAccountTab>
          <StyledEditTabContainer>
            <StyledAccountTab
              active={false}
              onClick={() => setIsSignatureEditorOpen(true)}
            >
              {t`Signature`}
            </StyledAccountTab>
          </StyledEditTabContainer>
          {selectedPipeline && (
            <StyledEditTabContainer style={{ marginLeft: 0 }}>
              <StyledAccountTab
                active={false}
                onClick={() =>
                  setPipelineEditorState({ pipeline: selectedPipeline })
                }
              >
                {t`Edit`}
              </StyledAccountTab>
            </StyledEditTabContainer>
          )}
        </StyledViewTabs>
      )}
      {activeAccountId && selectedPipeline && (
        <InboxPipelineBoard
          key={selectedPipeline.id}
          accountIds={
            selectedPipeline.accountIds.length > 0
              ? selectedPipeline.accountIds
              : accounts.map((account) => account.id)
          }
          searchTerm={searchTerm}
          pipeline={selectedPipeline}
          onMoveCard={handleMoveCard}
          onExcludeRule={handleExcludeRule}
          onRemoveFromPipeline={handleRemoveFromPipeline}
        />
      )}
      {activeAccountId && !selectedPipeline && (
        <InboxThreadList
          key={activeAccountId}
          connectedAccountId={activeAccountId}
          connectedAccountHandle={
            accounts.find((account) => account.id === activeAccountId)
              ?.handle ?? ''
          }
          searchTerm={searchTerm}
          pipelines={pipelines}
          onAddToPipeline={handleAddToPipeline}
        />
      )}
      {pipelineEditorState && (
        <PipelineEditorModal
          pipeline={pipelineEditorState.pipeline}
          accounts={accounts}
          onSave={handleSavePipeline}
          onDelete={handleDeletePipeline}
          onClose={() => setPipelineEditorState(null)}
        />
      )}
      {isSignatureEditorOpen && (
        <SignatureEditorModal
          signature={signature}
          isSaving={isSavingSignature}
          onSave={async (signatureHtml) => {
            await saveSignature(signatureHtml);
            setIsSignatureEditorOpen(false);
          }}
          onClose={() => setIsSignatureEditorOpen(false)}
        />
      )}
    </StyledPanel>
  );
};
