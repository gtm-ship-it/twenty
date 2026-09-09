import { useQuery } from '@apollo/client/react';
import { useState } from 'react';

import { useSnackBarOnQueryError } from '@/apollo/hooks/useSnackBarOnQueryError';
import { getTimelineCalendarEventsFromConnectedAccountIds } from '@/inbox/graphql/getTimelineCalendarEventsFromConnectedAccountIds';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { type TimelineCalendarEventsWithTotal } from '~/generated/graphql';

type InboxCalendarQueryResult = {
  getTimelineCalendarEventsFromConnectedAccountIds: TimelineCalendarEventsWithTotal;
};

export const useInboxCalendarEvents = (
  connectedAccountIds: string[],
  pageSize: number,
) => {
  const apolloCoreClient = useApolloCoreClient();

  const [page, setPage] = useState({ pageNumber: 1, hasNextPage: true });
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const { data, loading, fetchMore, error } =
    useQuery<InboxCalendarQueryResult>(
      getTimelineCalendarEventsFromConnectedAccountIds,
      {
        client: apolloCoreClient,
        skip: connectedAccountIds.length === 0,
        variables: { connectedAccountIds, page: 1, pageSize },
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
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        const previous =
          prev?.getTimelineCalendarEventsFromConnectedAccountIds
            ?.timelineCalendarEvents ?? [];
        const fetched =
          fetchMoreResult?.getTimelineCalendarEventsFromConnectedAccountIds
            ?.timelineCalendarEvents ?? [];

        if (fetched.length === 0) {
          setPage((previousPage) => ({ ...previousPage, hasNextPage: false }));

          return prev;
        }

        setPage((previousPage) => ({
          ...previousPage,
          pageNumber: previousPage.pageNumber + 1,
        }));

        return {
          getTimelineCalendarEventsFromConnectedAccountIds: {
            ...fetchMoreResult.getTimelineCalendarEventsFromConnectedAccountIds,
            timelineCalendarEvents: [...previous, ...fetched],
          },
        };
      },
    });

    setIsFetchingMore(false);
  };

  return {
    calendarEvents:
      data?.getTimelineCalendarEventsFromConnectedAccountIds
        ?.timelineCalendarEvents ?? undefined,
    totalNumberOfCalendarEvents:
      data?.getTimelineCalendarEventsFromConnectedAccountIds
        ?.totalNumberOfCalendarEvents ?? 0,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  };
};
