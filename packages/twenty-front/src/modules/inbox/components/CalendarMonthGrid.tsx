import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type InboxCalendarEvent } from '@/inbox/hooks/useInboxCalendarEvents';
import { getAccountColor } from '@/inbox/utils/getAccountColor';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_CHIPS_PER_DAY = 3;

const StyledGrid = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  overflow: hidden;
`;

const StyledWeekdayCell = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[2]};
  text-align: center;
`;

const StyledDayCell = styled.div<{ isCurrentMonth: boolean; isToday: boolean }>`
  background: ${({ isToday }) =>
    isToday ? themeCssVariables.accent.quaternary : 'transparent'};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  border-right: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 96px;
  opacity: ${({ isCurrentMonth }) => (isCurrentMonth ? 1 : 0.4)};
  padding: ${themeCssVariables.spacing[1]};
`;

const StyledDayNumber = styled.span<{ isToday: boolean }>`
  color: ${({ isToday }) =>
    isToday
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${({ isToday }) =>
    isToday
      ? themeCssVariables.font.weight.semiBold
      : themeCssVariables.font.weight.regular};
  padding: 2px;
`;

const StyledEventChip = styled.button<{ accentColor: string }>`
  background: ${({ accentColor }) => accentColor};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #ffffff;
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  overflow: hidden;
  padding: 2px 4px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const StyledMoreLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding-left: 4px;
`;

const toDayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const formatHour = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Lunes de la semana que contiene `date`. */
const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const weekdayFromMonday = (result.getDay() + 6) % 7;

  result.setDate(result.getDate() - weekdayFromMonday);
  result.setHours(0, 0, 0, 0);

  return result;
};

type CalendarMonthGridProps = {
  monthDate: Date;
  events: InboxCalendarEvent[];
  onEventClick: (eventId: string) => void;
};

export const CalendarMonthGrid = ({
  monthDate,
  events,
  onEventClick,
}: CalendarMonthGridProps) => {
  const eventsByDay = new Map<string, InboxCalendarEvent[]>();

  for (const event of events) {
    const key = toDayKey(new Date(event.startsAt));

    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  // La rejilla siempre arranca en el lunes de la semana del dia 1, y se
  // dibujan 6 semanas fijas para que no salte de alto al cambiar de mes.
  const firstCell = startOfWeek(
    new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
  );
  const todayKey = toDayKey(new Date());

  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);

    date.setDate(firstCell.getDate() + index);

    return date;
  });

  return (
    <StyledGrid>
      {WEEKDAYS.map((weekday) => (
        <StyledWeekdayCell key={weekday}>{weekday}</StyledWeekdayCell>
      ))}
      {cells.map((date) => {
        const key = toDayKey(date);
        const dayEvents = eventsByDay.get(key) ?? [];
        const shown = dayEvents.slice(0, MAX_CHIPS_PER_DAY);

        return (
          <StyledDayCell
            key={key}
            isCurrentMonth={date.getMonth() === monthDate.getMonth()}
            isToday={key === todayKey}
          >
            <StyledDayNumber isToday={key === todayKey}>
              {date.getDate()}
            </StyledDayNumber>
            {shown.map((event) => (
              <StyledEventChip
                key={event.id}
                type="button"
                accentColor={getAccountColor(event.accountHandles?.[0])}
                title={event.title ?? ''}
                onClick={() => onEventClick(event.id)}
              >
                {event.isFullDay
                  ? event.title
                  : `${formatHour(new Date(event.startsAt))} ${event.title}`}
              </StyledEventChip>
            ))}
            {dayEvents.length > shown.length && (
              <StyledMoreLabel>
                +{dayEvents.length - shown.length}
              </StyledMoreLabel>
            )}
          </StyledDayCell>
        );
      })}
    </StyledGrid>
  );
};
