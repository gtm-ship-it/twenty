import { gql } from '@apollo/client';

export const GET_MY_INBOX_PIPELINES = gql`
  query GetMyInboxPipelines {
    getMyInboxPipelines
  }
`;

export const SET_MY_INBOX_PIPELINES = gql`
  mutation SetMyInboxPipelines($pipelinesJson: String!) {
    setMyInboxPipelines(pipelinesJson: $pipelinesJson)
  }
`;
