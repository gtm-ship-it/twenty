import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { EmailThreadPreview } from '@/activities/emails/components/EmailThreadPreview';
import { threadMatchesOnlySeeList } from '@/inbox/hooks/useInboxOnlySee';
import { useInboxThreads } from '@/inbox/hooks/useInboxThreads';
import { type InboxPipeline } from '@/inbox/types/InboxPipeline';
import { type TimelineThread } from '~/generated/graphql';

const PIPELINE_BOARD_PAGE_SIZE = 50;

const StyledBoard = styled.div`
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[3]};
  overflow-x: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledColumn = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  min-height: 200px;
  min-width: 280px;
  padding: ${themeCssVariables.spacing[2]};
  width: 280px;
`;

const StyledColumnTitle = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledColumnCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: ${themeCssVariables.font.weight.regular};
  margin-left: ${themeCssVariables.spacing[1]};
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: grab;
`;

const StyledEmptyBoardHint = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: ${themeCssVariables.spacing[8]};
`;

const getColumnDroppableId = (columnIndex: number) => `inbox-col-${columnIndex}`;

const parseColumnDroppableId = (droppableId: string): number | null => {
  const match = droppableId.match(/^inbox-col-(\d+)$/);

  return match ? Number(match[1]) : null;
};

type PipelineCardProps = {
  thread: TimelineThread;
};

const PipelineCard = ({ thread }: PipelineCardProps) => {
  const { ref } = useDraggable({
    id: thread.id,
    feedback: 'clone',
  });

  return (
    <StyledCard ref={ref}>
      <EmailThreadPreview thread={thread} />
    </StyledCard>
  );
};

type PipelineColumnProps = {
  title: string;
  columnIndex: number;
  threads: TimelineThread[];
};

const PipelineColumn = ({
  title,
  columnIndex,
  threads,
}: PipelineColumnProps) => {
  const { ref } = useDroppable({
    id: getColumnDroppableId(columnIndex),
  });

  return (
    <StyledColumn ref={ref}>
      <StyledColumnTitle>
        {title}
        <StyledColumnCount>· {threads.length}</StyledColumnCount>
      </StyledColumnTitle>
      {threads.map((thread) => (
        <PipelineCard key={thread.id} thread={thread} />
      ))}
    </StyledColumn>
  );
};

type InboxPipelineBoardProps = {
  connectedAccountId: string;
  pipeline: InboxPipeline;
  onMoveCard: (threadId: string, columnIndex: number) => void;
};

export const InboxPipelineBoard = ({
  connectedAccountId,
  pipeline,
  onMoveCard,
}: InboxPipelineBoardProps) => {
  const {
    threads,
    totalNumberOfThreads,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  } = useInboxThreads(connectedAccountId, PIPELINE_BOARD_PAGE_SIZE);

  if (firstQueryLoading) {
    return <SkeletonLoader />;
  }

  const pipelineThreads = (threads ?? []).filter((thread) => {
    const participantHandles = [
      thread.firstParticipant?.handle,
      ...(thread.lastTwoParticipants ?? []).map(
        (participant) => participant?.handle,
      ),
    ];

    const matches = threadMatchesOnlySeeList(
      participantHandles,
      pipeline.rules,
    );

    // ONLY sin reglas muestra todo; EXCLUDE sin reglas también muestra todo
    // (threadMatchesOnlySeeList devuelve true con lista vacía).
    return pipeline.mode === 'ONLY'
      ? matches
      : pipeline.rules.length === 0 || !matches;
  });

  if (pipelineThreads.length === 0) {
    return (
      <StyledEmptyBoardHint>
        {t`No emails match this pipeline yet.`}
      </StyledEmptyBoardHint>
    );
  }

  const columnCount = Math.max(pipeline.columns.length, 1);

  const threadsByColumn: TimelineThread[][] = Array.from(
    { length: columnCount },
    () => [],
  );

  for (const thread of pipelineThreads) {
    const rawColumn = pipeline.cardColumns?.[thread.id] ?? 0;
    const columnIndex =
      rawColumn >= 0 && rawColumn < columnCount ? rawColumn : 0;

    threadsByColumn[columnIndex].push(thread);
  }

  const hasMoreThreads = (threads?.length ?? 0) < totalNumberOfThreads;

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, target } = event.operation;

        if (event.canceled || !isDefined(source) || !isDefined(target)) {
          return;
        }

        const columnIndex = parseColumnDroppableId(String(target.id));

        if (columnIndex === null) {
          return;
        }

        onMoveCard(String(source.id), columnIndex);
      }}
    >
      <StyledBoard>
        {pipeline.columns.map((columnTitle, columnIndex) => (
          <PipelineColumn
            key={columnIndex}
            title={columnTitle}
            columnIndex={columnIndex}
            threads={threadsByColumn[columnIndex]}
          />
        ))}
        <CustomResolverFetchMoreLoader
          loading={isFetchingMore}
          onLastRowVisible={async () => {
            if (hasMoreThreads) {
              await fetchMoreRecords();
            }
          }}
        />
      </StyledBoard>
    </DragDropProvider>
  );
};
