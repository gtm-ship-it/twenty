import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconInbox } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { InboxThreadList } from '@/inbox/components/InboxThreadList';
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

  return (
    <StyledPanel>
      <StyledHeader>
        <IconInbox size={16} />
        <StyledTitle>{t`Inbox`}</StyledTitle>
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
        />
      )}
    </StyledPanel>
  );
};
