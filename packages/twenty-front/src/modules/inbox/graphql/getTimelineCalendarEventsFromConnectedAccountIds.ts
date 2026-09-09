import { timelineCalendarEventWithTotalFragment } from '@/activities/calendar/graphql/queries/fragments/timelineCalendarEventWithTotalFragment';
import { gql } from '@apollo/client';

export const getTimelineCalendarEventsFromConnectedAccountIds = gql`
  query GetTimelineCalendarEventsFromConnectedAccountIds(
    $connectedAccountIds: [UUID!]!
    $page: Int!
    $pageSize: Int!
  ) {
    getTimelineCalendarEventsFromConnectedAccountIds(
      connectedAccountIds: $connectedAccountIds
      page: $page
      pageSize: $pageSize
    ) {
      ...TimelineCalendarEventsWithTotalFragment
    }
  }
  ${timelineCalendarEventWithTotalFragment}
`;
