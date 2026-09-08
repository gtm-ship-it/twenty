import { useQuery } from '@apollo/client/react';
import { useState } from 'react';

import { useSnackBarOnQueryError } from '@/apollo/hooks/useSnackBarOnQueryError';
import { getTimelineThreadsFromConnectedAccountIds } from '@/inbox/graphql/getTimelineThreadsFromConnectedAccountId';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { type TimelineThreadsWithTotal } from '~/generated/graphql';

type InboxThreadsQueryResult = {
  getTimelineThreadsFromConnectedAccountIds: TimelineThreadsWithTotal;
};

export const useInboxThreads = (
  connectedAccountIds: string[],
  pageSize: number,
  searchTerm?: string,
) => {
  const apolloCoreClient = useApolloCoreClient();

  const [page, setPage] = useState({
    pageNumber: 1,
    hasNextPage: true,
  });

  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const { data, loading, fetchMore, refetch, error } =
    useQuery<InboxThreadsQueryResult>(
      getTimelineThreadsFromConnectedAccountIds,
      {
        client: apolloCoreClient,
        skip: connectedAccountIds.length === 0,
        variables: {
          connectedAccountIds,
          page: 1,
          pageSize,
          searchTerm: searchTerm ?? null,
        },
      },
    );

  useSnackBarOnQueryError(error);

  const firstQueryLoading = loading && !data;

  const fetchMoreRecords = async () => {
    if (!page.hasNextPage || isFetchingMore || firstQueryLoading) {
      return;
    }

    setIsFetchingMore(true);

    await fetchMore({
      variables: {
        connectedAccountIds,
        page: page.pageNumber + 1,
        pageSize,
        searchTerm: searchTerm ?? null,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        const previousThreads =
          prev?.getTimelineThreadsFromConnectedAccountIds?.timelineThreads ??
          [];
        const fetchedThreads =
          fetchMoreResult?.getTimelineThreadsFromConnectedAccountIds
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
          getTimelineThreadsFromConnectedAccountIds: {
            ...fetchMoreResult.getTimelineThreadsFromConnectedAccountIds,
            timelineThreads: [...previousThreads, ...fetchedThreads],
          },
        };
      },
    });

    setIsFetchingMore(false);
  };

  return {
    threads:
      data?.getTimelineThreadsFromConnectedAccountIds?.timelineThreads ??
      undefined,
    totalNumberOfThreads:
      data?.getTimelineThreadsFromConnectedAccountIds?.totalNumberOfThreads ??
      0,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
    refetch,
  };
};
