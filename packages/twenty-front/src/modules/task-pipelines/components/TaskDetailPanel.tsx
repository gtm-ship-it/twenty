import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import {
  IconArchive,
  IconArrowBackUp,
  IconExternalLink,
  IconTrash,
  IconVideo,
  IconX,
} from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { v4 } from 'uuid';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import {
  MemberAvatar,
  MemberPicker,
  PRIORITY_META,
  StyledFieldLabel,
  StyledHint,
  StyledSegment,
  StyledSegmented,
  StyledSelect,
  StyledTextArea,
  StyledTextInput,
} from '@/task-pipelines/components/TaskPipelineUi';
import {
  ADD_PIPELINE_TASK_COMMENT,
  DELETE_PIPELINE_TASK_COMMENT,
  GET_PIPELINE_TASK_COMMENTS,
  UPDATE_PIPELINE_TASK_COMMENT,
} from '@/task-pipelines/graphql/taskPipelinesDocuments';
import { type TaskMemberInfo } from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type PipelineTask,
  type PipelineTaskComment,
  type TaskPipeline,
  type TaskPriority,
  type UpdatePipelineTaskInput,
} from '@/task-pipelines/types/TaskPipelineTypes';
import { dueFromInputValue, dueInputValue } from '@/task-pipelines/utils/taskDueStatus';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const StyledBackdrop = styled.div`
  background: ${themeCssVariables.background.overlaySecondary};
  inset: 0;
  position: fixed;
  z-index: 900;
`;

const StyledPanel = styled.aside`
  background: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  max-width: 100vw;
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 560px;
  z-index: 901;
`;

const StyledPanelHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledCrumb = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledPanelBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[5]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledTitleInput = styled.textarea`
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.3;
  outline: none;
  padding: ${themeCssVariables.spacing[1]};
  resize: none;
  width: 100%;

  &:hover,
  &:focus {
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledGrid = styled.div`
  align-items: center;
  display: grid;
  gap: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  grid-template-columns: 110px 1fr;
`;

const StyledGridLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledInline = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledDateInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: 3px ${themeCssVariables.spacing[2]};
`;

const StyledLabelToggle = styled.button<{ isActive: boolean }>`
  background: transparent;
  border: 1px dashed
    ${({ isActive }) => (isActive ? 'transparent' : themeCssVariables.border.color.medium)};
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  opacity: ${({ isActive }) => (isActive ? 1 : 0.55)};
  padding: 0;

  &:hover {
    opacity: 1;
  }
`;

const StyledMarkdown = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.55;
  overflow-wrap: anywhere;

  p {
    margin: 0 0 ${themeCssVariables.spacing[2]};
  }

  blockquote {
    border-left: 3px solid ${themeCssVariables.border.color.strong};
    color: ${themeCssVariables.font.color.secondary};
    margin: 0 0 ${themeCssVariables.spacing[2]};
    padding-left: ${themeCssVariables.spacing[3]};
  }

  a {
    color: ${themeCssVariables.color.blue};
  }

  ul,
  ol {
    margin: 0 0 ${themeCssVariables.spacing[2]};
    padding-left: ${themeCssVariables.spacing[5]};
  }
`;

const StyledDescriptionView = styled.div`
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: text;
  min-height: 40px;
  padding: ${themeCssVariables.spacing[2]};

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledChecklistRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};

  &:hover .checklist-remove {
    opacity: 1;
  }
`;

const StyledChecklistText = styled.input<{ isDone: boolean }>`
  background: transparent;
  border: none;
  color: ${({ isDone }) =>
    isDone ? themeCssVariables.font.color.tertiary : themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  outline: none;
  text-decoration: ${({ isDone }) => (isDone ? 'line-through' : 'none')};
`;

const StyledRemove = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  opacity: 0;
  padding: 0 4px;
`;

const StyledProgress = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-radius: 4px;
  height: 6px;
  margin-bottom: ${themeCssVariables.spacing[2]};
  overflow: hidden;
`;

const StyledProgressFill = styled.div<{ percent: number }>`
  background: ${themeCssVariables.color.green};
  height: 100%;
  transition: width 0.2s ease;
  width: ${({ percent }) => `${percent}%`};
`;

const StyledSourceBox = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledLink = styled.a`
  align-items: center;
  color: ${themeCssVariables.color.blue};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: 4px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledTimeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledComment = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledCommentBody = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  flex: 1;
  min-width: 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledCommentMeta = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: 2px;
`;

const StyledActivity = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding-left: 26px;
`;

const StyledTextButton = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
    text-decoration: underline;
  }
`;

const StyledFooterRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

type TaskDetailPanelProps = {
  task: PipelineTask;
  pipeline: TaskPipeline;
  membersById: Map<string, TaskMemberInfo>;
  currentWorkspaceMemberId: string | null;
  onClose: () => void;
  onUpdate: (input: UpdatePipelineTaskInput) => Promise<PipelineTask | null>;
  onMove: (stageId: string) => Promise<void>;
  onArchive: (archived: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenMeeting: (meetingId: string) => void;
};

export const TaskDetailPanel = ({
  task,
  pipeline,
  membersById,
  currentWorkspaceMemberId,
  onClose,
  onUpdate,
  onMove,
  onArchive,
  onDelete,
  onOpenMeeting,
}: TaskDetailPanelProps) => {
  const client = useApolloCoreClient();
  const { enqueueErrorSnackBar } = useSnackBar();
  const [title, setTitle] = useState(task.title);
  const [body, setBody] = useState(task.body);
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'comments'>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setBody(task.body);
  }, [task.id, task.title, task.body]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isEditingBody && editingCommentId === null) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, isEditingBody, editingCommentId]);

  const commentsQuery = useQuery<{ taskPipelineTaskComments: PipelineTaskComment[] }>(
    GET_PIPELINE_TASK_COMMENTS,
    { client, variables: { taskId: task.id }, fetchPolicy: 'cache-and-network' },
  );
  const [addComment, { loading: isAddingComment }] = useMutation(ADD_PIPELINE_TASK_COMMENT, { client });
  const [updateComment] = useMutation(UPDATE_PIPELINE_TASK_COMMENT, { client });
  const [deleteComment] = useMutation(DELETE_PIPELINE_TASK_COMMENT, { client });

  const pipelineMembers = useMemo(
    () =>
      pipeline.members
        .map((member) => membersById.get(member.workspaceMemberId))
        .filter((member): member is TaskMemberInfo => member !== undefined),
    [pipeline.members, membersById],
  );

  const labelColors = new Map(pipeline.labels.map((label) => [label.name, label.color]));
  const availableLabels = [
    ...pipeline.labels.map((label) => label.name),
    ...task.labels.filter((label) => !labelColors.has(label)),
  ];
  const stage = pipeline.stages.find((entry) => entry.id === task.stageId);
  const isDone = stage?.isDone === true;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      enqueueErrorSnackBar({ message: error instanceof Error ? error.message : t`Something went wrong` });
    }
  };

  const save = (input: UpdatePipelineTaskInput) => run(() => onUpdate(input));

  const checklist = task.checklist;
  const checklistDone = checklist.filter((item) => item.done).length;

  const comments = commentsQuery.data?.taskPipelineTaskComments ?? [];
  const visibleComments = comments.filter(
    (comment) => timelineFilter === 'all' || comment.kind === 'COMMENT',
  );

  const submitComment = () =>
    run(async () => {
      const text = commentDraft.trim();

      if (text.length === 0) {
        return;
      }

      await addComment({ variables: { taskId: task.id, body: text } });
      setCommentDraft('');
      await commentsQuery.refetch();
    });

  return (
    <>
      <StyledBackdrop onMouseDown={onClose} />
      <StyledPanel aria-label={t`Task`}>
        <StyledPanelHeader>
          <StyledCrumb>{pipeline.name}</StyledCrumb>
          <StyledSelect
            aria-label={t`Stage`}
            value={task.stageId}
            onChange={(event) => void run(() => onMove(event.target.value))}
          >
            {pipeline.stages.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </StyledSelect>
          <IconButton
            Icon={task.archivedAt ? IconArrowBackUp : IconArchive}
            size="small"
            variant="tertiary"
            ariaLabel={task.archivedAt ? t`Restore` : t`Archive`}
            onClick={() => void run(() => onArchive(!task.archivedAt))}
          />
          <IconButton Icon={IconX} size="small" variant="tertiary" ariaLabel={t`Close`} onClick={onClose} />
        </StyledPanelHeader>

        <StyledPanelBody>
          <StyledTitleInput
            rows={Math.min(4, Math.max(1, Math.ceil(title.length / 40)))}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim();

              if (next.length === 0) {
                setTitle(task.title);
              } else if (next !== task.title) {
                void save({ title: next });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                (event.target as HTMLTextAreaElement).blur();
              }
            }}
          />

          <StyledGrid>
            <StyledGridLabel>{t`Assignee`}</StyledGridLabel>
            <MemberPicker
              members={pipelineMembers}
              value={task.assigneeWorkspaceMemberId}
              onChange={(memberId) =>
                void save(memberId ? { assigneeWorkspaceMemberId: memberId } : { clearAssignee: true })
              }
            />

            <StyledGridLabel>{t`Due date`}</StyledGridLabel>
            <StyledInline>
              <StyledDateInput
                type="date"
                value={dueInputValue(task.dueAt)}
                onChange={(event) => {
                  const due = dueFromInputValue(event.target.value);

                  void save(due ? { dueAt: due } : { clearDueAt: true });
                }}
              />
              {task.dueAt && (
                <StyledTextButton type="button" onClick={() => void save({ clearDueAt: true })}>
                  {t`Clear`}
                </StyledTextButton>
              )}
            </StyledInline>

            <StyledGridLabel>{t`Priority`}</StyledGridLabel>
            <StyledSelect
              value={task.priority ?? 'NONE'}
              onChange={(event) => void save({ priority: event.target.value as TaskPriority | 'NONE' })}
            >
              <option value="NONE">{t`No priority`}</option>
              {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_META[priority].label()}
                </option>
              ))}
            </StyledSelect>

            <StyledGridLabel>{t`Labels`}</StyledGridLabel>
            <StyledInline>
              {availableLabels.map((label) => {
                const isActive = task.labels.includes(label);

                return (
                  <StyledLabelToggle
                    key={label}
                    type="button"
                    isActive={isActive}
                    title={isActive ? t`Remove label` : t`Add label`}
                    onClick={() =>
                      void save({
                        labels: isActive
                          ? task.labels.filter((entry) => entry !== label)
                          : [...task.labels, label],
                      })
                    }
                  >
                    <Tag color={(labelColors.get(label) ?? 'gray') as TagColor} text={label} />
                  </StyledLabelToggle>
                );
              })}
              <StyledTextInput
                style={{ width: 120, padding: '2px 8px', fontSize: 13 }}
                placeholder={t`+ label`}
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && newLabel.trim()) {
                    const label = newLabel.trim();

                    setNewLabel('');

                    if (!task.labels.includes(label)) {
                      void save({ labels: [...task.labels, label] });
                    }
                  }
                }}
              />
            </StyledInline>
          </StyledGrid>

          <div>
            <StyledFieldLabel>{t`Description`}</StyledFieldLabel>
            {isEditingBody ? (
              <>
                <StyledTextArea
                  autoFocus
                  rows={8}
                  value={body}
                  placeholder={t`Details, links, next steps… (Markdown supported)`}
                  onChange={(event) => setBody(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setBody(task.body);
                      setIsEditingBody(false);
                    }

                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      setIsEditingBody(false);

                      if (body !== task.body) {
                        void save({ body });
                      }
                    }
                  }}
                />
                <StyledFooterRow style={{ marginTop: 8 }}>
                  <Button
                    title={t`Cancel`}
                    size="small"
                    variant="secondary"
                    onClick={() => {
                      setBody(task.body);
                      setIsEditingBody(false);
                    }}
                  />
                  <Button
                    title={t`Save`}
                    size="small"
                    accent="blue"
                    onClick={() => {
                      setIsEditingBody(false);

                      if (body !== task.body) {
                        void save({ body });
                      }
                    }}
                  />
                </StyledFooterRow>
              </>
            ) : (
              <StyledDescriptionView onClick={() => setIsEditingBody(true)}>
                {task.body.trim() ? (
                  <StyledMarkdown>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {task.body}
                    </ReactMarkdown>
                  </StyledMarkdown>
                ) : (
                  <StyledHint>{t`Add a description…`}</StyledHint>
                )}
              </StyledDescriptionView>
            )}
          </div>

          <div>
            <StyledFieldLabel>
              {t`Checklist`} {checklist.length > 0 && `· ${checklistDone}/${checklist.length}`}
            </StyledFieldLabel>
            {checklist.length > 0 && (
              <StyledProgress>
                <StyledProgressFill percent={Math.round((checklistDone / checklist.length) * 100)} />
              </StyledProgress>
            )}
            {checklist.map((item) => (
              <StyledChecklistRow key={item.id}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() =>
                    void save({
                      checklist: checklist.map((entry) =>
                        entry.id === item.id ? { ...entry, done: !entry.done } : entry,
                      ),
                    })
                  }
                />
                <StyledChecklistText
                  isDone={item.done}
                  defaultValue={item.text}
                  onBlur={(event) => {
                    const text = event.target.value.trim();

                    if (text && text !== item.text) {
                      void save({
                        checklist: checklist.map((entry) => (entry.id === item.id ? { ...entry, text } : entry)),
                      });
                    }
                  }}
                />
                <StyledRemove
                  className="checklist-remove"
                  type="button"
                  aria-label={t`Remove item`}
                  onClick={() => void save({ checklist: checklist.filter((entry) => entry.id !== item.id) })}
                >
                  ✕
                </StyledRemove>
              </StyledChecklistRow>
            ))}
            <StyledTextInput
              style={{ marginTop: 6 }}
              placeholder={t`Add an item and press Enter`}
              value={newChecklistItem}
              onChange={(event) => setNewChecklistItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && newChecklistItem.trim()) {
                  const text = newChecklistItem.trim();

                  setNewChecklistItem('');
                  void save({ checklist: [...checklist, { id: v4(), text, done: false }] });
                }
              }}
            />
          </div>

          {(task.source !== 'MANUAL' || task.sourceLink) && (
            <StyledSourceBox>
              <StyledFieldLabel style={{ marginBottom: 0 }}>
                {task.source === 'FATHOM' ? t`From a meeting` : task.source === 'EMAIL' ? t`From an email` : t`Source`}
              </StyledFieldLabel>
              {task.meeting && (
                <StyledLink
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenMeeting(task.meeting!.id);
                  }}
                >
                  <IconVideo size={14} />
                  {task.meeting.title}
                  {task.meeting.startedAt && ` · ${new Date(task.meeting.startedAt).toLocaleDateString()}`}
                </StyledLink>
              )}
              {task.originalText && task.originalText !== task.title && (
                <StyledHint>
                  {t`Original`}: “{task.originalText}”
                </StyledHint>
              )}
              {task.sourceLink && (
                <StyledLink href={task.sourceLink} target="_blank" rel="noreferrer">
                  <IconExternalLink size={14} />
                  {task.source === 'FATHOM' ? t`Open the recording at this moment` : t`Open source`}
                </StyledLink>
              )}
            </StyledSourceBox>
          )}

          <div>
            <StyledInline style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <StyledFieldLabel style={{ marginBottom: 0 }}>{t`Activity`}</StyledFieldLabel>
              <StyledSegmented>
                <StyledSegment type="button" isActive={timelineFilter === 'all'} onClick={() => setTimelineFilter('all')}>
                  {t`All`}
                </StyledSegment>
                <StyledSegment
                  type="button"
                  isActive={timelineFilter === 'comments'}
                  onClick={() => setTimelineFilter('comments')}
                >
                  {t`Comments`}
                </StyledSegment>
              </StyledSegmented>
            </StyledInline>
            <StyledTextArea
              rows={3}
              placeholder={t`Write a comment or document what was done… (Ctrl/⌘ + Enter to send)`}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  void submitComment();
                }
              }}
            />
            <StyledFooterRow style={{ margin: '8px 0 16px' }}>
              <Button
                title={t`Comment`}
                size="small"
                accent="blue"
                disabled={commentDraft.trim().length === 0 || isAddingComment}
                onClick={() => void submitComment()}
              />
            </StyledFooterRow>
            <StyledTimeline>
              {[...visibleComments].reverse().map((comment) => {
                const author = comment.authorWorkspaceMemberId
                  ? membersById.get(comment.authorWorkspaceMemberId)
                  : undefined;

                if (comment.kind === 'ACTIVITY') {
                  return (
                    <StyledActivity key={comment.id}>
                      <b>{author?.firstName ?? t`Fathom`}</b> {comment.body} · {formatDateTime(comment.createdAt)}
                    </StyledActivity>
                  );
                }

                const isMine = comment.authorWorkspaceMemberId === currentWorkspaceMemberId;

                return (
                  <StyledComment key={comment.id}>
                    <MemberAvatar member={author} size="sm" />
                    <StyledCommentBody>
                      <StyledCommentMeta>
                        <b>{author?.fullName ?? '—'}</b>
                        {formatDateTime(comment.createdAt)}
                        {comment.updatedAt !== comment.createdAt && ` · ${t`edited`}`}
                        {isMine && editingCommentId !== comment.id && (
                          <>
                            <StyledTextButton
                              type="button"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.body);
                              }}
                            >
                              {t`Edit`}
                            </StyledTextButton>
                            <StyledTextButton
                              type="button"
                              onClick={() =>
                                void run(async () => {
                                  await deleteComment({ variables: { commentId: comment.id } });
                                  await commentsQuery.refetch();
                                })
                              }
                            >
                              {t`Delete`}
                            </StyledTextButton>
                          </>
                        )}
                      </StyledCommentMeta>
                      {editingCommentId === comment.id ? (
                        <>
                          <StyledTextArea
                            autoFocus
                            rows={3}
                            value={editingCommentText}
                            onChange={(event) => setEditingCommentText(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                setEditingCommentId(null);
                              }
                            }}
                          />
                          <StyledFooterRow style={{ marginTop: 6 }}>
                            <Button title={t`Cancel`} size="small" variant="secondary" onClick={() => setEditingCommentId(null)} />
                            <Button
                              title={t`Save`}
                              size="small"
                              accent="blue"
                              disabled={editingCommentText.trim().length === 0}
                              onClick={() =>
                                void run(async () => {
                                  await updateComment({
                                    variables: { commentId: comment.id, body: editingCommentText },
                                  });
                                  setEditingCommentId(null);
                                  await commentsQuery.refetch();
                                })
                              }
                            />
                          </StyledFooterRow>
                        </>
                      ) : (
                        <StyledMarkdown>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
                        </StyledMarkdown>
                      )}
                    </StyledCommentBody>
                  </StyledComment>
                );
              })}
              {visibleComments.length === 0 && <StyledHint>{t`No activity yet.`}</StyledHint>}
            </StyledTimeline>
          </div>

          <StyledFooterRow>
            {confirmDelete ? (
              <>
                <StyledHint style={{ marginRight: 'auto' }}>{t`Delete this task forever?`}</StyledHint>
                <Button title={t`Cancel`} size="small" variant="secondary" onClick={() => setConfirmDelete(false)} />
                <Button
                  title={t`Delete`}
                  size="small"
                  accent="danger"
                  Icon={IconTrash}
                  onClick={() => void run(onDelete)}
                />
              </>
            ) : (
              <Button
                title={t`Delete task`}
                size="small"
                variant="tertiary"
                accent="danger"
                Icon={IconTrash}
                onClick={() => setConfirmDelete(true)}
              />
            )}
          </StyledFooterRow>
          {isDone && task.completedAt && (
            <StyledHint>{t`Completed on ${formatDateTime(task.completedAt)}`}</StyledHint>
          )}
        </StyledPanelBody>
      </StyledPanel>
    </>
  );
};
