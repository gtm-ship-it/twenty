import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { useInboxCalendarEvents } from '@/inbox/hooks/useInboxCalendarEvents';
import { type TimelineCalendarEvent } from '~/generated/graphql';

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
  padding-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledDayGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledDayHeader = styled.div`
  align-items: baseline;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledDayLabel = styled.span<{ isToday: boolean }>`
  color: ${({ isToday }) =>
    isToday
      ? themeCssVariables.color.blue
      : themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  text-transform: capitalize;
`;

const StyledDayCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledEventRow = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
`;

const StyledEventTime = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-variant-numeric: tabular-nums;
  width: 110px;
`;

const StyledEventTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledEventGuests = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: ${themeCssVariables.spacing[8]};
`;

const getDayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const formatDayLabel = (date: Date) => {
  const today = new Date();
  const tomorrow = new Date();

  tomorrow.setDate(today.getDate() + 1);

  if (getDayKey(date) === getDayKey(today)) {
    return t`Today`;
  }

  if (getDayKey(date) === getDayKey(tomorrow)) {
    return t`Tomorrow`;
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const formatTimeRange = (event: TimelineCalendarEvent) => {
  if (event.isFullDay) {
    return t`All day`;
  }

  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };
  const start = new Date(event.startsAt).toLocaleTimeString(undefined, options);

  if (!event.endsAt) {
    return start;
  }

  return `${start} – ${new Date(event.endsAt).toLocaleTimeString(undefined, options)}`;
};

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

  if (firstQueryLoading) {
    return <SkeletonLoader />;
  }

  const events = calendarEvents ?? [];

  if (events.length === 0) {
    return (
      <StyledEmptyState>{t`No upcoming events on this account.`}</StyledEmptyState>
    );
  }

  // El servidor ya devuelve solo lo de hoy en adelante y en orden cronologico;
  // aqui solo agrupamos por dia conservando ese orden.
  const days: { key: string; date: Date; events: TimelineCalendarEvent[] }[] =
    [];

  for (const event of events) {
    const date = new Date(event.startsAt);
    const key = getDayKey(date);
    const lastDay = days.at(-1);

    if (lastDay?.key === key) {
      lastDay.events.push(event);
    } else {
      days.push({ key, date, events: [event] });
    }
  }

  const todayKey = getDayKey(new Date());

  return (
    <StyledContainer>
      <StyledCountBar>
        {t`Showing ${events.length} of ${totalNumberOfCalendarEvents} upcoming events`}
      </StyledCountBar>
      {days.map((day) => (
        <StyledDayGroup key={day.key}>
          <StyledDayHeader>
            <StyledDayLabel isToday={day.key === todayKey}>
              {formatDayLabel(day.date)}
            </StyledDayLabel>
            <StyledDayCount>· {day.events.length}</StyledDayCount>
          </StyledDayHeader>
          {day.events.map((event) => (
            <StyledEventRow key={event.id}>
              <StyledEventTime>{formatTimeRange(event)}</StyledEventTime>
              <StyledEventTitle>
                {event.title || t`(No title)`}
              </StyledEventTitle>
              {(event.participants?.length ?? 0) > 0 && (
                <StyledEventGuests>
                  {t`${event.participants?.length} guests`}
                </StyledEventGuests>
              )}
            </StyledEventRow>
          ))}
        </StyledDayGroup>
      ))}
      <CustomResolverFetchMoreLoader
        loading={isFetchingMore}
        onLastRowVisible={fetchMoreRecords}
      />
    </StyledContainer>
  );
};
