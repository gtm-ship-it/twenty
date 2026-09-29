import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import {
  IconArchive,
  IconArrowBackUp,
  IconExternalLink,
  IconPhoto,
  IconTrash,
  IconUserPlus,
  IconVideo,
  IconX,
} from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { TaskAttachments } from '@/task-pipelines/components/TaskAttachments';
import { TaskChecklists } from '@/task-pipelines/components/TaskChecklists';
import {
  MemberAvatar,
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
  type TaskAttachment,
  type TaskAttachmentPurpose,
  type TaskChecklist,
  type TaskPipeline,
  type TaskPriority,
  type UpdatePipelineTaskInput,
} from '@/task-pipelines/types/TaskPipelineTypes';
import { SafeMarkdown } from '@/task-pipelines/components/SafeMarkdown';
import { formatTaskActivity } from '@/task-pipelines/utils/formatTaskActivity';
import { safeHttpUrl } from '@/task-pipelines/utils/safeHttpUrl';
import {
  dueFromInputValue,
  dueInputValue,
  getTaskDueStatus,
} from '@/task-pipelines/utils/taskDueStatus';
import { friendlyErrorMessage } from '@/task-pipelines/utils/friendlyErrorMessage';
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
  bottom: 0;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  max-width: 100vw;
  position: fixed;
  right: 0;
  top: 0;
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
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  flex-shrink: 0;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.35;
  min-height: 40px;
  outline: none;
  overflow: hidden;
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
    ${({ isActive }) =>
      isActive ? 'transparent' : themeCssVariables.border.color.medium};
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

const StyledSourceBox = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledLinkButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: ${themeCssVariables.color.blue};
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  gap: 4px;
  padding: 0;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }
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

const StyledCover = styled.img`
  border-radius: ${themeCssVariables.border.radius.sm};
  display: block;
  flex-shrink: 0;
  max-height: 220px;
  object-fit: cover;
  width: 100%;
`;

const StyledMemberChip = styled.span`
  align-items: center;
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 12px;
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: 4px;
  padding: 1px 6px 1px 2px;

  button {
    background: transparent;
    border: none;
    color: ${themeCssVariables.font.color.tertiary};
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
  }
`;

const StyledImageButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 3px;
  margin-right: auto;
  padding: 0;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

// Checklists tal como las pide la API (sin campos calculados).
const toChecklistInput = (checklists: TaskChecklist[]) =>
  checklists.map((checklist) => ({
    id: checklist.id,
    title: checklist.title,
    items: checklist.items.map((item) => ({
      id: item.id,
      text: item.text,
      done: item.done,
      assigneeWorkspaceMemberId: item.assigneeWorkspaceMemberId,
      dueAt: item.dueAt,
    })),
  }));

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
  onUploadAttachment: (
    file: File,
    purpose: TaskAttachmentPurpose,
    checklistItemId?: string | null,
  ) => Promise<TaskAttachment | null>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
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
  onUploadAttachment,
  onDeleteAttachment,
}: TaskDetailPanelProps) => {
  const client = useApolloCoreClient();
  const { enqueueErrorSnackBar } = useSnackBar();
  const [title, setTitle] = useState(task.title);
  const [body, setBody] = useState(task.body);
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const commentImageRef = useRef<HTMLInputElement>(null);
  const bodyImageRef = useRef<HTMLInputElement>(null);
  const [newLabel, setNewLabel] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'comments'>(
    'all',
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  // Esc en la descripción descarta: el onBlur que viene detrás no debe guardar.
  // oxlint-disable-next-line twenty/no-state-useref
  const cancelBodyEdit = useRef(false);

  // El título crece con el texto (nunca se corta).
  useEffect(() => {
    const element = titleRef.current;

    if (element !== null) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [title]);

  // Checklist y etiquetas se editan en local al instante y se guardan en cola:
  // cada guardado parte del último valor local, así dos clics seguidos no se pisan.
  const [checklists, setChecklists] = useState<TaskChecklist[]>(
    task.checklists,
  );
  const [labels, setLabels] = useState<string[]>(task.labels);
  const [memberIds, setMemberIds] = useState<string[]>(
    task.memberWorkspaceMemberIds,
  );
  // Contador y cola de guardados en curso: no son estado de render, solo coordinan escrituras.
  // oxlint-disable-next-line twenty/no-state-useref
  const pendingSaves = useRef(0);
  // oxlint-disable-next-line twenty/no-state-useref
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    setTitle(task.title);
    setBody(task.body);
  }, [task.id, task.title, task.body]);

  // Solo se re-sincroniza desde el servidor cuando no hay guardados en curso.
  useEffect(() => {
    if (pendingSaves.current === 0) {
      setChecklists(task.checklists);
      setLabels(task.labels);
      setMemberIds(task.memberWorkspaceMemberIds);
    }
  }, [task.checklists, task.labels, task.memberWorkspaceMemberIds]);

  useEffect(() => {
    panelRef.current?.focus();
  }, [task.id]);

  const flushTitle = () => {
    const next = title.trim();

    if (next.length > 0 && next !== task.title) {
      void onUpdate({ title: next });
    }
  };

  const closePanel = () => {
    flushTitle();

    if (isEditingBody && body !== task.body) {
      void onUpdate({ body });
    }

    onClose();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }

      const target = event.target as HTMLElement | null;

      // Esc dentro de un campo solo sale del campo (su onBlur guarda).
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        target.blur();

        return;
      }

      if (!isEditingBody && editingCommentId === null) {
        closePanel();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const commentsQuery = useQuery<{
    taskPipelineTaskComments: PipelineTaskComment[];
  }>(GET_PIPELINE_TASK_COMMENTS, {
    client,
    variables: { taskId: task.id },
    fetchPolicy: 'cache-and-network',
  });
  const [addComment, { loading: isAddingComment }] = useMutation(
    ADD_PIPELINE_TASK_COMMENT,
    { client },
  );
  const [updateComment] = useMutation(UPDATE_PIPELINE_TASK_COMMENT, { client });
  const [deleteComment] = useMutation(DELETE_PIPELINE_TASK_COMMENT, { client });

  const pipelineMembers = useMemo(
    () =>
      pipeline.members
        .map((member) => membersById.get(member.workspaceMemberId))
        .filter((member): member is TaskMemberInfo => member !== undefined),
    [pipeline.members, membersById],
  );

  const labelColors = new Map(
    pipeline.labels.map((label) => [label.name, label.color]),
  );
  const availableLabels = [
    ...pipeline.labels.map((label) => label.name),
    ...labels.filter((label) => !labelColors.has(label)),
  ];
  const stage = pipeline.stages.find((entry) => entry.id === task.stageId);
  const isDone = stage?.isDone === true;
  const dueStatus = getTaskDueStatus(task.dueAt, isDone || !!task.completedAt);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      enqueueErrorSnackBar({
        message: friendlyErrorMessage(error, t`Something went wrong`),
      });
    }
  };

  const save = (input: UpdatePipelineTaskInput) => run(() => onUpdate(input));

  const enqueueSave = (input: UpdatePipelineTaskInput) => {
    pendingSaves.current += 1;
    saveQueue.current = saveQueue.current
      .then(() => run(() => onUpdate(input)))
      .finally(() => {
        pendingSaves.current -= 1;
      });
  };

  const updateChecklists = (next: TaskChecklist[]) => {
    setChecklists(next);
    enqueueSave({ checklists: toChecklistInput(next) });
  };

  const updateMembers = (next: string[]) => {
    setMemberIds(next);
    enqueueSave({ memberWorkspaceMemberIds: next });
  };

  // Imagen para pegar en un comentario o en la descripción (markdown).
  const uploadInlineImage = async (file: File) => {
    setIsUploadingInline(true);

    try {
      const attachment = await onUploadAttachment(file, 'INLINE');

      return attachment
        ? `![${attachment.name.replace(/[[\]]/g, '')}](${attachment.url})`
        : null;
    } catch (error) {
      enqueueErrorSnackBar({
        message: friendlyErrorMessage(error, t`Could not upload the image`),
      });

      return null;
    } finally {
      setIsUploadingInline(false);
    }
  };

  const updateLabels = (next: string[]) => {
    setLabels(next);
    enqueueSave({ labels: next });
  };

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
      <StyledBackdrop onMouseDown={closePanel} />
      <StyledPanel
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t`Task`}
      >
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
          <IconButton
            Icon={IconX}
            size="small"
            variant="tertiary"
            ariaLabel={t`Close`}
            onClick={closePanel}
          />
        </StyledPanelHeader>

        <StyledPanelBody>
          {task.coverUrl && <StyledCover src={task.coverUrl} alt="" />}
          <StyledTitleInput
            ref={titleRef}
            rows={1}
            aria-label={t`Title`}
            value={title}
            onChange={(event) =>
              setTitle(event.target.value.replace(/[\r\n]+/g, ' '))
            }
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

          {isDone && task.completedAt !== null && (
            <StyledHint>
              ✓ {t`Completed on ${formatDateTime(task.completedAt)}`}
            </StyledHint>
          )}

          <StyledGrid>
            <StyledGridLabel>{t`Members`}</StyledGridLabel>
            <StyledInline>
              {memberIds.map((memberId) => {
                const member = membersById.get(memberId);

                return (
                  <StyledMemberChip key={memberId} title={member?.fullName}>
                    <MemberAvatar member={member} size="xs" />
                    {member?.firstName ?? '—'}
                    <button
                      type="button"
                      aria-label={t`Remove member`}
                      onClick={() =>
                        updateMembers(memberIds.filter((id) => id !== memberId))
                      }
                    >
                      ✕
                    </button>
                  </StyledMemberChip>
                );
              })}
              {pipelineMembers.some(
                (member) => !memberIds.includes(member.id),
              ) && (
                <StyledSelect
                  aria-label={t`Add member`}
                  value=""
                  style={{ fontSize: 13, padding: '2px 6px' }}
                  onChange={(event) => {
                    if (event.target.value) {
                      updateMembers([...memberIds, event.target.value]);
                    }
                  }}
                >
                  <option value="">{t`+ Add member`}</option>
                  {pipelineMembers
                    .filter((member) => !memberIds.includes(member.id))
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName}
                      </option>
                    ))}
                </StyledSelect>
              )}
              {currentWorkspaceMemberId !== null &&
                !memberIds.includes(currentWorkspaceMemberId) &&
                pipelineMembers.some(
                  (member) => member.id === currentWorkspaceMemberId,
                ) && (
                  <StyledTextButton
                    type="button"
                    style={{
                      alignItems: 'center',
                      display: 'inline-flex',
                      fontSize: 13,
                      gap: 3,
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() =>
                      updateMembers([...memberIds, currentWorkspaceMemberId])
                    }
                  >
                    <IconUserPlus size={14} />
                    {t`Join`}
                  </StyledTextButton>
                )}
            </StyledInline>

            <StyledGridLabel>{t`Start date`}</StyledGridLabel>
            <StyledInline>
              <StyledDateInput
                type="date"
                aria-label={t`Start date`}
                value={dueInputValue(task.startAt)}
                onChange={(event) => {
                  const start = dueFromInputValue(event.target.value);

                  void save(
                    start ? { startAt: start } : { clearStartAt: true },
                  );
                }}
              />
              {task.startAt && (
                <StyledTextButton
                  type="button"
                  onClick={() => void save({ clearStartAt: true })}
                >
                  {t`Clear`}
                </StyledTextButton>
              )}
            </StyledInline>

            <StyledGridLabel>{t`Due date`}</StyledGridLabel>
            <StyledInline>
              <StyledDateInput
                type="date"
                aria-label={t`Due date`}
                style={{
                  color:
                    dueStatus === 'overdue'
                      ? themeCssVariables.color.red
                      : dueStatus === 'today' || dueStatus === 'soon'
                        ? themeCssVariables.color.orange
                        : undefined,
                }}
                value={dueInputValue(task.dueAt)}
                onChange={(event) => {
                  const due = dueFromInputValue(event.target.value);

                  void save(due ? { dueAt: due } : { clearDueAt: true });
                }}
              />
              {task.dueAt && (
                <StyledTextButton
                  type="button"
                  onClick={() => void save({ clearDueAt: true })}
                >
                  {t`Clear`}
                </StyledTextButton>
              )}
            </StyledInline>

            <StyledGridLabel>{t`Priority`}</StyledGridLabel>
            <StyledSelect
              aria-label={t`Priority`}
              value={task.priority ?? 'NONE'}
              onChange={(event) =>
                void save({
                  priority: event.target.value as TaskPriority | 'NONE',
                })
              }
            >
              <option value="NONE">{t`No priority`}</option>
              {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map(
                (priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_META[priority].label()}
                  </option>
                ),
              )}
            </StyledSelect>

            <StyledGridLabel>{t`Labels`}</StyledGridLabel>
            <StyledInline>
              {availableLabels.map((label) => {
                const isActive = labels.includes(label);

                return (
                  <StyledLabelToggle
                    key={label}
                    type="button"
                    isActive={isActive}
                    title={isActive ? t`Remove label` : t`Add label`}
                    onClick={() =>
                      updateLabels(
                        isActive
                          ? labels.filter((entry) => entry !== label)
                          : [...labels, label],
                      )
                    }
                  >
                    <Tag
                      color={(labelColors.get(label) ?? 'gray') as TagColor}
                      text={label}
                    />
                  </StyledLabelToggle>
                );
              })}
              <StyledTextInput
                aria-label={t`Add label`}
                style={{ width: 120, padding: '2px 8px', fontSize: 13 }}
                placeholder={t`+ label`}
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && newLabel.trim()) {
                    const label = newLabel.trim();

                    setNewLabel('');

                    if (!labels.includes(label)) {
                      updateLabels([...labels, label]);
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
                  aria-label={t`Description`}
                  value={body}
                  placeholder={t`Details, links, next steps… (Markdown supported)`}
                  onChange={(event) => setBody(event.target.value)}
                  // Igual que el resto de campos: se guarda solo al salir.
                  onBlur={() => {
                    setIsEditingBody(false);

                    if (cancelBodyEdit.current) {
                      cancelBodyEdit.current = false;
                      setBody(task.body);

                      return;
                    }

                    if (body !== task.body) {
                      void save({ body });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      cancelBodyEdit.current = true;
                      (event.target as HTMLTextAreaElement).blur();
                    }

                    if (
                      event.key === 'Enter' &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      (event.target as HTMLTextAreaElement).blur();
                    }
                  }}
                />
                <StyledHint style={{ marginTop: 4 }}>
                  {t`Saves when you click outside · Esc to discard changes`}
                </StyledHint>
              </>
            ) : (
              <StyledDescriptionView
                role="button"
                tabIndex={0}
                aria-label={t`Edit description`}
                onClick={() => setIsEditingBody(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setIsEditingBody(true);
                  }
                }}
              >
                {task.body.trim() ? (
                  <StyledMarkdown>
                    <SafeMarkdown stopLinkPropagation>{task.body}</SafeMarkdown>
                  </StyledMarkdown>
                ) : (
                  <StyledHint>{t`Add a description…`}</StyledHint>
                )}
              </StyledDescriptionView>
            )}
            <input
              ref={bodyImageRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];

                event.target.value = '';

                if (!file) {
                  return;
                }

                const markdown = await uploadInlineImage(file);

                if (markdown !== null) {
                  const next = `${task.body.trimEnd()}${task.body.trim() ? '\n\n' : ''}${markdown}`;

                  setBody(next);
                  void save({ body: next });
                }
              }}
            />
            {!isEditingBody && (
              <StyledImageButton
                type="button"
                style={{ marginTop: 4 }}
                disabled={isUploadingInline}
                onClick={() => bodyImageRef.current?.click()}
              >
                <IconPhoto size={14} />
                {isUploadingInline ? t`Uploading…` : t`Add image`}
              </StyledImageButton>
            )}
          </div>

          <TaskChecklists
            checklists={checklists}
            members={pipelineMembers}
            membersById={membersById}
            attachments={task.attachments}
            onChange={updateChecklists}
            onUploadPhoto={async (checklistItemId, file) => {
              await run(() =>
                onUploadAttachment(file, 'CHECKLIST_ITEM', checklistItemId),
              );
            }}
            onDeletePhoto={(attachmentId) =>
              run(() => onDeleteAttachment(attachmentId))
            }
          />

          <TaskAttachments
            attachments={task.attachments}
            coverAttachmentId={task.coverAttachmentId}
            onUpload={async (file) => {
              await run(() => onUploadAttachment(file, 'ATTACHMENT'));
            }}
            onDelete={(attachmentId) =>
              run(() => onDeleteAttachment(attachmentId))
            }
            onSetCover={(attachmentId) =>
              save(
                attachmentId !== null
                  ? { coverAttachmentId: attachmentId }
                  : { clearCover: true },
              )
            }
          />

          {(task.source !== 'MANUAL' || task.sourceLink) && (
            <StyledSourceBox>
              <StyledFieldLabel style={{ marginBottom: 0 }}>
                {task.source === 'FATHOM'
                  ? t`From a meeting`
                  : task.source === 'EMAIL'
                    ? t`From an email`
                    : t`Source`}
              </StyledFieldLabel>
              {task.meeting && (
                <StyledLinkButton
                  type="button"
                  onClick={() => onOpenMeeting(task.meeting!.id)}
                >
                  <IconVideo size={14} />
                  {task.meeting.title}
                  {task.meeting.startedAt &&
                    ` · ${new Date(task.meeting.startedAt).toLocaleDateString()}`}
                </StyledLinkButton>
              )}
              {task.originalText && task.originalText !== task.title && (
                <StyledHint>
                  {t`Original`}: “{task.originalText}”
                </StyledHint>
              )}
              {safeHttpUrl(task.sourceLink) && (
                <StyledLink
                  href={safeHttpUrl(task.sourceLink)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconExternalLink size={14} />
                  {task.source === 'FATHOM'
                    ? t`Open the recording at this moment`
                    : t`Open source`}
                </StyledLink>
              )}
            </StyledSourceBox>
          )}

          <div>
            <StyledInline
              style={{ justifyContent: 'space-between', marginBottom: 8 }}
            >
              <StyledFieldLabel
                style={{ marginBottom: 0 }}
              >{t`Activity`}</StyledFieldLabel>
              <StyledSegmented>
                <StyledSegment
                  type="button"
                  isActive={timelineFilter === 'all'}
                  onClick={() => setTimelineFilter('all')}
                >
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
              <input
                ref={commentImageRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];

                  event.target.value = '';

                  if (!file) {
                    return;
                  }

                  const markdown = await uploadInlineImage(file);

                  if (markdown !== null) {
                    setCommentDraft(
                      (draft) =>
                        `${draft.trimEnd()}${draft.trim() ? '\n' : ''}${markdown}\n`,
                    );
                  }
                }}
              />
              <StyledImageButton
                type="button"
                disabled={isUploadingInline}
                onClick={() => commentImageRef.current?.click()}
              >
                <IconPhoto size={14} />
                {isUploadingInline ? t`Uploading…` : t`Add image`}
              </StyledImageButton>
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
                      <b>{author?.firstName ?? t`Fathom`}</b>{' '}
                      {formatTaskActivity(comment.body)} ·{' '}
                      {formatDateTime(comment.createdAt)}
                    </StyledActivity>
                  );
                }

                const isMine =
                  comment.authorWorkspaceMemberId === currentWorkspaceMemberId;

                return (
                  <StyledComment key={comment.id}>
                    <MemberAvatar member={author} size="sm" />
                    <StyledCommentBody>
                      <StyledCommentMeta>
                        <b>{author?.fullName ?? '—'}</b>
                        {formatDateTime(comment.createdAt)}
                        {comment.updatedAt !== comment.createdAt &&
                          ` · ${t`edited`}`}
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
                                  await deleteComment({
                                    variables: { commentId: comment.id },
                                  });
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
                            onChange={(event) =>
                              setEditingCommentText(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                setEditingCommentId(null);
                              }
                            }}
                          />
                          <StyledFooterRow style={{ marginTop: 6 }}>
                            <Button
                              title={t`Cancel`}
                              size="small"
                              variant="secondary"
                              onClick={() => setEditingCommentId(null)}
                            />
                            <Button
                              title={t`Save`}
                              size="small"
                              accent="blue"
                              disabled={editingCommentText.trim().length === 0}
                              onClick={() =>
                                void run(async () => {
                                  await updateComment({
                                    variables: {
                                      commentId: comment.id,
                                      body: editingCommentText,
                                    },
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
                          <SafeMarkdown>{comment.body}</SafeMarkdown>
                        </StyledMarkdown>
                      )}
                    </StyledCommentBody>
                  </StyledComment>
                );
              })}
              {commentsQuery.error !== undefined && comments.length === 0 ? (
                <StyledHint>
                  {t`Could not load the activity.`}{' '}
                  <StyledTextButton
                    type="button"
                    onClick={() => void commentsQuery.refetch()}
                  >
                    {t`Retry`}
                  </StyledTextButton>
                </StyledHint>
              ) : (
                visibleComments.length === 0 && (
                  <StyledHint>{t`No activity yet.`}</StyledHint>
                )
              )}
            </StyledTimeline>
          </div>

          <StyledFooterRow>
            {confirmDelete ? (
              <>
                <StyledHint
                  style={{ marginRight: 'auto' }}
                >{t`Delete this task forever?`}</StyledHint>
                <Button
                  title={t`Cancel`}
                  size="small"
                  variant="secondary"
                  onClick={() => setConfirmDelete(false)}
                />
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
        </StyledPanelBody>
      </StyledPanel>
    </>
  );
};
