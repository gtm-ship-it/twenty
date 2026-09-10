import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconCalendar } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { InboxCalendarView } from '@/inbox/components/InboxCalendarView';
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

const StyledAccountSelect = styled.div`
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
  archivedAt: string | null;
};

export const CalendarPage = () => {
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
        <IconCalendar size={16} />
        <StyledTitle>{t`Calendar`}</StyledTitle>
        {accounts.length > 1 && (
          <StyledAccountSelect>
            <Select
              dropdownId="calendar-account-select"
              options={accounts.map((account) => ({
                value: account.id,
                label: account.handle,
              }))}
              value={activeAccountId ?? undefined}
              onChange={(value) => setSelectedAccountId(value)}
            />
          </StyledAccountSelect>
        )}
      </StyledHeader>
      {!loading && accounts.length === 0 && (
        <StyledEmptyState>
          {t`Connect an account in Settings → Accounts to see your calendar here.`}
        </StyledEmptyState>
      )}
      {activeAccountId && (
        <InboxCalendarView
          key={activeAccountId}
          accountIds={[activeAccountId]}
        />
      )}
    </StyledPanel>
  );
};
