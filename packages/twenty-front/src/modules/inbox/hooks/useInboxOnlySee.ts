import { useMutation, useQuery } from '@apollo/client/react';

import {
  GET_INBOX_ONLY_SEE_LIST,
  SET_INBOX_ONLY_SEE_LIST,
} from '@/inbox/graphql/inboxOnlySee';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

export const useInboxOnlySee = (connectedAccountId: string | null) => {
  const apolloCoreClient = useApolloCoreClient();

  const { data, refetch } = useQuery<{ getInboxOnlySeeList: string[] }>(
    GET_INBOX_ONLY_SEE_LIST,
    {
      client: apolloCoreClient,
      skip: !connectedAccountId,
      variables: { connectedAccountId },
    },
  );

  const [setOnlySeeListMutation, { loading: isSaving }] = useMutation(
    SET_INBOX_ONLY_SEE_LIST,
    { client: apolloCoreClient },
  );

  const saveOnlySeeList = async (handles: string[]) => {
    if (!connectedAccountId) {
      return;
    }

    await setOnlySeeListMutation({
      variables: { connectedAccountId, handles },
    });
    await refetch();
  };

  return {
    onlySeeList: data?.getInboxOnlySeeList ?? [],
    saveOnlySeeList,
    isSaving,
  };
};

export const threadMatchesOnlySeeList = (
  participantHandles: (string | null | undefined)[],
  onlySeeList: string[],
): boolean => {
  if (onlySeeList.length === 0) {
    return true;
  }

  const normalizedHandles = participantHandles
    .filter((handle): handle is string => !!handle)
    .map((handle) => handle.toLowerCase());

  return onlySeeList.some((entry) => {
    const normalizedEntry = entry.toLowerCase();

    if (normalizedEntry.startsWith('@')) {
      return normalizedHandles.some((handle) =>
        handle.endsWith(normalizedEntry),
      );
    }

    return normalizedHandles.includes(normalizedEntry);
  });
};
