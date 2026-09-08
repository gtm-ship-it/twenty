import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { EmailThreadPreview } from '@/activities/emails/components/EmailThreadPreview';
import { threadMatchesOnlySeeList } from '@/inbox/hooks/useInboxOnlySee';
import { useInboxThreads } from '@/inbox/hooks/useInboxThreads';
import {
  type InboxPipeline,
  type InboxPipelineColumn,
} from '@/inbox/types/InboxPipeline';
import { Tag, type TagColor } from 'twenty-ui/data-display';
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
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[1]};
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
  position: relative;

  &:hover .inbox-card-menu-trigger {
    opacity: 1;
    pointer-events: auto;
  }
`;

const StyledCardMenuTrigger = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1;
  opacity: 0;
  padding: 2px 6px;
  pointer-events: none;
  position: absolute;
  right: ${themeCssVariables.spacing[1]};
  top: ${themeCssVariables.spacing[1]};
  z-index: 3;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledCardMenu = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  position: absolute;
  right: ${themeCssVariables.spacing[1]};
  top: ${themeCssVariables.spacing[6]};
  z-index: 4;
`;

const StyledCardMenuItem = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
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
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onExcludeRule: (rule: string, threadId: string) => void;
  onRemoveFromPipeline: (threadId: string) => void;
};

const PipelineCard = ({
  thread,
  isMenuOpen,
  onToggleMenu,
  onExcludeRule,
  onRemoveFromPipeline,
}: PipelineCardProps) => {
  const { ref } = useDraggable({
    id: thread.id,
    feedback: 'clone',
  });

  const senderHandle = thread.firstParticipant?.handle?.toLowerCase() ?? '';
  const senderDomain = senderHandle.includes('@')
    ? `@${senderHandle.split('@')[1]}`
    : '';

  return (
    <StyledCard ref={ref}>
      <EmailThreadPreview thread={thread} />
      <StyledCardMenuTrigger
        className="inbox-card-menu-trigger"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu();
        }}
      >
        ⋯
      </StyledCardMenuTrigger>
      {isMenuOpen && (
        <StyledCardMenu>
          {senderHandle && (
            <StyledCardMenuItem
              type="button"
              onClick={() => onExcludeRule(senderHandle, thread.id)}
            >
              {t`Exclude sender`} ({senderHandle})
            </StyledCardMenuItem>
          )}
          {senderDomain && (
            <StyledCardMenuItem
              type="button"
              onClick={() => onExcludeRule(senderDomain, thread.id)}
            >
              {t`Exclude domain`} ({senderDomain})
            </StyledCardMenuItem>
          )}
          <StyledCardMenuItem
            type="button"
            onClick={() => onRemoveFromPipeline(thread.id)}
          >
            {t`Remove from pipeline`}
          </StyledCardMenuItem>
        </StyledCardMenu>
      )}
    </StyledCard>
  );
};

type PipelineColumnProps = {
  column: InboxPipelineColumn;
  columnIndex: number;
  threads: TimelineThread[];
  menuThreadId: string | null;
  onToggleMenu: (threadId: string) => void;
  onExcludeRule: (rule: string, threadId: string) => void;
  onRemoveFromPipeline: (threadId: string) => void;
};

const PipelineColumn = ({
  column,
  columnIndex,
  threads,
  menuThreadId,
  onToggleMenu,
  onExcludeRule,
  onRemoveFromPipeline,
}: PipelineColumnProps) => {
  const { ref } = useDroppable({
    id: getColumnDroppableId(columnIndex),
  });

  return (
    <StyledColumn ref={ref}>
      <StyledColumnTitle>
        <Tag color={column.color as TagColor} text={column.name} />
        <StyledColumnCount>· {threads.length}</StyledColumnCount>
      </StyledColumnTitle>
      {threads.map((thread) => (
        <PipelineCard
          key={thread.id}
          thread={thread}
          isMenuOpen={menuThreadId === thread.id}
          onToggleMenu={() => onToggleMenu(thread.id)}
          onExcludeRule={onExcludeRule}
          onRemoveFromPipeline={onRemoveFromPipeline}
        />
      ))}
    </StyledColumn>
  );
};

type InboxPipelineBoardProps = {
  accountIds: string[];
  pipeline: InboxPipeline;
  onMoveCard: (threadId: string, columnIndex: number) => void;
  onExcludeRule: (rule: string, threadId: string) => void;
  onRemoveFromPipeline: (threadId: string) => void;
};

export const InboxPipelineBoard = ({
  accountIds,
  pipeline,
  onMoveCard,
  onExcludeRule,
  onRemoveFromPipeline,
}: InboxPipelineBoardProps) => {
  const {
    threads,
    totalNumberOfThreads,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  } = useInboxThreads(accountIds, PIPELINE_BOARD_PAGE_SIZE);

  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);

  if (firstQueryLoading) {
    return <SkeletonLoader />;
  }

  const pipelineThreads = (threads ?? []).filter((thread) => {
    // Un hilo agregado manualmente pertenece al pipeline aunque no cumpla reglas.
    if (thread.id in (pipeline.cardColumns ?? {})) {
      return true;
    }

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
        {pipeline.columns.map((column, columnIndex) => (
          <PipelineColumn
            key={columnIndex}
            column={column}
            columnIndex={columnIndex}
            threads={threadsByColumn[columnIndex]}
            menuThreadId={menuThreadId}
            onToggleMenu={(threadId) =>
              setMenuThreadId(menuThreadId === threadId ? null : threadId)
            }
            onExcludeRule={(rule, threadId) => {
              setMenuThreadId(null);
              onExcludeRule(rule, threadId);
            }}
            onRemoveFromPipeline={(threadId) => {
              setMenuThreadId(null);
              onRemoveFromPipeline(threadId);
            }}
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
