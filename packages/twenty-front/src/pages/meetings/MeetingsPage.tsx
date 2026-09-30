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
  IconSparkles,
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
  StyledSegment,
  StyledSegmented,
} from '@/task-pipelines/components/TaskPipelineUi';
import { safeHttpUrl } from '@/task-pipelines/utils/safeHttpUrl';
import {
  CREATE_TASK_FROM_ACTION_ITEM,
  GENERATE_MEETING_ACTION_POINTS,
  GET_MEETING,
  GET_MEETINGS,
} from '@/task-pipelines/graphql/taskPipelinesDocuments';
import { friendlyErrorMessage } from '@/task-pipelines/utils/friendlyErrorMessage';
import { useWorkspaceMembersById } from '@/task-pipelines/hooks/useWorkspaceMembersById';
import {
  type MeetingActionPointsState,
  type MeetingDetail,
  type MeetingListItem,
} from '@/task-pipelines/types/TaskPipelineTypes';
import { timestampToSeconds } from '@/task-pipelines/utils/timestampToSeconds';
import { useTypingHotkeyGuard } from '@/task-pipelines/hooks/useTypingHotkeyGuard';
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

const StyledPointsBox = styled.div<{
  tone: 'info' | 'busy' | 'done' | 'error';
}>`
  align-items: center;
  background: ${({ tone }) =>
    tone === 'error'
      ? themeCssVariables.tag.background.red
      : tone === 'done'
        ? themeCssVariables.background.secondary
        : themeCssVariables.tag.background.blue};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledPulse = styled.span`
  animation: ap-pulse 1.2s ease-in-out infinite;
  display: inline-flex;

  @keyframes ap-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }
`;

const isBusy = (state: MeetingActionPointsState) =>
  state.status === 'PENDING' || state.status === 'GENERATING';

// Estado de los action points de la reunión en un tablero + el botón.
const ActionPointsState = ({
  state,
  showPipelineName,
  isRequesting,
  onGenerate,
}: {
  state: MeetingActionPointsState;
  showPipelineName: boolean;
  isRequesting: boolean;
  onGenerate: () => void;
}) => {
  const where = showPipelineName ? ` · ${state.pipelineName}` : '';
  const boardLink = `${AppPath.TaskPipelinesPage}?pipeline=${state.pipelineId}`;

  if (isBusy(state)) {
    return (
      <StyledPointsBox tone="busy">
        <StyledPulse>
          <IconSparkles size={16} />
        </StyledPulse>
        {t`The AI is pulling the action points out of this meeting… it can take a few minutes, you can leave this page`}
        {where}
      </StyledPointsBox>
    );
  }

  if (state.status === 'DONE') {
    const count = state.taskIds.length;
    const finished = state.finishedAt
      ? new Date(state.finishedAt).toLocaleString(undefined, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <StyledPointsBox tone="done">
        <IconCheck size={16} />
        {count === 1
          ? t`1 card created ${finished}`
          : t`${count} cards created ${finished}`}
        {state.engine === 'AI'
          ? ` · ${t`by the local AI`}`
          : ` · ${t`from the summary's next steps`}`}
        {where}
        <StyledRouterLink to={boardLink}>{t`See the board`}</StyledRouterLink>
      </StyledPointsBox>
    );
  }

  return (
    <StyledPointsBox tone={state.status === 'FAILED' ? 'error' : 'info'}>
      <IconSparkles size={16} />
      <span style={{ flex: 1, minWidth: 200 }}>
        {state.status === 'FAILED'
          ? t`Could not generate the action points: ${state.error ?? ''}`
          : t`No action points yet. Generate them once and they become cards in the board, each with its owner.`}
        {where}
      </span>
      <Button
        title={
          isRequesting
            ? t`Sending…`
            : state.status === 'FAILED'
              ? t`Try again`
              : t`Generate action points`
        }
        size="small"
        accent="blue"
        Icon={IconSparkles}
        disabled={isRequesting}
        onClick={onGenerate}
      />
    </StyledPointsBox>
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
  const [generateMutation] = useMutation(GENERATE_MEETING_ACTION_POINTS, {
    client,
  });
  const [requestingPipelineId, setRequestingPipelineId] = useState<
    string | null
  >(null);

  const meeting = data?.taskPipelineMeeting;
  const anyBusy = (meeting?.actionPoints ?? []).some(isBusy);

  // Mientras la IA trabaja, se consulta cada 4 s hasta que termine.
  useEffect(() => {
    if (!anyBusy) {
      return;
    }

    const timer = window.setInterval(() => void refetch(), 4000);

    return () => window.clearInterval(timer);
  }, [anyBusy, refetch]);

  const generate = async (pipelineId: string) => {
    setRequestingPipelineId(pipelineId);

    try {
      await generateMutation({ variables: { meetingId, pipelineId } });
      await refetch();
    } catch (generationError) {
      enqueueErrorSnackBar({ message: friendlyErrorMessage(generationError) });
    } finally {
      setRequestingPipelineId(null);
    }
  };

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
              {t`Action points`} ({meeting.actionItems.length})
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
            {meeting.actionPoints.map((state) => (
              <ActionPointsState
                key={state.pipelineId}
                state={state}
                showPipelineName={meeting.actionPoints.length > 1}
                isRequesting={requestingPipelineId === state.pipelineId}
                onGenerate={() => void generate(state.pipelineId)}
              />
            ))}
            {meeting.actionItems.length === 0 &&
              meeting.actionPoints.some((state) => state.status === 'DONE') && (
                <StyledItemMeta>{t`No action points were found in this meeting.`}</StyledItemMeta>
              )}
            {meeting.actionItems.map((item) => {
              const member = item.resolvedWorkspaceMemberId
                ? membersById.get(item.resolvedWorkspaceMemberId)
                : undefined;

              return (
                <StyledActionItem key={item.id}>
                  <StyledActionText
                    isDone={
                      item.pointIsDone || item.taskIsDone || item.completed
                    }
                  >
                    {language === 'es'
                      ? (item.textEs ?? item.textEn)
                      : item.textEn}
                  </StyledActionText>
                  <StyledActionRow>
                    {member !== undefined ? (
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
                    <span>· {item.pipelineName}</span>
                    {item.recordingTimestamp && (
                      <StyledLinkButton
                        type="button"
                        onClick={() => seek(item.recordingTimestamp)}
                      >
                        ▶ {item.recordingTimestamp}
                      </StyledLinkButton>
                    )}
                    {(item.pointIsDone || item.taskIsDone) && (
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
                        {t`Open card`}
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
  const typingGuard = useTypingHotkeyGuard();
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
    <StyledPage onFocus={typingGuard.onFocus} onBlur={typingGuard.onBlur}>
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
              <span
                title={
                  meeting.actionPointsStatus === 'DONE'
                    ? t`Action points generated`
                    : meeting.actionPointsStatus === 'GENERATING'
                      ? t`Generating action points…`
                      : t`Action points not generated yet`
                }
              >
                {meeting.actionPointsStatus === 'GENERATING' ? (
                  <StyledPulse>
                    <IconSparkles size={12} />
                  </StyledPulse>
                ) : (
                  <IconListCheck size={12} />
                )}{' '}
                {meeting.actionPointsStatus === 'DONE'
                  ? meeting.actionItemCount
                  : meeting.actionPointsStatus === 'GENERATING'
                    ? '…'
                    : '—'}
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
