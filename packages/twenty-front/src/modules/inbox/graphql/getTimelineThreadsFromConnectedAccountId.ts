import { timelineThreadWithTotalFragment } from '@/activities/emails/graphql/queries/fragments/timelineThreadWithTotalFragment';
import { gql } from '@apollo/client';

export const getTimelineThreadsFromConnectedAccountId = gql`
  query GetTimelineThreadsFromConnectedAccountId(
    $connectedAccountId: UUID!
    $page: Int!
    $pageSize: Int!
  ) {
    getTimelineThreadsFromConnectedAccountId(
      connectedAccountId: $connectedAccountId
      page: $page
      pageSize: $pageSize
    ) {
      ...TimelineThreadsWithTotalFragment
    }
  }
  ${timelineThreadWithTotalFragment}
`;
