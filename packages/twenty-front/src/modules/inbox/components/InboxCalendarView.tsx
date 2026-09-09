import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CalendarEventsCardContent } from '@/activities/calendar/components/CalendarEventsCardContent';
import { useInboxCalendarEvents } from '@/inbox/hooks/useInboxCalendarEvents';

const CALENDAR_PAGE_SIZE = 30;

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledCountBar = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding-bottom: ${themeCssVariables.spacing[2]};
`;

type InboxCalendarViewProps = {
  accountIds: string[];
};

export const InboxCalendarView = ({ accountIds }: InboxCalendarViewProps) => {
  const {
    calendarEvents,
    totalNumberOfCalendarEvents,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  } = useInboxCalendarEvents(accountIds, CALENDAR_PAGE_SIZE);

  return (
    <StyledContainer>
      {!firstQueryLoading && (
        <StyledCountBar>
          {t`Showing ${calendarEvents?.length ?? 0} of ${totalNumberOfCalendarEvents} events`}
        </StyledCountBar>
      )}
      <CalendarEventsCardContent
        firstQueryLoading={firstQueryLoading}
        isFetchingMore={isFetchingMore}
        objectName="calendar"
        onLastRowVisible={fetchMoreRecords}
        timelineCalendarEvents={calendarEvents}
      />
    </StyledContainer>
  );
};
