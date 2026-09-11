import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { EmailThreadPreview } from '@/activities/emails/components/EmailThreadPreview';
import { useInboxThreads } from '@/inbox/hooks/useInboxThreads';
import {
  threadBelongsToPipeline,
  type InboxPipeline,
  type InboxPipelineColumn,
} from '@/inbox/types/InboxPipeline';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import { type TimelineThread } from '~/generated/graphql';

const PIPELINE_BOARD_PAGE_SIZE = 50;

const StyledBoardWrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

const StyledCountBar = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]} 0;
`;

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

  &[data-selected='true'] {
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 1px ${themeCssVariables.color.blue};
  }

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
  left: ${themeCssVariables.spacing[1]};
  max-width: calc(100% - 2 * ${themeCssVariables.spacing[1]});
  position: absolute;
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
  overflow: hidden;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  text-align: left;
  text-overflow: ellipsis;
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

const StyledSelectionBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.accent.quaternary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledSelectionCount = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledSelectionLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledSelectionAction = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${themeCssVariables.background.tertiary};
  }
`;

const StyledCardCheckbox = styled.input`
  cursor: pointer;
  left: ${themeCssVariables.spacing[1]};
  position: absolute;
  top: ${themeCssVariables.spacing[1]};
  z-index: 2;
`;

const StyledColumnSelectAll = styled.button`
  background: none;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0;
  text-decoration: underline;
`;

type PipelineCardProps = {
  thread: TimelineThread;
  isSelected: boolean;
  onToggleSelected: (event: React.MouseEvent) => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onExcludeRule: (rule: string, threadId: string) => void;
  onOnlyRule: (rule: string) => void;
  onRemoveFromPipeline: (threadId: string) => void;
};

const PipelineCard = ({
  thread,
  isSelected,
  onToggleSelected,
  isMenuOpen,
  onToggleMenu,
  onExcludeRule,
  onOnlyRule,
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
    <StyledCard ref={ref} data-selected={isSelected ? 'true' : undefined}>
      <StyledCardCheckbox
        type="checkbox"
        checked={isSelected}
        title={t`Select — shift-click to select a range`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelected(event);
        }}
        onChange={() => {}}
      />
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
          {senderHandle && (
            <StyledCardMenuItem
              type="button"
              onClick={() => onOnlyRule(senderHandle)}
            >
              {t`Only this sender`} ({senderHandle})
            </StyledCardMenuItem>
          )}
          {senderDomain && (
            <StyledCardMenuItem
              type="button"
              onClick={() => onOnlyRule(senderDomain)}
            >
              {t`Only this domain`} ({senderDomain})
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
  selectedIds: Set<string>;
  onToggleSelected: (threadId: string, event: React.MouseEvent) => void;
  onSelectColumn: (threadIds: string[], shouldSelect: boolean) => void;
  menuThreadId: string | null;
  onToggleMenu: (threadId: string) => void;
  onExcludeRule: (rule: string, threadId: string) => void;
  onOnlyRule: (rule: string) => void;
  onRemoveFromPipeline: (threadId: string) => void;
};

const PipelineColumn = ({
  column,
  columnIndex,
  threads,
  selectedIds,
  onToggleSelected,
  onSelectColumn,
  menuThreadId,
  onToggleMenu,
  onExcludeRule,
  onOnlyRule,
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
        {threads.length > 0 && (
          <StyledColumnSelectAll
            type="button"
            onClick={() =>
              onSelectColumn(
                threads.map((thread) => thread.id),
                !threads.every((thread) => selectedIds.has(thread.id)),
              )
            }
          >
            {threads.every((thread) => selectedIds.has(thread.id))
              ? t`none`
              : t`all`}
          </StyledColumnSelectAll>
        )}
      </StyledColumnTitle>
      {threads.map((thread) => (
        <PipelineCard
          key={thread.id}
          thread={thread}
          isSelected={selectedIds.has(thread.id)}
          onToggleSelected={(event) => onToggleSelected(thread.id, event)}
          isMenuOpen={menuThreadId === thread.id}
          onToggleMenu={() => onToggleMenu(thread.id)}
          onExcludeRule={onExcludeRule}
          onOnlyRule={onOnlyRule}
          onRemoveFromPipeline={onRemoveFromPipeline}
        />
      ))}
    </StyledColumn>
  );
};

type InboxPipelineBoardProps = {
  accountIds: string[];
  searchTerm: string;
  pipeline: InboxPipeline;
  onMoveCards: (threadIds: string[], columnIndex: number) => void;
  onExcludeRule: (rule: string, threadId: string) => void;
  onOnlyRule: (rule: string) => void;
  onRemoveFromPipeline: (threadIds: string[]) => void;
};

export const InboxPipelineBoard = ({
  accountIds,
  searchTerm,
  pipeline,
  onMoveCards,
  onExcludeRule,
  onOnlyRule,
  onRemoveFromPipeline,
}: InboxPipelineBoardProps) => {
  const {
    threads,
    totalNumberOfThreads,
    firstQueryLoading,
    isFetchingMore,
    fetchMoreRecords,
  } = useInboxThreads(accountIds, PIPELINE_BOARD_PAGE_SIZE, searchTerm);

  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Ancla del shift-click: ultimo id marcado a mano.
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  if (firstQueryLoading) {
    return <SkeletonLoader />;
  }

  const pipelineThreads = (threads ?? []).filter((thread) => {
    // Un hilo agregado manualmente pertenece al pipeline aunque no cumpla reglas.
    if (thread.id in (pipeline.cardColumns ?? {})) {
      return true;
    }

    return threadBelongsToPipeline(
      [
        thread.firstParticipant?.handle,
        ...(thread.lastTwoParticipants ?? []).map(
          (participant) => participant?.handle,
        ),
      ],
      pipeline,
    );
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

  // Orden visual de la baraja completa: es lo que hace que shift-click
  // seleccione "de aqui hasta alli" y no un rango arbitrario.
  const orderedIds = threadsByColumn.flatMap((columnThreads) =>
    columnThreads.map((thread) => thread.id),
  );

  const setSelection = (ids: Iterable<string>) => setSelectedIds(new Set(ids));

  const toggleSelected = (threadId: string, event: React.MouseEvent) => {
    if (event.shiftKey && isDefined(lastSelectedId)) {
      const from = orderedIds.indexOf(lastSelectedId);
      const to = orderedIds.indexOf(threadId);

      if (from !== -1 && to !== -1) {
        const range = orderedIds.slice(
          Math.min(from, to),
          Math.max(from, to) + 1,
        );

        setSelection([...selectedIds, ...range]);
        setLastSelectedId(threadId);

        return;
      }
    }

    const next = new Set(selectedIds);

    if (next.has(threadId)) {
      next.delete(threadId);
    } else {
      next.add(threadId);
    }

    setSelectedIds(next);
    setLastSelectedId(threadId);
  };

  const selectMany = (threadIds: string[], shouldSelect: boolean) => {
    const next = new Set(selectedIds);

    for (const threadId of threadIds) {
      if (shouldSelect) {
        next.add(threadId);
      } else {
        next.delete(threadId);
      }
    }

    setSelectedIds(next);
  };

  const selectedCount = selectedIds.size;

  const moveSelection = (columnIndex: number) => {
    onMoveCards([...selectedIds], columnIndex);
    setSelectedIds(new Set());
  };

  return (
    <StyledBoardWrapper>
      <StyledCountBar>
        {t`${pipelineThreads.length} in this pipeline · ${(threads ?? []).length} of ${totalNumberOfThreads} conversations loaded`}
        {selectedCount === 0 && orderedIds.length > 0 && (
          <StyledColumnSelectAll
            type="button"
            onClick={() => setSelection(orderedIds)}
          >
            {t`Select all`}
          </StyledColumnSelectAll>
        )}
      </StyledCountBar>

      {selectedCount > 0 && (
        <StyledSelectionBar>
          <StyledSelectionCount>
            {t`${selectedCount} selected`}
          </StyledSelectionCount>
          <StyledSelectionLabel>{t`Move to:`}</StyledSelectionLabel>
          {pipeline.columns.map((column, columnIndex) => (
            <StyledSelectionAction
              key={columnIndex}
              type="button"
              onClick={() => moveSelection(columnIndex)}
            >
              {column.name}
            </StyledSelectionAction>
          ))}
          <StyledSelectionAction
            type="button"
            onClick={() => {
              onRemoveFromPipeline([...selectedIds]);
              setSelectedIds(new Set());
            }}
          >
            {t`Remove from pipeline`}
          </StyledSelectionAction>
          <StyledSelectionAction
            type="button"
            onClick={() => setSelection(orderedIds)}
          >
            {t`Select all`}
          </StyledSelectionAction>
          <StyledSelectionAction
            type="button"
            onClick={() => setSelectedIds(new Set())}
          >
            {t`Clear`}
          </StyledSelectionAction>
        </StyledSelectionBar>
      )}
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

        const draggedId = String(source.id);

        // Arrastrar una tarjeta que esta seleccionada mueve toda la seleccion;
        // arrastrar una que no lo esta mueve solo esa y no toca la seleccion.
        if (selectedIds.has(draggedId)) {
          moveSelection(columnIndex);

          return;
        }

        onMoveCards([draggedId], columnIndex);
      }}
    >
      <StyledBoard>
        {pipeline.columns.map((column, columnIndex) => (
          <PipelineColumn
            key={columnIndex}
            column={column}
            columnIndex={columnIndex}
            threads={threadsByColumn[columnIndex]}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onSelectColumn={selectMany}
            menuThreadId={menuThreadId}
            onToggleMenu={(threadId) =>
              setMenuThreadId(menuThreadId === threadId ? null : threadId)
            }
            onExcludeRule={(rule, threadId) => {
              setMenuThreadId(null);
              onExcludeRule(rule, threadId);
            }}
            onOnlyRule={(rule) => {
              setMenuThreadId(null);
              onOnlyRule(rule);
            }}
            onRemoveFromPipeline={(threadId) => {
              setMenuThreadId(null);
              onRemoveFromPipeline([threadId]);
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
    </StyledBoardWrapper>
  );
};
