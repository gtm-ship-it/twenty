import { gql } from '@apollo/client';

export const GET_ATLAS_CALL_TENANTS = gql`
  query GetAtlasCallTenants {
    atlasCallTenants {
      key
      label
    }
  }
`;

export const GET_ATLAS_CALL_CAMPAIGNS = gql`
  query GetAtlasCallCampaigns($tenantKey: String!) {
    atlasCallCampaigns(tenantKey: $tenantKey) {
      id
      name
      status
      callType
      timeWindows
      timezone
    }
  }
`;

export const GET_ATLAS_CALL_TARGETS = gql`
  query GetAtlasCallTargets(
    $objectNameSingular: String!
    $recordIds: [UUID!]!
  ) {
    atlasCallTargets(
      objectNameSingular: $objectNameSingular
      recordIds: $recordIds
    ) {
      recordId
      objectNameSingular
      recordLabel
      personId
      firstName
      lastName
      companyName
      phone
      phoneSource
      reason
    }
  }
`;

export const ATLAS_SCHEDULE_CALLS = gql`
  mutation AtlasScheduleCalls($input: AtlasScheduleCallsInput!) {
    atlasScheduleCalls(input: $input) {
      scheduledCount
      failedCount
      campaignName
      tenantLabel
      results {
        recordId
        phone
        ok
        sequenceNumber
        error
      }
    }
  }
`;
