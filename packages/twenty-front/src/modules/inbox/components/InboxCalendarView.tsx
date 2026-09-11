import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconVideo } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { CalendarMonthGrid } from '@/inbox/components/CalendarMonthGrid';
import { CalendarWeekGrid } from '@/inbox/components/CalendarWeekGrid';
import {
  useInboxCalendarEvents,
  type InboxCalendarEvent as TimelineCalendarEvent,
} from '@/inbox/hooks/useInboxCalendarEvents';

const CALENDAR_PAGE_SIZE = 50;

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledFilterBar = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  padding-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledFilterLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin-right: ${themeCssVariables.spacing[1]};
`;

const StyledFilterChip = styled.button<{ state: 'on' | 'off' | 'excluded' }>`
  background: ${({ state }) =>
    state === 'on'
      ? themeCssVariables.tag.background.green
      : state === 'excluded'
        ? themeCssVariables.tag.background.red
        : themeCssVariables.background.transparent.light};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ state }) =>
    state === 'off'
      ? themeCssVariables.font.color.tertiary
      : themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-decoration: ${({ state }) =>
    state === 'excluded' ? 'line-through' : 'none'};
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

const StyledEventCard = styled.div`
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};

  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }
`;

const StyledEventRow = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledEventTime = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-variant-numeric: tabular-nums;
  width: 120px;
`;

const StyledEventTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledAccountBadge = styled.span`
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
  padding: 2px 6px;
`;

const StyledJoinButton = styled.a`
  align-items: center;
  background: ${themeCssVariables.color.blue};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #fff;
  display: inline-flex;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-decoration: none;

  &:hover {
    opacity: 0.9;
  }
`;

const StyledEventDetails = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} 0 ${themeCssVariables.spacing[1]}
    132px;
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

const getJoinUrl = (event: TimelineCalendarEvent): string | null => {
  const url = event.conferenceLink?.primaryLinkUrl;

  return typeof url === 'string' && url.length > 0 ? url : null;
};


type CalendarViewMode = 'list' | 'week' | 'month';

const VIEW_MODES: { value: CalendarViewMode; label: () => string }[] = [
  { value: 'list', label: () => t`List` },
  { value: 'week', label: () => t`Week` },
  { value: 'month', label: () => t`Month` },
];

// Las rejillas traen un periodo entero de golpe, no una agenda paginada.
const GRID_PAGE_SIZE = 500;

const StyledToolbar = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledViewSwitch = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  overflow: hidden;
`;

const StyledViewButton = styled.button<{ isActive: boolean }>`
  background: ${({ isActive }) =>
    isActive
      ? themeCssVariables.background.tertiary
      : themeCssVariables.background.primary};
  border: none;
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
`;

const StyledNav = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledNavButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledPeriodLabel = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding-left: ${themeCssVariables.spacing[2]};
`;

/** Lunes de la semana que contiene `date`. */
const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const weekdayFromMonday = (result.getDay() + 6) % 7;

  result.setDate(result.getDate() - weekdayFromMonday);
  result.setHours(0, 0, 0, 0);

  return result;
};

const shiftAnchor = (
  mode: CalendarViewMode,
  anchor: Date,
  direction: 1 | -1,
) => {
  const result = new Date(anchor);

  if (mode === 'week') {
    result.setDate(result.getDate() + 7 * direction);
  } else {
    result.setMonth(result.getMonth() + direction);
  }

  return result;
};

/**
 * Ventana a pedir al servidor. Se piden margenes generosos (la semana
 * completa de los bordes del mes) porque la rejilla del mes dibuja dias del
 * mes anterior y del siguiente.
 */
const getRangeForView = (mode: CalendarViewMode, anchor: Date) => {
  const start =
    mode === 'week'
      ? startOfWeek(anchor)
      : startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));

  const end = new Date(start);

  end.setDate(start.getDate() + (mode === 'week' ? 7 : 42));
  end.setHours(23, 59, 59, 999);

  return { startDate: start.toISOString(), endDate: end.toISOString() };
};

const formatPeriodLabel = (mode: CalendarViewMode, anchor: Date) => {
  if (mode === 'month') {
    return anchor.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }

  const start = startOfWeek(anchor);
  const end = new Date(start);

  end.setDate(start.getDate() + 6);

  return `${start.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })} – ${end.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })}`;
};

type InboxCalendarViewProps = {
  /** Todas las cuentas del usuario: el calendario es centralizado. */
  accountIds: string[];
};

export const InboxCalendarView = ({ accountIds }: InboxCalendarViewProps) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('list');
  // Ancla de navegacion: en semana avanza de 7 en 7 dias, en mes de mes en mes.
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  // La lista es una agenda (sin rango: el servidor devuelve de ahora en
  // adelante). Las rejillas si piden ventana, porque un mes sin lo ya pasado
  // tendria huecos.
  const dateRange =
    viewMode === 'list' ? null : getRangeForView(viewMode, anchorDate);

  const {
    calendarEvents,
    totalNumberOfCalendarEvents,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  } = useInboxCalendarEvents(
    accountIds,
    viewMode === 'list' ? CALENDAR_PAGE_SIZE : GRID_PAGE_SIZE,
    dateRange,
  );

  // Filtro por buzón: sin selección = todos. Un clic incluye solo ese,
  // otro clic lo excluye, otro lo devuelve a neutro.
  const [onlyHandles, setOnlyHandles] = useState<string[]>([]);
  const [excludedHandles, setExcludedHandles] = useState<string[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  if (firstQueryLoading) {
    return <SkeletonLoader />;
  }

  const events = calendarEvents ?? [];

  const allHandles = [
    ...new Set(events.flatMap((event) => event.accountHandles ?? [])),
  ].sort();

  const cycleHandle = (handle: string) => {
    if (onlyHandles.includes(handle)) {
      setOnlyHandles(onlyHandles.filter((h) => h !== handle));
      setExcludedHandles([...excludedHandles, handle]);
    } else if (excludedHandles.includes(handle)) {
      setExcludedHandles(excludedHandles.filter((h) => h !== handle));
    } else {
      setOnlyHandles([...onlyHandles, handle]);
    }
  };

  const getChipState = (handle: string): 'on' | 'off' | 'excluded' =>
    onlyHandles.includes(handle)
      ? 'on'
      : excludedHandles.includes(handle)
        ? 'excluded'
        : 'off';

  const visibleEvents = events.filter((event) => {
    const handles = event.accountHandles ?? [];

    if (handles.some((handle) => excludedHandles.includes(handle))) {
      return false;
    }

    if (onlyHandles.length === 0) {
      return true;
    }

    return handles.some((handle) => onlyHandles.includes(handle));
  });

  const days: { key: string; date: Date; events: TimelineCalendarEvent[] }[] =
    [];

  for (const event of visibleEvents) {
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
      {allHandles.length > 1 && (
        <StyledFilterBar>
          <StyledFilterLabel>{t`Mailboxes:`}</StyledFilterLabel>
          {allHandles.map((handle) => (
            <StyledFilterChip
              key={handle}
              type="button"
              state={getChipState(handle)}
              title={t`Click to show only this one, again to exclude it`}
              onClick={() => cycleHandle(handle)}
            >
              {handle}
            </StyledFilterChip>
          ))}
        </StyledFilterBar>
      )}

      <StyledToolbar>
        <StyledViewSwitch>
          {VIEW_MODES.map((mode) => (
            <StyledViewButton
              key={mode.value}
              type="button"
              isActive={viewMode === mode.value}
              onClick={() => {
                setViewMode(mode.value);
                setAnchorDate(new Date());
              }}
            >
              {mode.label()}
            </StyledViewButton>
          ))}
        </StyledViewSwitch>

        {viewMode !== 'list' && (
          <StyledNav>
            <StyledNavButton
              type="button"
              onClick={() => setAnchorDate(shiftAnchor(viewMode, anchorDate, -1))}
            >
              ‹
            </StyledNavButton>
            <StyledNavButton
              type="button"
              onClick={() => setAnchorDate(new Date())}
            >
              {t`Today`}
            </StyledNavButton>
            <StyledNavButton
              type="button"
              onClick={() => setAnchorDate(shiftAnchor(viewMode, anchorDate, 1))}
            >
              ›
            </StyledNavButton>
            <StyledPeriodLabel>
              {formatPeriodLabel(viewMode, anchorDate)}
            </StyledPeriodLabel>
          </StyledNav>
        )}
      </StyledToolbar>

      {viewMode === 'month' && (
        <CalendarMonthGrid
          monthDate={anchorDate}
          events={visibleEvents}
          onEventClick={(eventId) =>
            setExpandedEventId(expandedEventId === eventId ? null : eventId)
          }
        />
      )}

      {viewMode === 'week' && (
        <CalendarWeekGrid
          weekStart={startOfWeek(anchorDate)}
          events={visibleEvents}
          onEventClick={(eventId) =>
            setExpandedEventId(expandedEventId === eventId ? null : eventId)
          }
        />
      )}

      {viewMode !== 'list' &&
        (() => {
          const selected = visibleEvents.find(
            (event) => event.id === expandedEventId,
          );

          if (!selected) {
            return null;
          }

          const joinUrl = getJoinUrl(selected);

          return (
            <StyledEventCard>
              <StyledEventRow>
                <StyledEventTime>{formatTimeRange(selected)}</StyledEventTime>
                <StyledEventTitle>
                  {selected.title || t`(No title)`}
                </StyledEventTitle>
                {(selected.accountHandles ?? []).map((handle) => (
                  <StyledAccountBadge key={handle}>{handle}</StyledAccountBadge>
                ))}
                {joinUrl && (
                  <StyledJoinButton
                    href={joinUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconVideo size={14} />
                    {t`Join`}
                  </StyledJoinButton>
                )}
              </StyledEventRow>
              {selected.location && (
                <StyledEventDetails>
                  <span>📍 {selected.location}</span>
                </StyledEventDetails>
              )}
            </StyledEventCard>
          );
        })()}

      {viewMode === 'list' &&
        (visibleEvents.length === 0 ? (
        <StyledEmptyState>{t`No upcoming events.`}</StyledEmptyState>
      ) : (
        <>
          <StyledCountBar>
            {t`Showing ${visibleEvents.length} of ${totalNumberOfCalendarEvents} upcoming events`}
          </StyledCountBar>
          {days.map((day) => (
            <StyledDayGroup key={day.key}>
              <StyledDayHeader>
                <StyledDayLabel isToday={day.key === todayKey}>
                  {formatDayLabel(day.date)}
                </StyledDayLabel>
                <StyledDayCount>· {day.events.length}</StyledDayCount>
              </StyledDayHeader>
              {day.events.map((event) => {
                const joinUrl = getJoinUrl(event);

                return (
                  <StyledEventCard
                    key={event.id}
                    onClick={() =>
                      setExpandedEventId(
                        expandedEventId === event.id ? null : event.id,
                      )
                    }
                  >
                    <StyledEventRow>
                      <StyledEventTime>
                        {formatTimeRange(event)}
                      </StyledEventTime>
                      <StyledEventTitle>
                        {event.title || t`(No title)`}
                      </StyledEventTitle>
                      {(event.accountHandles ?? []).map((handle) => (
                        <StyledAccountBadge key={handle}>
                          {handle}
                        </StyledAccountBadge>
                      ))}
                      {joinUrl && (
                        <StyledJoinButton
                          href={joinUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(clickEvent) => clickEvent.stopPropagation()}
                        >
                          <IconVideo size={14} />
                          {t`Join`}
                        </StyledJoinButton>
                      )}
                    </StyledEventRow>
                    {expandedEventId === event.id && (
                      <StyledEventDetails>
                        {joinUrl && <span>{joinUrl}</span>}
                        {!joinUrl && <span>{t`No meeting link`}</span>}
                        {event.location && <span>📍 {event.location}</span>}
                        {(event.participants?.length ?? 0) > 0 && (
                          <span>
                            {event.participants
                              ?.map(
                                (participant) =>
                                  participant.displayName ||
                                  participant.handle,
                              )
                              .join(', ')}
                          </span>
                        )}
                      </StyledEventDetails>
                    )}
                  </StyledEventCard>
                );
              })}
            </StyledDayGroup>
          ))}
          <CustomResolverFetchMoreLoader
            loading={isFetchingMore}
            onLastRowVisible={fetchMoreRecords}
          />
        </>
        ))}

      {viewMode !== 'list' && (
        <CustomResolverFetchMoreLoader
          loading={isFetchingMore}
          onLastRowVisible={fetchMoreRecords}
        />
      )}
    </StyledContainer>
  );
};
