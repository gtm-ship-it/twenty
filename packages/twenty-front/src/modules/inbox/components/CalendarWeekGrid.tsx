import { styled } from '@linaria/react';
import { useEffect, useRef } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type InboxCalendarEvent } from '@/inbox/hooks/useInboxCalendarEvents';
import { getAccountColor } from '@/inbox/utils/getAccountColor';

const HOUR_HEIGHT = 44;
const MINUTES_PER_DAY = 24 * 60;
const FIRST_VISIBLE_HOUR = 7;
const MIN_BLOCK_MINUTES = 25;

const StyledWrapper = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledHeaderRow = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: grid;
  grid-template-columns: 56px repeat(7, minmax(0, 1fr));
`;

const StyledHeaderCell = styled.div<{ isToday: boolean }>`
  color: ${({ isToday }) =>
    isToday
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${({ isToday }) =>
    isToday
      ? themeCssVariables.font.weight.semiBold
      : themeCssVariables.font.weight.regular};
  padding: ${themeCssVariables.spacing[2]};
  text-align: center;
`;

const StyledAllDayRow = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: grid;
  grid-template-columns: 56px repeat(7, minmax(0, 1fr));
  min-height: 24px;
`;

const StyledAllDayLabel = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]};
  text-align: right;
`;

const StyledAllDayCell = styled.div`
  border-left: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px;
`;

const StyledScrollArea = styled.div`
  max-height: 560px;
  overflow-y: auto;
`;

const StyledTimeGrid = styled.div`
  display: grid;
  grid-template-columns: 56px repeat(7, minmax(0, 1fr));
  position: relative;
`;

const StyledHourColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledHourLabel = styled.div`
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  height: ${HOUR_HEIGHT}px;
  padding-right: ${themeCssVariables.spacing[1]};
  text-align: right;
  transform: translateY(-6px);
`;

const StyledDayColumn = styled.div`
  border-left: 1px solid ${themeCssVariables.border.color.light};
  position: relative;
`;

const StyledHourLine = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  height: ${HOUR_HEIGHT}px;
`;

const StyledEventBlock = styled.button<{ accentColor: string }>`
  background: ${({ accentColor }) => accentColor};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #ffffff;
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  left: 2px;
  line-height: 1.2;
  overflow: hidden;
  padding: 2px 4px;
  position: absolute;
  right: 2px;
  text-align: left;
`;

const StyledNowLine = styled.div`
  background: #e5484d;
  height: 2px;
  left: 0;
  position: absolute;
  right: 0;
  z-index: 1;
`;

const StyledAllDayChip = styled.button<{ accentColor: string }>`
  background: ${({ accentColor }) => accentColor};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #ffffff;
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  overflow: hidden;
  padding: 1px 4px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const minutesFromMidnight = (date: Date) =>
  date.getHours() * 60 + date.getMinutes();

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

type CalendarWeekGridProps = {
  weekStart: Date;
  events: InboxCalendarEvent[];
  onEventClick: (eventId: string) => void;
};

export const CalendarWeekGrid = ({
  weekStart,
  events,
  onEventClick,
}: CalendarWeekGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);

    date.setDate(weekStart.getDate() + index);
    date.setHours(0, 0, 0, 0);

    return date;
  });

  // Arrancar a las 7:00 en vez de a medianoche: nadie quiere ver siete horas
  // de madrugada vacias al abrir la semana.
  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_HEIGHT;
    }
  }, [weekStart]);

  return (
    <StyledWrapper>
      <StyledHeaderRow>
        <StyledHeaderCell isToday={false} />
        {days.map((day) => (
          <StyledHeaderCell key={day.toISOString()} isToday={isSameDay(day, now)}>
            {day.toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
            })}
          </StyledHeaderCell>
        ))}
      </StyledHeaderRow>

      <StyledAllDayRow>
        <StyledAllDayLabel>todo el día</StyledAllDayLabel>
        {days.map((day) => (
          <StyledAllDayCell key={day.toISOString()}>
            {events
              .filter(
                (event) =>
                  event.isFullDay && isSameDay(new Date(event.startsAt), day),
              )
              .map((event) => (
                <StyledAllDayChip
                  key={event.id}
                  type="button"
                  accentColor={getAccountColor(event.accountHandles?.[0])}
                  title={event.title ?? ''}
                  onClick={() => onEventClick(event.id)}
                >
                  {event.title}
                </StyledAllDayChip>
              ))}
          </StyledAllDayCell>
        ))}
      </StyledAllDayRow>

      <StyledScrollArea ref={scrollRef}>
        <StyledTimeGrid>
          <StyledHourColumn>
            {Array.from({ length: 24 }, (_, hour) => (
              <StyledHourLabel key={hour}>
                {hour === 0 ? '' : `${hour}:00`}
              </StyledHourLabel>
            ))}
          </StyledHourColumn>

          {days.map((day) => (
            <StyledDayColumn key={day.toISOString()}>
              {Array.from({ length: 24 }, (_, hour) => (
                <StyledHourLine key={hour} />
              ))}

              {isSameDay(day, now) && (
                <StyledNowLine
                  style={{
                    top: `${(minutesFromMidnight(now) / MINUTES_PER_DAY) * (24 * HOUR_HEIGHT)}px`,
                  }}
                />
              )}

              {events
                .filter(
                  (event) =>
                    !event.isFullDay && isSameDay(new Date(event.startsAt), day),
                )
                .map((event) => {
                  const startsAt = new Date(event.startsAt);
                  const endsAt = event.endsAt
                    ? new Date(event.endsAt)
                    : new Date(startsAt.getTime() + 30 * 60_000);

                  const startMinutes = minutesFromMidnight(startsAt);
                  // Una reunion que cruza la medianoche se recorta al dia:
                  // pintarla mas alta que la columna desbordaria la rejilla.
                  const rawDuration = Math.round(
                    (endsAt.getTime() - startsAt.getTime()) / 60_000,
                  );
                  const durationMinutes = Math.min(
                    Math.max(rawDuration, MIN_BLOCK_MINUTES),
                    MINUTES_PER_DAY - startMinutes,
                  );

                  return (
                    <StyledEventBlock
                      key={event.id}
                      type="button"
                      accentColor={getAccountColor(event.accountHandles?.[0])}
                      title={event.title ?? ''}
                      onClick={() => onEventClick(event.id)}
                      style={{
                        top: `${(startMinutes / 60) * HOUR_HEIGHT}px`,
                        height: `${(durationMinutes / 60) * HOUR_HEIGHT}px`,
                      }}
                    >
                      {startsAt.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      {event.title}
                    </StyledEventBlock>
                  );
                })}
            </StyledDayColumn>
          ))}
        </StyledTimeGrid>
      </StyledScrollArea>
    </StyledWrapper>
  );
};
