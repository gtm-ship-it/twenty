import { gql } from '@apollo/client';

export const GET_MY_INBOX_SIGNATURE = gql`
  query GetMyInboxSignature {
    getMyInboxSignature
  }
`;

export const SET_MY_INBOX_SIGNATURE = gql`
  mutation SetMyInboxSignature($signatureHtml: String!) {
    setMyInboxSignature(signatureHtml: $signatureHtml)
  }
`;
