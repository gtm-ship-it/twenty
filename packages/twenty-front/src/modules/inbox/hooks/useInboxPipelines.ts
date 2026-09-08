import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';

import {
  GET_INBOX_PIPELINES,
  SET_INBOX_PIPELINES,
} from '@/inbox/graphql/inboxPipelines';
import {
  type InboxPipeline,
  parseInboxPipelines,
} from '@/inbox/types/InboxPipeline';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

export const useInboxPipelines = (connectedAccountId: string | null) => {
  const apolloCoreClient = useApolloCoreClient();

  const [pipelines, setPipelines] = useState<InboxPipeline[]>([]);

  const { data, loading } = useQuery<{ getInboxPipelines: string | null }>(
    GET_INBOX_PIPELINES,
    {
      client: apolloCoreClient,
      skip: !connectedAccountId,
      variables: { connectedAccountId },
    },
  );

  useEffect(() => {
    if (data !== undefined) {
      setPipelines(parseInboxPipelines(data.getInboxPipelines));
    }
  }, [data]);

  const [setPipelinesMutation, { loading: isSaving }] = useMutation(
    SET_INBOX_PIPELINES,
    { client: apolloCoreClient },
  );

  const savePipelines = async (nextPipelines: InboxPipeline[]) => {
    if (!connectedAccountId) {
      return;
    }

    // Optimista: la UI responde al instante, el server persiste detrás.
    setPipelines(nextPipelines);

    await setPipelinesMutation({
      variables: {
        connectedAccountId,
        pipelinesJson: JSON.stringify(nextPipelines),
      },
    });
  };

  return {
    pipelines,
    savePipelines,
    isLoading: loading,
    isSaving,
  };
};
