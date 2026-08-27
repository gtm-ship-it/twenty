import { useQuery } from '@apollo/client/react';
import { useState } from 'react';

import { useSnackBarOnQueryError } from '@/apollo/hooks/useSnackBarOnQueryError';
import { getTimelineThreadsFromConnectedAccountId } from '@/inbox/graphql/getTimelineThreadsFromConnectedAccountId';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { type TimelineThreadsWithTotal } from '~/generated/graphql';

type InboxThreadsQueryResult = {
  getTimelineThreadsFromConnectedAccountId: TimelineThreadsWithTotal;
};

export const useInboxThreads = (
  connectedAccountId: string | null,
  pageSize: number,
) => {
  const apolloCoreClient = useApolloCoreClient();

  const [page, setPage] = useState({
    pageNumber: 1,
    hasNextPage: true,
  });

  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const { data, loading, fetchMore, refetch, error } =
    useQuery<InboxThreadsQueryResult>(getTimelineThreadsFromConnectedAccountId, {
      client: apolloCoreClient,
      skip: !connectedAccountId,
      variables: {
        connectedAccountId,
        page: 1,
        pageSize,
      },
    });

  useSnackBarOnQueryError(error);

  const firstQueryLoading = loading && !data;

  const fetchMoreRecords = async () => {
    if (!page.hasNextPage || isFetchingMore || firstQueryLoading) {
      return;
    }

    setIsFetchingMore(true);

    await fetchMore({
      variables: {
        connectedAccountId,
        page: page.pageNumber + 1,
        pageSize,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        const previousThreads =
          prev?.getTimelineThreadsFromConnectedAccountId?.timelineThreads ?? [];
        const fetchedThreads =
          fetchMoreResult?.getTimelineThreadsFromConnectedAccountId
            ?.timelineThreads ?? [];

        if (fetchedThreads.length === 0) {
          setPage((previousPage) => ({
            ...previousPage,
            hasNextPage: false,
          }));

          return prev;
        }

        setPage((previousPage) => ({
          ...previousPage,
          pageNumber: previousPage.pageNumber + 1,
        }));

        return {
          getTimelineThreadsFromConnectedAccountId: {
            ...fetchMoreResult.getTimelineThreadsFromConnectedAccountId,
            timelineThreads: [...previousThreads, ...fetchedThreads],
          },
        };
      },
    });

    setIsFetchingMore(false);
  };

  return {
    threads:
      data?.getTimelineThreadsFromConnectedAccountId?.timelineThreads ??
      undefined,
    totalNumberOfThreads:
      data?.getTimelineThreadsFromConnectedAccountId?.totalNumberOfThreads ?? 0,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
    refetch,
  };
};
