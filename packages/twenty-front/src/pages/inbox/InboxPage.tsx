import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconFilter, IconInbox } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { InboxThreadList } from '@/inbox/components/InboxThreadList';
import { useInboxOnlySee } from '@/inbox/hooks/useInboxOnlySee';
import { GET_MY_CONNECTED_ACCOUNTS } from '@/settings/accounts/graphql/queries/getMyConnectedAccounts';

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

const StyledOnlySeePanel = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledOnlySeeHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledOnlySeeTextArea = styled.textarea`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 72px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
`;

const StyledOnlySeeActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
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

  const { onlySeeList, saveOnlySeeList, isSaving } =
    useInboxOnlySee(activeAccountId);

  const [isOnlySeePanelOpen, setIsOnlySeePanelOpen] = useState(false);
  const [onlySeeDraft, setOnlySeeDraft] = useState<string | null>(null);

  const handleToggleOnlySeePanel = () => {
    if (!isOnlySeePanelOpen) {
      setOnlySeeDraft(onlySeeList.join('\n'));
    }
    setIsOnlySeePanelOpen(!isOnlySeePanelOpen);
  };

  const handleSaveOnlySee = async () => {
    const handles = (onlySeeDraft ?? '')
      .split(/[\n,;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    await saveOnlySeeList(handles);
    setIsOnlySeePanelOpen(false);
  };

  return (
    <StyledPanel>
      <StyledHeader>
        <IconInbox size={16} />
        <StyledTitle>{t`Inbox`}</StyledTitle>
        <Button
          title={
            onlySeeList.length > 0
              ? t`Only see (${onlySeeList.length})`
              : t`Only see`
          }
          Icon={IconFilter}
          size="small"
          variant="secondary"
          accent={onlySeeList.length > 0 ? 'blue' : 'default'}
          onClick={handleToggleOnlySeePanel}
        />
        {accounts.length > 1 && (
          <StyledAccountTabs>
            {accounts.map((account) => (
              <StyledAccountTab
                key={account.id}
                active={account.id === activeAccountId}
                onClick={() => setSelectedAccountId(account.id)}
              >
                {account.handle}
              </StyledAccountTab>
            ))}
          </StyledAccountTabs>
        )}
      </StyledHeader>
      {isOnlySeePanelOpen && (
        <StyledOnlySeePanel>
          <StyledOnlySeeHint>
            {t`Only show emails from these addresses or domains (one per line, e.g. maria@acme.com or @acme.com). Leave empty to show everything. Other emails are only hidden, never deleted.`}
          </StyledOnlySeeHint>
          <StyledOnlySeeTextArea
            value={onlySeeDraft ?? ''}
            onChange={(event) => setOnlySeeDraft(event.target.value)}
            placeholder={'maria@acme.com\n@brightloans.com'}
          />
          <StyledOnlySeeActions>
            <Button
              title={t`Cancel`}
              variant="secondary"
              size="small"
              onClick={() => setIsOnlySeePanelOpen(false)}
            />
            <Button
              title={isSaving ? t`Saving...` : t`Save`}
              accent="blue"
              size="small"
              disabled={isSaving}
              onClick={handleSaveOnlySee}
            />
          </StyledOnlySeeActions>
        </StyledOnlySeePanel>
      )}
      {!loading && accounts.length === 0 && (
        <StyledEmptyState>
          {t`Connect an email account in Settings → Accounts to see your inbox here.`}
        </StyledEmptyState>
      )}
      {activeAccountId && (
        <InboxThreadList
          key={activeAccountId}
          connectedAccountId={activeAccountId}
          connectedAccountHandle={
            accounts.find((account) => account.id === activeAccountId)
              ?.handle ?? ''
          }
          onlySeeList={onlySeeList}
        />
      )}
    </StyledPanel>
  );
};
