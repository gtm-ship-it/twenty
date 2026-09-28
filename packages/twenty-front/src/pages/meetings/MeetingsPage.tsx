import { useMutation, useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { Tag } from 'twenty-ui/data-display';
import {
  IconCheck,
  IconExternalLink,
  IconLanguage,
  IconListCheck,
  IconSearch,
  IconUsers,
  IconVideo,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import {
  MeetingVideoPlayer,
  type MeetingVideoPlayerHandle,
} from '@/task-pipelines/components/MeetingVideoPlayer';
import { SafeMarkdown } from '@/task-pipelines/components/SafeMarkdown';
import {
  MemberAvatar,
  MemberPicker,
  StyledSegment,
  StyledSegmented,
} from '@/task-pipelines/components/TaskPipelineUi';
import { safeHttpUrl } from '@/task-pipelines/utils/safeHttpUrl';
import {
  CREATE_TASK_FROM_ACTION_ITEM,
  GET_MEETING,
  GET_MEETINGS,
  UPDATE_PIPELINE_TASK,
} from '@/task-pipelines/graphql/taskPipelinesDocuments';
import { useTaskPipelines } from '@/task-pipelines/hooks/useTaskPipelines';
import { friendlyErrorMessage } from '@/task-pipelines/utils/friendlyErrorMessage';
import {
  type TaskMemberInfo,
  useWorkspaceMembersById,
} from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type MeetingDetail,
  type MeetingListItem,
} from '@/task-pipelines/types/TaskPipelineTypes';
import { timestampToSeconds } from '@/task-pipelines/utils/timestampToSeconds';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

const PANEL_RADIUS = `calc(${themeCssVariables.border.radius.md} + ${themeCssVariables.spacing[1]})`;
const LIVE_REFRESH_MS = 60_000;

const StyledPage = styled.div`
  background: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${PANEL_RADIUS} 0 0 ${PANEL_RADIUS};
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const StyledList = styled.div`
  border-right: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
  width: 320px;
`;

const StyledListHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledMeetingItem = styled.button<{ isActive: boolean }>`
  background: ${({ isActive }) =>
    isActive ? themeCssVariables.background.transparent.medium : 'transparent'};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  gap: 4px;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledItemTitle = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledItemMeta = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDetail = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const StyledDetailMain = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-width: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledDetailSide = styled.div`
  border-left: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  width: 380px;
`;

const StyledH1 = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledSectionTitle = styled.h2`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin: 0;
`;

const StyledMarkdown = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.6;

  h1,
  h2,
  h3 {
    font-size: ${themeCssVariables.font.size.md};
    margin: ${themeCssVariables.spacing[3]} 0 ${themeCssVariables.spacing[1]};
  }

  p {
    margin: 0 0 ${themeCssVariables.spacing[2]};
  }

  ul {
    margin: 0 0 ${themeCssVariables.spacing[2]};
    padding-left: ${themeCssVariables.spacing[5]};
  }

  a {
    color: ${themeCssVariables.color.blue};
  }
`;

const StyledActionItem = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledActionRow = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledActionText = styled.div<{ isDone: boolean }>`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  text-decoration: ${({ isDone }) => (isDone ? 'line-through' : 'none')};
`;

const StyledLinkButton = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.color.blue};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledExternalLink = styled.a`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-flex;
  gap: 4px;
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
    text-decoration: underline;
  }
`;

const StyledRouterLink = styled(Link)`
  color: ${themeCssVariables.color.blue};
  font-size: ${themeCssVariables.font.size.sm};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledTranscriptHeader = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTranscriptSearch = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: 4px;
  padding: 0 ${themeCssVariables.spacing[2]};

  input {
    background: transparent;
    border: none;
    color: ${themeCssVariables.font.color.primary};
    flex: 1;
    font-family: inherit;
    font-size: ${themeCssVariables.font.size.sm};
    outline: none;
    padding: 5px 0;
  }
`;

const StyledTranscript = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledLine = styled.button<{ isCurrent: boolean }>`
  background: ${({ isCurrent }) =>
    isCurrent ? themeCssVariables.accent.quaternary : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  gap: 2px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-align: left;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledLineMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledLineText = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;

  mark {
    background: ${themeCssVariables.tag.background.yellow};
    color: inherit;
  }
`;

const StyledEmpty = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const formatDuration = (start: string | null, end: string | null) => {
  if (!start || !end) {
    return '';
  }

  const minutes = Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000),
  );

  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
    : `${minutes} min`;
};

const highlight = (text: string, needle: string) => {
  if (!needle) {
    return text;
  }

  const index = text.toLowerCase().indexOf(needle.toLowerCase());

  if (index === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
};

const MemoMarkdown = memo(({ text }: { text: string }) => (
  <SafeMarkdown>{text}</SafeMarkdown>
));

MemoMarkdown.displayName = 'MemoMarkdown';

const MeetingDetailView = ({ meetingId }: { meetingId: string }) => {
  const client = useApolloCoreClient();
  const membersById = useWorkspaceMembersById();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  // Handle imperativo del reproductor (seekTo), no estado.
  // oxlint-disable-next-line twenty/no-state-useref
  const playerRef = useRef<MeetingVideoPlayerHandle>(null);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [currentSecond, setCurrentSecond] = useState(0);

  const { data, loading, error, refetch } = useQuery<{
    taskPipelineMeeting: MeetingDetail;
  }>(GET_MEETING, {
    client,
    variables: { meetingId },
    fetchPolicy: 'cache-and-network',
  });
  const [createTask] = useMutation(CREATE_TASK_FROM_ACTION_ITEM, { client });
  const [updateTaskMutation] = useMutation(UPDATE_PIPELINE_TASK, { client });
  const { pipelines } = useTaskPipelines();

  const membersByPipeline = useMemo(
    () =>
      new Map(
        pipelines.map((pipeline) => [
          pipeline.id,
          pipeline.members
            .map((entry) => membersById.get(entry.workspaceMemberId))
            .filter((entry): entry is TaskMemberInfo => entry !== undefined),
        ]),
      ),
    [pipelines, membersById],
  );

  const assignTask = async (taskId: string, memberId: string | null) => {
    try {
      await updateTaskMutation({
        variables: {
          taskId,
          input:
            memberId !== null
              ? { assigneeWorkspaceMemberId: memberId }
              : { clearAssignee: true },
        },
      });
      enqueueSuccessSnackBar({
        message: memberId !== null ? t`Task assigned` : t`Assignee removed`,
      });
      await refetch();
    } catch (error) {
      enqueueErrorSnackBar({ message: friendlyErrorMessage(error) });
    }
  };

  const meeting = data?.taskPipelineMeeting;

  const transcript = useMemo(
    () =>
      (meeting?.transcript ?? []).map((line, index) => ({
        ...line,
        index,
        seconds: timestampToSeconds(line.timestamp),
      })),
    [meeting?.transcript],
  );

  // Búsqueda binaria de la línea que suena ahora (las líneas vienen en orden).
  const currentLineIndex = useMemo(() => {
    let low = 0;
    let high = transcript.length - 1;
    let found = -1;

    while (low <= high) {
      const middle = (low + high) >> 1;

      if (transcript[middle].seconds <= currentSecond) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return found;
  }, [transcript, currentSecond]);

  // El video emite ~4 eventos por segundo: solo se re-renderiza al cambiar de segundo.
  const handleTimeUpdate = useCallback((seconds: number) => {
    const whole = Math.floor(seconds);

    setCurrentSecond((previous) => (previous === whole ? previous : whole));
  }, []);

  if (loading && !meeting) {
    return <StyledEmpty>{t`Loading meeting…`}</StyledEmpty>;
  }

  if (error || !meeting) {
    return <StyledEmpty>{t`This meeting is not available.`}</StyledEmpty>;
  }

  const summary =
    language === 'es' && meeting.summaryMarkdownEs
      ? meeting.summaryMarkdownEs
      : meeting.summaryMarkdown;
  const hasSpanish =
    meeting.summaryMarkdownEs !== null ||
    meeting.actionItems.some((item) => item.textEs);
  const filteredTranscript = transcriptSearch
    ? transcript.filter((line) =>
        `${line.speakerName ?? ''} ${line.text}`
          .toLowerCase()
          .includes(transcriptSearch.toLowerCase()),
      )
    : transcript;

  const seek = (timestamp: string | null) =>
    playerRef.current?.seekTo(timestampToSeconds(timestamp));

  return (
    <StyledDetail>
      <StyledDetailMain>
        <div>
          <StyledH1>{meeting.title}</StyledH1>
          <StyledItemMeta style={{ marginTop: 6 }}>
            {[
              <span key="date">{formatDate(meeting.startedAt)}</span>,
              formatDuration(meeting.startedAt, meeting.endedAt) !== '' ? (
                <span key="duration">
                  {formatDuration(meeting.startedAt, meeting.endedAt)}
                </span>
              ) : null,
              meeting.recordedByName !== null ? (
                <span key="recorded">{t`recorded by ${meeting.recordedByName}`}</span>
              ) : null,
              safeHttpUrl(meeting.shareUrl) !== undefined ? (
                <StyledExternalLink
                  key="fathom"
                  href={safeHttpUrl(meeting.shareUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconExternalLink size={12} />
                  {t`Open in Fathom`}
                </StyledExternalLink>
              ) : null,
            ]
              .filter((entry) => entry !== null)
              .map((entry, index) => (
                <span
                  key={index}
                  style={{
                    display: 'inline-flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  {index > 0 && <span aria-hidden="true">·</span>}
                  {entry}
                </span>
              ))}
          </StyledItemMeta>
        </div>

        <MeetingVideoPlayer
          ref={playerRef}
          sourceKey={meeting.id}
          src={meeting.videoUrl}
          fallbackUrl={meeting.shareUrl}
          onTimeUpdate={handleTimeUpdate}
        />

        {meeting.participants.length > 0 && (
          <StyledItemMeta>
            <IconUsers size={14} />
            {meeting.participants
              .map((participant) => participant.name ?? participant.email)
              .filter(Boolean)
              .join(' · ')}
          </StyledItemMeta>
        )}

        <div>
          <StyledSectionTitle>
            <span
              style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
            >
              <IconListCheck size={16} />
              {t`Action items`} ({meeting.actionItems.length})
            </span>
            {hasSpanish && (
              <span
                style={{
                  display: 'inline-flex',
                  gap: 8,
                  alignItems: 'center',
                  fontWeight: 400,
                  fontSize: 13,
                }}
              >
                {t`Summary & action items in`}
                <StyledSegmented>
                  <StyledSegment
                    type="button"
                    isActive={language === 'es'}
                    onClick={() => setLanguage('es')}
                  >
                    <IconLanguage size={12} />
                    ES
                  </StyledSegment>
                  <StyledSegment
                    type="button"
                    isActive={language === 'en'}
                    onClick={() => setLanguage('en')}
                  >
                    EN
                  </StyledSegment>
                </StyledSegmented>
              </span>
            )}
          </StyledSectionTitle>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 10,
            }}
          >
            {meeting.actionItems.length === 0 && (
              <StyledItemMeta>{t`Fathom did not detect action items.`}</StyledItemMeta>
            )}
            {meeting.actionItems.map((item) => {
              const member = item.resolvedWorkspaceMemberId
                ? membersById.get(item.resolvedWorkspaceMemberId)
                : undefined;

              return (
                <StyledActionItem key={item.id}>
                  <StyledActionText isDone={item.taskIsDone || item.completed}>
                    {language === 'es'
                      ? (item.textEs ?? item.textEn)
                      : item.textEn}
                  </StyledActionText>
                  <StyledActionRow>
                    {item.taskId !== null ? (
                      <div style={{ minWidth: 180 }}>
                        <MemberPicker
                          members={membersByPipeline.get(item.pipelineId) ?? []}
                          value={item.resolvedWorkspaceMemberId}
                          placeholder={t`Needs assignee — pick someone`}
                          onChange={(memberId) =>
                            void assignTask(item.taskId as string, memberId)
                          }
                        />
                      </div>
                    ) : member !== undefined ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          gap: 4,
                          alignItems: 'center',
                        }}
                      >
                        <MemberAvatar member={member} size="xs" />
                        {member.fullName}
                      </span>
                    ) : (
                      <Tag color="orange" text={t`Needs assignee`} />
                    )}
                    {item.assigneeName && !member && (
                      <span>· {t`Fathom said: ${item.assigneeName}`}</span>
                    )}
                    <span>· {item.pipelineName}</span>
                    {item.recordingTimestamp && (
                      <StyledLinkButton
                        type="button"
                        onClick={() => seek(item.recordingTimestamp)}
                      >
                        ▶ {item.recordingTimestamp}
                      </StyledLinkButton>
                    )}
                    {item.taskIsDone && (
                      <span
                        style={{
                          display: 'inline-flex',
                          gap: 2,
                          alignItems: 'center',
                          color: 'inherit',
                        }}
                      >
                        <IconCheck size={12} />
                        {t`Done`}
                      </span>
                    )}
                    {item.taskId ? (
                      <StyledRouterLink
                        to={`${AppPath.TaskPipelinesPage}?pipeline=${item.pipelineId}&task=${item.taskId}`}
                      >
                        {t`Open task`}
                      </StyledRouterLink>
                    ) : (
                      <Button
                        title={t`Create task`}
                        size="small"
                        variant="secondary"
                        onClick={() =>
                          void createTask({
                            variables: { actionItemId: item.id },
                          })
                            .then(async () => {
                              enqueueSuccessSnackBar({
                                message: t`Task created`,
                              });
                              await refetch();
                            })
                            .catch((creationError: Error) =>
                              enqueueErrorSnackBar({
                                message: creationError.message,
                              }),
                            )
                        }
                      />
                    )}
                  </StyledActionRow>
                </StyledActionItem>
              );
            })}
          </div>
        </div>

        {summary && (
          <div>
            <StyledSectionTitle>{t`Summary`}</StyledSectionTitle>
            <StyledMarkdown>
              <MemoMarkdown text={summary} />
            </StyledMarkdown>
          </div>
        )}
      </StyledDetailMain>

      <StyledDetailSide>
        <StyledTranscriptHeader>
          <StyledSectionTitle>{t`Transcript`}</StyledSectionTitle>
          <StyledTranscriptSearch>
            <IconSearch size={14} />
            <input
              aria-label={t`Search the transcript`}
              placeholder={t`Search the transcript`}
              value={transcriptSearch}
              onChange={(event) => setTranscriptSearch(event.target.value)}
            />
          </StyledTranscriptSearch>
        </StyledTranscriptHeader>
        <StyledTranscript>
          {filteredTranscript.length === 0 && (
            <StyledEmpty>
              {transcriptSearch.length > 0
                ? t`No lines match “${transcriptSearch}”.`
                : t`Fathom sent no transcript for this meeting.`}
            </StyledEmpty>
          )}
          {filteredTranscript.map((line) => {
            const index = line.index;

            return (
              <StyledLine
                key={`${line.timestamp}-${index}`}
                type="button"
                isCurrent={index === currentLineIndex}
                onClick={() => seek(line.timestamp)}
              >
                <StyledLineMeta>
                  {line.timestamp} · {line.speakerName ?? t`Speaker`}
                </StyledLineMeta>
                <StyledLineText>
                  {highlight(line.text, transcriptSearch)}
                </StyledLineText>
              </StyledLine>
            );
          })}
        </StyledTranscript>
      </StyledDetailSide>
    </StyledDetail>
  );
};

export const MeetingsPage = () => {
  const client = useApolloCoreClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('meeting');

  const { data, loading } = useQuery<{
    taskPipelineMeetings: MeetingListItem[];
  }>(GET_MEETINGS, {
    client,
    fetchPolicy: 'cache-and-network',
    pollInterval: LIVE_REFRESH_MS,
  });

  const meetings = useMemo(() => data?.taskPipelineMeetings ?? [], [data]);
  const firstMeetingId = meetings[0]?.id ?? null;

  useEffect(() => {
    if (selectedId === null && firstMeetingId !== null) {
      setSearchParams({ meeting: firstMeetingId }, { replace: true });
    }
  }, [selectedId, firstMeetingId, setSearchParams]);

  return (
    <StyledPage>
      <StyledList>
        <StyledListHeader>
          <IconVideo size={16} />
          {t`Meetings`}
        </StyledListHeader>
        {loading && meetings.length === 0 && (
          <StyledEmpty>{t`Loading…`}</StyledEmpty>
        )}
        {!loading && meetings.length === 0 && (
          <StyledEmpty>
            <div>{t`No meetings yet. Connect Fathom in a task pipeline's settings and your recorded meetings will appear here.`}</div>
            <StyledRouterLink
              to={AppPath.TaskPipelinesPage}
            >{t`Go to Tasks`}</StyledRouterLink>
          </StyledEmpty>
        )}
        {meetings.map((meeting) => (
          <StyledMeetingItem
            key={meeting.id}
            type="button"
            isActive={meeting.id === selectedId}
            onClick={() => setSearchParams({ meeting: meeting.id })}
          >
            <StyledItemTitle>{meeting.title}</StyledItemTitle>
            <StyledItemMeta>
              <span>{formatDate(meeting.startedAt)}</span>
              {formatDuration(meeting.startedAt, meeting.endedAt) && (
                <span>
                  · {formatDuration(meeting.startedAt, meeting.endedAt)}
                </span>
              )}
            </StyledItemMeta>
            <StyledItemMeta>
              <span>
                <IconListCheck size={12} /> {meeting.actionItemCount}
              </span>
              <span>
                <IconUsers size={12} /> {meeting.participantCount}
              </span>
              {meeting.pipelineNames.map((name) => (
                <Tag key={name} color="gray" text={name} />
              ))}
            </StyledItemMeta>
          </StyledMeetingItem>
        ))}
      </StyledList>
      {selectedId ? (
        <MeetingDetailView key={selectedId} meetingId={selectedId} />
      ) : (
        !loading &&
        meetings.length > 0 && <StyledEmpty>{t`Pick a meeting.`}</StyledEmpty>
      )}
    </StyledPage>
  );
};
