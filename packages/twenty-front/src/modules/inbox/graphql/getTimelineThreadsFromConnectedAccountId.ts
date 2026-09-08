import { timelineThreadWithTotalFragment } from '@/activities/emails/graphql/queries/fragments/timelineThreadWithTotalFragment';
import { gql } from '@apollo/client';

export const getTimelineThreadsFromConnectedAccountIds = gql`
  query GetTimelineThreadsFromConnectedAccountIds(
    $connectedAccountIds: [UUID!]!
    $page: Int!
    $pageSize: Int!
  ) {
    getTimelineThreadsFromConnectedAccountIds(
      connectedAccountIds: $connectedAccountIds
      page: $page
      pageSize: $pageSize
    ) {
      ...TimelineThreadsWithTotalFragment
    }
  }
  ${timelineThreadWithTotalFragment}
`;
