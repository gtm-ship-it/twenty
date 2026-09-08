import { useMutation, useQuery } from '@apollo/client/react';

import {
  GET_MY_INBOX_SIGNATURE,
  SET_MY_INBOX_SIGNATURE,
} from '@/inbox/graphql/inboxSignature';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

export const useInboxSignature = () => {
  const apolloCoreClient = useApolloCoreClient();

  const { data, refetch } = useQuery<{ getMyInboxSignature: string | null }>(
    GET_MY_INBOX_SIGNATURE,
    { client: apolloCoreClient },
  );

  const [setSignatureMutation, { loading: isSaving }] = useMutation(
    SET_MY_INBOX_SIGNATURE,
    { client: apolloCoreClient },
  );

  const saveSignature = async (signatureHtml: string) => {
    await setSignatureMutation({ variables: { signatureHtml } });
    await refetch();
  };

  return {
    signature: data?.getMyInboxSignature ?? '',
    saveSignature,
    isSaving,
  };
};
