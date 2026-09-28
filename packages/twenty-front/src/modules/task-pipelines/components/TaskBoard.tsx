import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import { IconPlus } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { TaskCard } from '@/task-pipelines/components/TaskCard';
import { type TaskMemberInfo } from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type PipelineTask,
  type TaskPipelineStage,
} from '@/task-pipelines/types/TaskPipelineTypes';
import { computeInsertPosition } from '@/task-pipelines/utils/computeInsertPosition';

const StyledBoardShell = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
`;

const StyledBoard = styled.div`
  align-items: flex-start;
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing[3]};
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

// Pista de "hay más columnas a la derecha".
const StyledScrollHint = styled.div`
  background: linear-gradient(
    to right,
    transparent,
    ${themeCssVariables.background.primary}
  );
  bottom: 0;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
  width: 48px;
`;

const StyledColumn = styled.div<{ isOver: boolean }>`
  background: ${({ isOver }) =>
    isOver
      ? themeCssVariables.background.transparent.medium
      : themeCssVariables.background.secondary};
  border: 1px solid
    ${({ isOver }) =>
      isOver
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  max-height: 100%;
  min-height: 160px;
  padding: ${themeCssVariables.spacing[2]};
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
  width: 272px;
`;

const StyledColumnHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1]} 0;
`;

const StyledCount = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledCards = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  min-height: 24px;
  overflow-y: auto;
`;

const StyledDraggable = styled.div<{ isDragSource: boolean }>`
  opacity: ${({ isDragSource }) => (isDragSource ? 0.35 : 1)};
`;

const StyledAddButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledQuickAdd = styled.textarea`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.color.blue};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  min-height: 56px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  resize: none;
  width: 100%;
`;

const StyledQuickHint = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
`;

const COLUMN_PREFIX = 'task-col:';

const DraggableTask = ({
  task,
  children,
}: {
  task: PipelineTask;
  children: React.ReactNode;
}) => {
  const { ref, isDragSource } = useDraggable({
    id: task.id,
    feedback: 'clone',
  });

  return (
    <StyledDraggable
      ref={ref}
      isDragSource={isDragSource}
      data-task-card={task.id}
    >
      {children}
    </StyledDraggable>
  );
};

type TaskColumnProps = {
  stage: TaskPipelineStage;
  tasks: PipelineTask[];
  membersById: Map<string, TaskMemberInfo>;
  labelColors: Map<string, string>;
  onOpenTask: (taskId: string) => void;
  onQuickAdd: (stageId: string, title: string) => Promise<void>;
};

const TaskColumn = ({
  stage,
  tasks,
  membersById,
  labelColors,
  onOpenTask,
  onQuickAdd,
}: TaskColumnProps) => {
  const { ref, isDropTarget } = useDroppable({
    id: `${COLUMN_PREFIX}${stage.id}`,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = async () => {
    const title = draft.trim();

    if (title.length === 0) {
      setIsAdding(false);

      return;
    }

    setDraft('');

    try {
      await onQuickAdd(stage.id, title);
    } catch {
      // Si falla la creación, se devuelve el texto para no perderlo.
      setDraft(title);
    }
  };

  return (
    <StyledColumn ref={ref} isOver={isDropTarget} data-task-column={stage.id}>
      <StyledColumnHeader>
        <Tag color={stage.color as TagColor} text={stage.name} />
        <StyledCount>{tasks.length}</StyledCount>
      </StyledColumnHeader>
      <StyledCards>
        {tasks.map((task) => (
          <DraggableTask key={task.id} task={task}>
            <TaskCard
              task={task}
              isDone={stage.isDone}
              assignee={
                task.assigneeWorkspaceMemberId
                  ? (membersById.get(task.assigneeWorkspaceMemberId) ?? null)
                  : null
              }
              labelColors={labelColors}
              onOpen={() => onOpenTask(task.id)}
            />
          </DraggableTask>
        ))}
      </StyledCards>
      {isAdding ? (
        <div>
          <StyledQuickAdd
            autoFocus
            value={draft}
            placeholder={t`Task title`}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void submit().then(() => setIsAdding(false))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }

              if (event.key === 'Escape') {
                setDraft('');
                setIsAdding(false);
              }
            }}
          />
          <StyledQuickHint>{t`Enter to add · Esc to cancel`}</StyledQuickHint>
        </div>
      ) : (
        <StyledAddButton type="button" onClick={() => setIsAdding(true)}>
          <IconPlus size={14} />
          {t`Add task`}
        </StyledAddButton>
      )}
    </StyledColumn>
  );
};

// Índice de inserción según la altura del puntero respecto a las tarjetas de
// la columna destino (sin contar la que se arrastra).
const getDropIndex = (
  stageId: string,
  draggedId: string,
  pointerY: number | null,
): number | null => {
  if (pointerY === null) {
    return null;
  }

  const column = document.querySelector(`[data-task-column="${stageId}"]`);

  if (!column) {
    return null;
  }

  const cards = Array.from(
    column.querySelectorAll<HTMLElement>('[data-task-card]'),
  ).filter((element) => element.dataset.taskCard !== draggedId);

  const index = cards.findIndex((element) => {
    const rect = element.getBoundingClientRect();

    return pointerY < rect.top + rect.height / 2;
  });

  return index === -1 ? cards.length : index;
};

type TaskBoardProps = {
  stages: TaskPipelineStage[];
  // Tareas visibles (con filtros aplicados) y todas: la posición al soltar se
  // calcula contra la columna completa para no chocar con tarjetas ocultas.
  tasks: PipelineTask[];
  allTasks: PipelineTask[];
  membersById: Map<string, TaskMemberInfo>;
  labelColors: Map<string, string>;
  onOpenTask: (taskId: string) => void;
  onMoveTask: (taskId: string, stageId: string, position: number) => void;
  onQuickAdd: (stageId: string, title: string) => Promise<void>;
};

export const TaskBoard = ({
  stages,
  tasks,
  allTasks,
  membersById,
  labelColors,
  onOpenTask,
  onMoveTask,
  onQuickAdd,
}: TaskBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [hasMoreRight, setHasMoreRight] = useState(false);

  const updateScrollHint = useCallback(() => {
    const board = boardRef.current;

    if (board !== null) {
      setHasMoreRight(
        board.scrollLeft + board.clientWidth < board.scrollWidth - 4,
      );
    }
  }, []);

  useEffect(() => {
    updateScrollHint();
    window.addEventListener('resize', updateScrollHint);

    return () => window.removeEventListener('resize', updateScrollHint);
  }, [updateScrollHint, stages.length]);

  const tasksByStage = new Map<string, PipelineTask[]>(
    stages.map((stage) => [stage.id, []]),
  );

  for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
    // Una tarea de un stage que ya no existe cae en la primera columna.
    const bucket =
      tasksByStage.get(task.stageId) ?? tasksByStage.get(stages[0]?.id ?? '');

    bucket?.push(task);
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, target } = event.operation;

        if (event.canceled || !isDefined(source) || !isDefined(target)) {
          return;
        }

        const targetId = String(target.id);

        if (!targetId.startsWith(COLUMN_PREFIX)) {
          return;
        }

        const stageId = targetId.slice(COLUMN_PREFIX.length);
        const taskId = String(source.id);
        const pointer = (
          event.operation as { position?: { current?: { y: number } } }
        ).position?.current;
        const visibleOthers = (tasksByStage.get(stageId) ?? []).filter(
          (task) => task.id !== taskId,
        );
        const dropIndex =
          getDropIndex(stageId, taskId, pointer?.y ?? null) ??
          visibleOthers.length;
        const moving = allTasks.find((task) => task.id === taskId);
        const currentIndex = (tasksByStage.get(stageId) ?? []).findIndex(
          (task) => task.id === taskId,
        );

        // Soltar en el mismo sitio no hace nada.
        if (moving?.stageId === stageId && currentIndex === dropIndex) {
          return;
        }

        // Columna completa (visibles + ocultas por filtros), sin la que se mueve.
        const fullColumn = allTasks
          .filter((task) => task.stageId === stageId && task.id !== taskId)
          .sort((a, b) => a.position - b.position);
        const previousVisible = visibleOthers[dropIndex - 1];
        const nextVisible = visibleOthers[dropIndex];
        const fullIndex = isDefined(previousVisible)
          ? fullColumn.findIndex((task) => task.id === previousVisible.id) + 1
          : isDefined(nextVisible)
            ? fullColumn.findIndex((task) => task.id === nextVisible.id)
            : fullColumn.length;

        onMoveTask(
          taskId,
          stageId,
          computeInsertPosition(
            fullColumn.map((task) => task.position),
            fullIndex,
          ),
        );
      }}
    >
      <StyledBoardShell>
        <StyledBoard ref={boardRef} onScroll={updateScrollHint}>
          {stages.map((stage) => (
            <TaskColumn
              key={stage.id}
              stage={stage}
              tasks={tasksByStage.get(stage.id) ?? []}
              membersById={membersById}
              labelColors={labelColors}
              onOpenTask={onOpenTask}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </StyledBoard>
        {hasMoreRight && <StyledScrollHint />}
      </StyledBoardShell>
    </DragDropProvider>
  );
};
