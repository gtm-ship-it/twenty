import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';

import {
  GET_MY_INBOX_PIPELINES,
  SET_MY_INBOX_PIPELINES,
} from '@/inbox/graphql/inboxPipelines';
import {
  type InboxPipeline,
  parseInboxPipelines,
} from '@/inbox/types/InboxPipeline';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

export const useInboxPipelines = () => {
  const apolloCoreClient = useApolloCoreClient();

  const [pipelines, setPipelines] = useState<InboxPipeline[]>([]);

  const { data, loading } = useQuery<{ getMyInboxPipelines: string | null }>(
    GET_MY_INBOX_PIPELINES,
    { client: apolloCoreClient },
  );

  useEffect(() => {
    if (data !== undefined) {
      setPipelines(parseInboxPipelines(data.getMyInboxPipelines));
    }
  }, [data]);

  const [setPipelinesMutation, { loading: isSaving }] = useMutation(
    SET_MY_INBOX_PIPELINES,
    { client: apolloCoreClient },
  );

  const savePipelines = async (nextPipelines: InboxPipeline[]) => {
    // Optimista: la UI responde al instante, el server persiste detrás.
    setPipelines(nextPipelines);

    await setPipelinesMutation({
      variables: { pipelinesJson: JSON.stringify(nextPipelines) },
    });
  };

  return {
    pipelines,
    savePipelines,
    isLoading: loading,
    isSaving,
  };
};
