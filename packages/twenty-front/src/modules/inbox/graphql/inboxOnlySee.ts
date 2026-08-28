import { gql } from '@apollo/client';

export const GET_INBOX_ONLY_SEE_LIST = gql`
  query GetInboxOnlySeeList($connectedAccountId: UUID!) {
    getInboxOnlySeeList(connectedAccountId: $connectedAccountId)
  }
`;

export const SET_INBOX_ONLY_SEE_LIST = gql`
  mutation SetInboxOnlySeeList(
    $connectedAccountId: UUID!
    $handles: [String!]!
  ) {
    setInboxOnlySeeList(
      connectedAccountId: $connectedAccountId
      handles: $handles
    )
  }
`;
