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
      totalNumberOfCalendarEvents
      timelineCalendarEvents {
        id
        title
        startsAt
        endsAt
        isFullDay
        location
        visibility
        conferenceSolution
        accountHandles
        conferenceLink {
          primaryLinkLabel
          primaryLinkUrl
        }
        participants {
          displayName
          handle
        }
      }
    }
  }
`;
