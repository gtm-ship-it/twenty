import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import {
  IconAlertTriangle,
  IconCalendar,
  IconFlag,
  IconListCheck,
  IconMail,
  IconMessage,
  IconPaperclip,
  IconVideo,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  MemberAvatar,
  PRIORITY_META,
} from '@/task-pipelines/components/TaskPipelineUi';
import { type TaskMemberInfo } from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type PipelineTask,
  type TaskPipelineLabel,
} from '@/task-pipelines/types/TaskPipelineTypes';
import {
  formatTaskDueDate,
  getTaskDueStatus,
} from '@/task-pipelines/utils/taskDueStatus';

const StyledCover = styled.img`
  border-radius: ${themeCssVariables.border.radius.sm};
  display: block;
  margin: -2px -4px 0;
  max-height: 140px;
  object-fit: cover;
  width: calc(100% + 8px);
`;

const StyledAvatars = styled.span`
  align-items: center;
  display: inline-flex;
  margin-left: auto;

  & > * + * {
    margin-left: -6px;
  }
`;

const StyledChecklistMeta = styled.span<{ complete: boolean }>`
  align-items: center;
  background: ${({ complete }) =>
    complete ? themeCssVariables.tag.background.green : 'transparent'};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ complete }) =>
    complete
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  display: inline-flex;
  gap: 3px;
  padding: 0 ${({ complete }) => (complete ? '4px' : '0')};
`;

const StyledCard = styled.div<{ isDone: boolean }>`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.light};
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  opacity: ${({ isDone }) => (isDone ? 0.72 : 1)};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  transition: border-color 0.12s ease;

  &:hover {
    border-color: ${themeCssVariables.border.color.strong};
    box-shadow: ${themeCssVariables.boxShadow.strong};
  }

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.color.blue};
  }
`;

const StyledTitle = styled.div<{ isDone: boolean }>`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.35;
  overflow-wrap: anywhere;
  text-decoration: ${({ isDone }) => (isDone ? 'line-through' : 'none')};
`;

const StyledMetaRow = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMeta = styled.span<{ tone?: 'danger' | 'warning' | 'default' }>`
  align-items: center;
  color: ${({ tone }) =>
    tone === 'danger'
      ? themeCssVariables.color.red
      : tone === 'warning'
        ? themeCssVariables.color.orange
        : themeCssVariables.font.color.tertiary};
  display: inline-flex;
  gap: 3px;
`;

const StyledLabels = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFooter = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledNeedsAssignment = styled.span`
  align-items: center;
  background: ${themeCssVariables.tag.background.orange};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 3px;
  padding: 1px 6px;
`;

const StyledUnassigned = styled.span`
  border: 1px dashed ${themeCssVariables.border.color.strong};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0 6px;
`;

const StyledAssignee = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 4px;
  margin-left: auto;
  min-width: 0;
`;

const StyledPipelineName = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
`;

type TaskCardProps = {
  task: PipelineTask;
  isDone: boolean;
  // Miembros de la tarjeta (el primero es el responsable principal).
  members: TaskMemberInfo[];
  labelColors: Map<string, string>;
  showPipelineName?: boolean;
  onOpen: () => void;
};

export const getLabelColor = (labels: TaskPipelineLabel[]) =>
  new Map(labels.map((label) => [label.name, label.color]));

export const TaskCard = ({
  task,
  isDone,
  members,
  labelColors,
  showPipelineName = false,
  onOpen,
}: TaskCardProps) => {
  const dueStatus = getTaskDueStatus(task.dueAt, isDone);
  const checklistDone = task.checklistDoneCount;
  const checklistTotal = task.checklistTotalCount;
  const attachmentCount = task.attachments.filter(
    (attachment) => attachment.purpose === 'ATTACHMENT',
  ).length;
  const priority = task.priority ? PRIORITY_META[task.priority] : null;

  return (
    <StyledCard
      isDone={isDone}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onOpen();
        }
      }}
    >
      {task.coverUrl && <StyledCover src={task.coverUrl} alt="" />}
      {showPipelineName && (
        <StyledPipelineName>{task.pipelineName}</StyledPipelineName>
      )}
      {task.labels.length > 0 && (
        <StyledLabels>
          {task.labels.map((label) => (
            <Tag
              key={label}
              color={(labelColors.get(label) ?? 'gray') as TagColor}
              text={label}
            />
          ))}
        </StyledLabels>
      )}
      <StyledTitle isDone={isDone}>{task.title}</StyledTitle>
      <StyledMetaRow>
        {priority && (
          <StyledMeta
            tone={
              task.priority === 'URGENT'
                ? 'danger'
                : task.priority === 'HIGH'
                  ? 'warning'
                  : 'default'
            }
          >
            <IconFlag size={12} />
            {priority.label()}
          </StyledMeta>
        )}
        {task.dueAt && (
          <StyledMeta
            tone={
              dueStatus === 'overdue'
                ? 'danger'
                : dueStatus === 'today'
                  ? 'warning'
                  : 'default'
            }
            title={dueStatus === 'overdue' ? t`Overdue` : undefined}
          >
            <IconCalendar size={12} />
            {task.startAt ? `${formatTaskDueDate(task.startAt)} – ` : ''}
            {formatTaskDueDate(task.dueAt)}
          </StyledMeta>
        )}
        {!task.dueAt && task.startAt && (
          <StyledMeta>
            <IconCalendar size={12} />
            {t`Starts`} {formatTaskDueDate(task.startAt)}
          </StyledMeta>
        )}
        {checklistTotal > 0 && (
          <StyledChecklistMeta complete={checklistDone === checklistTotal}>
            <IconListCheck size={12} />
            {checklistDone}/{checklistTotal}
          </StyledChecklistMeta>
        )}
        {attachmentCount > 0 && (
          <StyledMeta>
            <IconPaperclip size={12} />
            {attachmentCount}
          </StyledMeta>
        )}
        {task.commentCount > 0 && (
          <StyledMeta>
            <IconMessage size={12} />
            {task.commentCount}
          </StyledMeta>
        )}
        {task.source === 'FATHOM' && (
          <StyledMeta title={task.meeting?.title ?? t`From a meeting`}>
            <IconVideo size={12} />
          </StyledMeta>
        )}
        {task.source === 'EMAIL' && (
          <StyledMeta title={t`From an email`}>
            <IconMail size={12} />
          </StyledMeta>
        )}
      </StyledMetaRow>
      <StyledFooter>
        {members.length === 1 ? (
          <StyledAssignee title={members[0].fullName}>
            {members[0].firstName}
            <MemberAvatar member={members[0]} size="sm" />
          </StyledAssignee>
        ) : members.length > 1 ? (
          <StyledAvatars
            title={members.map((member) => member.fullName).join(', ')}
          >
            {members.slice(0, 4).map((member) => (
              <MemberAvatar key={member.id} member={member} size="sm" />
            ))}
          </StyledAvatars>
        ) : task.needsAssignment ? (
          <StyledNeedsAssignment>
            <IconAlertTriangle size={12} />
            {t`Needs assignee`}
          </StyledNeedsAssignment>
        ) : (
          <StyledUnassigned>{t`Unassigned`}</StyledUnassigned>
        )}
      </StyledFooter>
    </StyledCard>
  );
};
