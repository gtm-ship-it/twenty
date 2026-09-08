import { gql } from '@apollo/client';

export const GET_INBOX_PIPELINES = gql`
  query GetInboxPipelines($connectedAccountId: UUID!) {
    getInboxPipelines(connectedAccountId: $connectedAccountId)
  }
`;

export const SET_INBOX_PIPELINES = gql`
  mutation SetInboxPipelines(
    $connectedAccountId: UUID!
    $pipelinesJson: String!
  ) {
    setInboxPipelines(
      connectedAccountId: $connectedAccountId
      pipelinesJson: $pipelinesJson
    )
  }
`;
