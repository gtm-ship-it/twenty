import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import {
  MemberPicker,
  PRIORITY_META,
  StyledErrorText,
  StyledFieldLabel,
  StyledHint,
  StyledSelect,
  StyledTextArea,
  StyledTextInput,
  TaskModal,
} from '@/task-pipelines/components/TaskPipelineUi';
import { usePipelineTasks } from '@/task-pipelines/hooks/usePipelineTasks';
import { useTaskPipelines } from '@/task-pipelines/hooks/useTaskPipelines';
import {
  type TaskMemberInfo,
  useWorkspaceMembersById,
} from '@/task-pipelines/hooks/useWorkspaceMembersById';
import { type TaskPriority } from '@/task-pipelines/types/TaskPipelineTypes';
import { dueFromInputValue } from '@/task-pipelines/utils/taskDueStatus';
import { friendlyErrorMessage } from '@/task-pipelines/utils/friendlyErrorMessage';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { type TimelineThread } from '~/generated/graphql';

const LAST_PIPELINE_KEY = 'ptsai.tasks.lastEmailPipeline';

export const buildEmailTaskBody = (
  thread: TimelineThread,
  ownHandle: string,
): string => {
  const participants = [
    thread.firstParticipant,
    ...(thread.lastTwoParticipants ?? []),
  ].filter(
    (participant) =>
      isDefined(participant) &&
      participant.handle?.toLowerCase() !== ownHandle.toLowerCase(),
  );
  const contact = participants[0] ?? thread.firstParticipant;
  const who = [
    contact?.displayName,
    contact?.handle ? `<${contact.handle}>` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const when = thread.lastMessageReceivedAt
    ? new Date(thread.lastMessageReceivedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const excerpt = (thread.lastMessageBody ?? '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, 1500);

  return [
    `**Email:** ${thread.subject || '(no subject)'}`,
    `**From:** ${who}${when ? ` · ${when}` : ''}`,
    excerpt ? `\n> ${excerpt.split('\n').join('\n> ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

export const CreateTaskFromEmailModal = ({
  thread,
  ownHandle,
  onClose,
}: {
  thread: TimelineThread;
  ownHandle: string;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { enqueueSuccessSnackBar } = useSnackBar();
  const { pipelines, isLoading } = useTaskPipelines();
  const membersById = useWorkspaceMembersById();
  const currentMemberId =
    useAtomStateValue(currentWorkspaceMemberState)?.id ?? null;

  const [pipelineId, setPipelineId] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_PIPELINE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const pipeline =
    pipelines.find((entry) => entry.id === pipelineId) ?? pipelines[0] ?? null;

  const [title, setTitle] = useState(
    thread.subject?.trim() || t`Follow up on email`,
  );
  const [body, setBody] = useState(() => buildEmailTaskBody(thread, ownHandle));
  const [stageId, setStageId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { createTask } = usePipelineTasks(null, 'pipeline');

  const members = useMemo(
    () =>
      (pipeline?.members ?? [])
        .map((member) => membersById.get(member.workspaceMemberId))
        .filter((member): member is TaskMemberInfo => member !== undefined),
    [pipeline, membersById],
  );

  // Al cambiar de tablero: primer stage y yo como asignado si soy miembro.
  useEffect(() => {
    if (pipeline === null) {
      return;
    }

    setStageId(pipeline.stages[0]?.id ?? '');
    setAssigneeId(
      members.some((member) => member.id === currentMemberId)
        ? currentMemberId
        : null,
    );
  }, [pipeline?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const personParticipant = [
    thread.firstParticipant,
    ...(thread.lastTwoParticipants ?? []),
  ].find(
    (participant) =>
      participant?.personId &&
      participant.handle?.toLowerCase() !== ownHandle.toLowerCase(),
  );

  const submit = async () => {
    if (pipeline === null) {
      return;
    }

    if (title.trim().length === 0) {
      setError(t`Write a title`);

      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const created = await createTask({
        pipelineId: pipeline.id,
        stageId: stageId || null,
        title: title.trim(),
        body,
        assigneeWorkspaceMemberId: assigneeId,
        dueAt: dueFromInputValue(due),
        priority: priority || null,
        source: 'EMAIL',
        relatedRecords: personParticipant?.personId
          ? [
              {
                objectNameSingular: 'person',
                recordId: personParticipant.personId,
                label:
                  personParticipant.displayName || personParticipant.handle,
              },
            ]
          : null,
      });

      try {
        localStorage.setItem(LAST_PIPELINE_KEY, pipeline.id);
      } catch {
        // sin almacenamiento: solo se pierde el recordatorio del último tablero
      }

      enqueueSuccessSnackBar({ message: t`Task created in ${pipeline.name}` });
      onClose();

      if (created) {
        navigate(
          `${AppPath.TaskPipelinesPage}?pipeline=${pipeline.id}&task=${created.id}`,
        );
      }
    } catch (creationError) {
      setError(
        friendlyErrorMessage(creationError, t`Could not create the task`),
      );
      setIsSaving(false);
    }
  };

  return (
    <TaskModal
      title={t`Create task from email`}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button
            title={t`Create task`}
            accent="blue"
            disabled={isSaving || pipeline === null}
            onClick={() => void submit()}
          />
        </>
      }
    >
      {!isLoading && pipelines.length === 0 ? (
        <StyledHint>
          {t`You are not in any task pipeline yet. Create one in Tasks first.`}{' '}
          <a href={AppPath.TaskPipelinesPage}>{t`Go to Tasks`}</a>
        </StyledHint>
      ) : (
        <>
          <div>
            <StyledFieldLabel>{t`Pipeline`}</StyledFieldLabel>
            <StyledSelect
              style={{ width: '100%' }}
              value={pipeline?.id ?? ''}
              onChange={(event) => setPipelineId(event.target.value)}
            >
              {pipelines.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                  {entry.visibility === 'PERSONAL' ? ` (${t`personal`})` : ''}
                </option>
              ))}
            </StyledSelect>
          </div>
          <div>
            <StyledFieldLabel>{t`Title`}</StyledFieldLabel>
            <StyledTextInput
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <StyledFieldLabel>{t`Stage`}</StyledFieldLabel>
              <StyledSelect
                style={{ width: '100%' }}
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
              >
                {(pipeline?.stages ?? []).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </StyledSelect>
            </div>
            <div>
              <StyledFieldLabel>{t`Assignee`}</StyledFieldLabel>
              <MemberPicker
                members={members}
                value={assigneeId}
                onChange={setAssigneeId}
              />
            </div>
            <div>
              <StyledFieldLabel>{t`Due date`}</StyledFieldLabel>
              <StyledTextInput
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
              />
            </div>
            <div>
              <StyledFieldLabel>{t`Priority`}</StyledFieldLabel>
              <StyledSelect
                style={{ width: '100%' }}
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TaskPriority | '')
                }
              >
                <option value="">{t`No priority`}</option>
                {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map(
                  (entry) => (
                    <option key={entry} value={entry}>
                      {PRIORITY_META[entry].label()}
                    </option>
                  ),
                )}
              </StyledSelect>
            </div>
          </div>
          <div>
            <StyledFieldLabel>{t`Description`}</StyledFieldLabel>
            <StyledTextArea
              rows={7}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          {personParticipant && (
            <StyledHint>{t`Linked to ${personParticipant.displayName || personParticipant.handle} in the CRM.`}</StyledHint>
          )}
        </>
      )}
      {error && <StyledErrorText>{error}</StyledErrorText>}
    </TaskModal>
  );
};
