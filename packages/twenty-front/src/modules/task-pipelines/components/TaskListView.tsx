import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import { IconVideo } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { MemberAvatar, PRIORITY_META } from '@/task-pipelines/components/TaskPipelineUi';
import { type TaskMemberInfo } from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type PipelineTask,
  type TaskPipelineStage,
} from '@/task-pipelines/types/TaskPipelineTypes';
import { formatTaskDueDate, getTaskDueStatus } from '@/task-pipelines/utils/taskDueStatus';

const StyledWrapper = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  font-size: ${themeCssVariables.font.size.sm};
  width: 100%;

  th {
    border-bottom: 1px solid ${themeCssVariables.border.color.medium};
    color: ${themeCssVariables.font.color.tertiary};
    font-weight: ${themeCssVariables.font.weight.medium};
    padding: ${themeCssVariables.spacing[2]};
    text-align: left;
    white-space: nowrap;
  }

  td {
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    color: ${themeCssVariables.font.color.primary};
    padding: ${themeCssVariables.spacing[2]};
    vertical-align: middle;
  }

  tbody tr {
    cursor: pointer;
  }

  tbody tr:hover td {
    background: ${themeCssVariables.background.transparent.lighter};
  }
`;

const StyledPerson = styled.span`
  align-items: center;
  display: inline-flex;
  gap: ${themeCssVariables.spacing[1]};
  white-space: nowrap;
`;

const StyledDue = styled.span<{ tone: string }>`
  color: ${({ tone }) =>
    tone === 'overdue'
      ? themeCssVariables.color.red
      : tone === 'today'
        ? themeCssVariables.color.orange
        : themeCssVariables.font.color.secondary};
  white-space: nowrap;
`;

const StyledTitleCell = styled.span`
  align-items: center;
  display: inline-flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

export const TaskListView = ({
  tasks,
  stagesById,
  membersById,
  showPipeline,
  onOpenTask,
}: {
  tasks: PipelineTask[];
  stagesById: Map<string, TaskPipelineStage>;
  membersById: Map<string, TaskMemberInfo>;
  showPipeline: boolean;
  onOpenTask: (task: PipelineTask) => void;
}) => {
  if (tasks.length === 0) {
    return <StyledEmpty>{t`No tasks here.`}</StyledEmpty>;
  }

  const sorted = [...tasks].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

    return aDue - bDue || a.position - b.position;
  });

  return (
    <StyledWrapper>
      <StyledTable>
        <thead>
          <tr>
            <th>{t`Task`}</th>
            {showPipeline && <th>{t`Pipeline`}</th>}
            <th>{t`Stage`}</th>
            <th>{t`Assignee`}</th>
            <th>{t`Due`}</th>
            <th>{t`Priority`}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const stage = stagesById.get(task.stageId);
            const assignee = task.assigneeWorkspaceMemberId
              ? membersById.get(task.assigneeWorkspaceMemberId)
              : undefined;
            const dueStatus = getTaskDueStatus(task.dueAt, stage?.isDone === true || !!task.completedAt);

            return (
              <tr key={task.id} onClick={() => onOpenTask(task)}>
                <td>
                  <StyledTitleCell>
                    {task.source === 'FATHOM' && <IconVideo size={14} />}
                    {task.title}
                  </StyledTitleCell>
                </td>
                {showPipeline && <td>{task.pipelineName}</td>}
                <td>{stage ? <Tag color={stage.color as TagColor} text={stage.name} /> : '—'}</td>
                <td>
                  {assignee ? (
                    <StyledPerson>
                      <MemberAvatar member={assignee} size="xs" />
                      {assignee.fullName}
                    </StyledPerson>
                  ) : task.needsAssignment ? (
                    <Tag color="orange" text={t`Needs assignee`} />
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {task.dueAt ? <StyledDue tone={dueStatus}>{formatTaskDueDate(task.dueAt)}</StyledDue> : '—'}
                </td>
                <td>{task.priority ? PRIORITY_META[task.priority].label() : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </StyledTable>
    </StyledWrapper>
  );
};
