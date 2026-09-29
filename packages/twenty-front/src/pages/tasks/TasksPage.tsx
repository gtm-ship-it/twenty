import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import {
  IconArchive,
  IconChevronDown,
  IconLayoutKanban,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconList,
  IconLock,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUser,
  IconUsers,
} from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { ArchivedTasksModal } from '@/task-pipelines/components/ArchivedTasksModal';
import { CreateTaskPipelineModal } from '@/task-pipelines/components/CreateTaskPipelineModal';
import { getLabelColor } from '@/task-pipelines/components/TaskCard';
import { TaskBoard } from '@/task-pipelines/components/TaskBoard';
import { TaskDetailPanel } from '@/task-pipelines/components/TaskDetailPanel';
import { TaskListView } from '@/task-pipelines/components/TaskListView';
import { TaskPipelineSettingsModal } from '@/task-pipelines/components/TaskPipelineSettingsModal';
import {
  MemberAvatar,
  MemberPicker,
  PRIORITY_META,
  StyledColorDot,
  StyledErrorText,
  StyledFieldLabel,
  StyledSegment,
  StyledSegmented,
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
import {
  type TaskPipeline,
  type TaskPriority,
} from '@/task-pipelines/types/TaskPipelineTypes';
import {
  type TaskAssigneeFilter,
  filterPipelineTasks,
} from '@/task-pipelines/utils/filterPipelineTasks';
import { dueFromInputValue } from '@/task-pipelines/utils/taskDueStatus';
import { friendlyErrorMessage } from '@/task-pipelines/utils/friendlyErrorMessage';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const PANEL_RADIUS = `calc(${themeCssVariables.border.radius.md} + ${themeCssVariables.spacing[1]})`;
const MY_TASKS = 'mine';

const StyledPage = styled.div`
  background: ${themeCssVariables.background.primary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${PANEL_RADIUS} 0 0 ${PANEL_RADIUS};
  display: flex;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const StyledSidebar = styled.nav`
  border-right: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[4]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
  width: 208px;
`;

const StyledCollapsedRail = styled.div`
  border-right: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
`;

const StyledFilterNotice = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const StyledTextButton = styled.button`
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

const StyledSidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledSectionTitle = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  letter-spacing: 0.04em;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-transform: uppercase;
`;

const StyledNavItem = styled.button<{ isActive: boolean }>`
  align-items: center;
  background: ${({ isActive }) =>
    isActive ? themeCssVariables.background.transparent.medium : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[2]};
  padding: 6px ${themeCssVariables.spacing[2]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledNavName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledNavCount = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledMain = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};

  & > * {
    flex-shrink: 0;
  }
`;

const StyledTitle = styled.h1`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex: 1 1 auto;
  flex-shrink: 1 !important;
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[2]};
  margin: 0;
  min-width: 80px;
  overflow: visible;
`;

const StyledAvatars = styled.div`
  display: flex;

  & > * {
    margin-left: -6px;
  }
`;

const StyledSearch = styled.div`
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
    font-family: inherit;
    font-size: ${themeCssVariables.font.size.sm};
    outline: none;
    padding: 5px 0;
    width: 130px;
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

const StyledFormGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: 1fr 1fr;
`;

const StyledSwitcherButton = styled.button`
  align-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  gap: ${themeCssVariables.spacing[2]};
  max-width: 100%;
  min-width: 0;
  padding: 2px ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledSwitcherName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledSwitcherMenu = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  left: 0;
  max-height: 60vh;
  min-width: 260px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[1]};
  position: absolute;
  top: calc(100% + 6px);
  z-index: 50;
`;

const StyledSwitcherSection = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  letter-spacing: 0.04em;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]} 2px;
  text-transform: uppercase;
`;

const StyledRailDot = styled.button<{ isActive: boolean }>`
  align-items: center;
  background: ${({ isActive }) =>
    isActive ? themeCssVariables.background.transparent.medium : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  display: flex;
  height: 28px;
  justify-content: center;
  width: 28px;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

// El nombre del tablero es también el selector: siempre se puede cambiar de
// tablero desde aquí, aunque la columna lateral esté plegada.
const PipelineSwitcher = ({
  pipelines,
  selectedKey,
  onSelect,
  onCreate,
  children,
}: {
  pipelines: TaskPipeline[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onCreate: () => void;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node) !== true) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const pick = (key: string) => {
    setIsOpen(false);
    onSelect(key);
  };

  const shared = pipelines.filter(
    (pipeline) => pipeline.visibility === 'WORKSPACE',
  );
  const personal = pipelines.filter(
    (pipeline) => pipeline.visibility === 'PERSONAL',
  );

  const renderOption = (pipeline: TaskPipeline) => (
    <StyledNavItem
      key={pipeline.id}
      type="button"
      role="option"
      aria-selected={pipeline.id === selectedKey}
      isActive={pipeline.id === selectedKey}
      onClick={() => pick(pipeline.id)}
    >
      {pipeline.visibility === 'PERSONAL' ? (
        <IconLock size={14} />
      ) : (
        <IconUsers size={14} />
      )}
      <StyledNavName>{pipeline.name}</StyledNavName>
      <StyledNavCount>
        {pipeline.openTaskCount > 0 ? pipeline.openTaskCount : ''}
      </StyledNavCount>
    </StyledNavItem>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 0 }}>
      <StyledSwitcherButton
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={t`Switch pipeline`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {children}
        <IconChevronDown size={16} />
      </StyledSwitcherButton>
      {isOpen && (
        <StyledSwitcherMenu role="listbox" aria-label={t`Switch pipeline`}>
          <StyledNavItem
            type="button"
            role="option"
            aria-selected={selectedKey === MY_TASKS}
            isActive={selectedKey === MY_TASKS}
            onClick={() => pick(MY_TASKS)}
          >
            <IconUser size={14} />
            <StyledNavName>{t`My tasks`}</StyledNavName>
          </StyledNavItem>
          {shared.length > 0 && (
            <StyledSwitcherSection>{t`Shared`}</StyledSwitcherSection>
          )}
          {shared.map(renderOption)}
          {personal.length > 0 && (
            <StyledSwitcherSection>{t`Personal`}</StyledSwitcherSection>
          )}
          {personal.map(renderOption)}
          <div style={{ padding: 6 }}>
            <Button
              title={t`New pipeline`}
              Icon={IconPlus}
              size="small"
              variant="secondary"
              onClick={() => {
                setIsOpen(false);
                onCreate();
              }}
            />
          </div>
        </StyledSwitcherMenu>
      )}
    </div>
  );
};

const NewTaskModal = ({
  pipeline,
  members,
  defaultAssigneeId,
  onCreate,
  onClose,
}: {
  pipeline: TaskPipeline;
  members: TaskMemberInfo[];
  defaultAssigneeId: string | null;
  onCreate: (input: {
    title: string;
    body: string;
    stageId: string;
    assigneeWorkspaceMemberId: string | null;
    dueAt: string | null;
    priority: TaskPriority | null;
  }) => Promise<void>;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [stageId, setStageId] = useState(pipeline.stages[0]?.id ?? '');
  const [assigneeId, setAssigneeId] = useState<string | null>(
    defaultAssigneeId,
  );
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (title.trim().length === 0) {
      setError(t`Write a title`);

      return;
    }

    setIsSaving(true);

    try {
      await onCreate({
        title: title.trim(),
        body,
        stageId,
        assigneeWorkspaceMemberId: assigneeId,
        dueAt: dueFromInputValue(due),
        priority: priority || null,
      });
    } catch (creationError) {
      setError(
        friendlyErrorMessage(creationError, t`Could not create the task`),
      );
      setIsSaving(false);
    }
  };

  return (
    <TaskModal
      title={t`New task in ${pipeline.name}`}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button
            title={t`Create task`}
            accent="blue"
            disabled={isSaving}
            onClick={() => void submit()}
          />
        </>
      }
    >
      <div>
        <StyledFieldLabel htmlFor="new-task-title">{t`Title`}</StyledFieldLabel>
        <StyledTextInput
          id="new-task-title"
          autoFocus
          value={title}
          placeholder={t`What needs to be done?`}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void submit();
            }
          }}
        />
      </div>
      <StyledFormGrid>
        <div>
          <StyledFieldLabel htmlFor="new-task-stage">{t`Stage`}</StyledFieldLabel>
          <StyledSelect
            id="new-task-stage"
            style={{ width: '100%' }}
            value={stageId}
            onChange={(event) => setStageId(event.target.value)}
          >
            {pipeline.stages.map((stage) => (
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
          <StyledFieldLabel htmlFor="new-task-due">{t`Due date`}</StyledFieldLabel>
          <StyledTextInput
            id="new-task-due"
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </div>
        <div>
          <StyledFieldLabel htmlFor="new-task-priority">{t`Priority`}</StyledFieldLabel>
          <StyledSelect
            id="new-task-priority"
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
      </StyledFormGrid>
      <div>
        <StyledFieldLabel htmlFor="new-task-body">{t`Description`}</StyledFieldLabel>
        <StyledTextArea
          id="new-task-body"
          rows={5}
          value={body}
          placeholder={t`Optional · Markdown supported`}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>
      {error && <StyledErrorText>{error}</StyledErrorText>}
    </TaskModal>
  );
};

export const TasksPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const api = useTaskPipelines();
  const membersById = useWorkspaceMembersById();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const currentMemberId = currentWorkspaceMember?.id ?? null;

  const selectedKey = searchParams.get('pipeline');
  const openTaskId = searchParams.get('task');

  const [view, setView] = useState<'board' | 'list'>(() => {
    try {
      return (
        (localStorage.getItem('ptsai.tasks.view') as 'board' | 'list') ??
        'board'
      );
    } catch {
      return 'board';
    }
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ptsai.tasks.sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] =
    useState<TaskAssigneeFilter>('all');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const pipelines = api.pipelines;
  const shared = pipelines.filter(
    (pipeline) => pipeline.visibility === 'WORKSPACE',
  );
  const personal = pipelines.filter(
    (pipeline) => pipeline.visibility === 'PERSONAL',
  );
  const isMine = selectedKey === MY_TASKS;
  const selectedPipeline = isMine
    ? null
    : (pipelines.find((pipeline) => pipeline.id === selectedKey) ?? null);

  // Sin selección (o selección inválida) se abre el primer tablero.
  useEffect(() => {
    if (api.isLoading || pipelines.length === 0) {
      return;
    }

    if (!selectedKey || (!isMine && !selectedPipeline)) {
      const next = new URLSearchParams(searchParams);

      next.set('pipeline', pipelines[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [
    api.isLoading,
    pipelines,
    selectedKey,
    isMine,
    selectedPipeline,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'ptsai.tasks.sidebarCollapsed',
        isSidebarCollapsed ? '1' : '0',
      );
    } catch {
      // sin almacenamiento: solo se pierde la preferencia
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('ptsai.tasks.view', view);
    } catch {
      // almacenamiento no disponible: solo se pierde la preferencia
    }
  }, [view]);

  useEffect(() => {
    setAssigneeFilter('all');
    setLabelFilter(null);
    setSearch('');
  }, [selectedKey]);

  const tasksApi = usePipelineTasks(
    isMine ? null : (selectedPipeline?.id ?? null),
    isMine ? 'mine' : 'pipeline',
  );

  const pipelineMembers = useMemo(
    () =>
      (selectedPipeline?.members ?? [])
        .map((member) => membersById.get(member.workspaceMemberId))
        .filter((member): member is TaskMemberInfo => member !== undefined),
    [selectedPipeline, membersById],
  );

  const allWorkspaceMembers = useMemo(
    () => [...membersById.values()],
    [membersById],
  );

  const stagesById = useMemo(
    () =>
      new Map(
        pipelines.flatMap((pipeline) =>
          pipeline.stages.map((stage) => [stage.id, stage] as const),
        ),
      ),
    [pipelines],
  );

  const visibleTasks = filterPipelineTasks(tasksApi.tasks, {
    search,
    assignee: assigneeFilter,
    label: labelFilter,
    currentWorkspaceMemberId: currentMemberId,
  });

  const openTask =
    tasksApi.tasks.find((task) => task.id === openTaskId) ?? null;
  const openTaskPipeline = openTask
    ? (pipelines.find((pipeline) => pipeline.id === openTask.pipelineId) ??
      null)
    : null;

  const selectPipeline = (key: string) => {
    const next = new URLSearchParams();

    next.set('pipeline', key);
    setSearchParams(next);
  };

  const setOpenTask = (taskId: string | null) => {
    const next = new URLSearchParams(searchParams);

    if (taskId) {
      next.set('task', taskId);
    } else {
      next.delete('task');
    }

    setSearchParams(next);
  };

  const guard = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      enqueueErrorSnackBar({
        message: friendlyErrorMessage(error, t`Something went wrong`),
      });
    }
  };

  const renderNavItem = (pipeline: TaskPipeline) => (
    <StyledNavItem
      key={pipeline.id}
      type="button"
      isActive={selectedPipeline?.id === pipeline.id}
      onClick={() => selectPipeline(pipeline.id)}
    >
      <StyledColorDot
        color={
          themeCssVariables.tag.text[
            pipeline.color as keyof typeof themeCssVariables.tag.text
          ] ?? pipeline.color
        }
      />
      <StyledNavName>{pipeline.name}</StyledNavName>
      <StyledNavCount>{pipeline.openTaskCount || ''}</StyledNavCount>
    </StyledNavItem>
  );

  const labelColors = getLabelColor(selectedPipeline?.labels ?? []);

  return (
    <StyledPage>
      {isSidebarCollapsed ? (
        <StyledCollapsedRail>
          <IconButton
            Icon={IconLayoutSidebarLeftExpand}
            size="small"
            variant="tertiary"
            ariaLabel={t`Show pipelines`}
            onClick={() => setIsSidebarCollapsed(false)}
          />
          <StyledRailDot
            type="button"
            isActive={isMine}
            title={t`My tasks`}
            aria-label={t`My tasks`}
            onClick={() => selectPipeline(MY_TASKS)}
          >
            <IconUser size={14} />
          </StyledRailDot>
          {pipelines.map((pipeline) => (
            <StyledRailDot
              key={pipeline.id}
              type="button"
              isActive={selectedPipeline?.id === pipeline.id}
              title={pipeline.name}
              aria-label={pipeline.name}
              onClick={() => selectPipeline(pipeline.id)}
            >
              <StyledColorDot
                color={
                  themeCssVariables.tag.text[
                    pipeline.color as keyof typeof themeCssVariables.tag.text
                  ] ?? pipeline.color
                }
              />
            </StyledRailDot>
          ))}
        </StyledCollapsedRail>
      ) : (
        <StyledSidebar aria-label={t`Task pipelines`}>
          <StyledSidebarSection
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <StyledNavItem
                type="button"
                isActive={isMine}
                onClick={() => selectPipeline(MY_TASKS)}
              >
                <IconUser size={16} />
                <StyledNavName>{t`My tasks`}</StyledNavName>
              </StyledNavItem>
            </div>
            <IconButton
              Icon={IconLayoutSidebarLeftCollapse}
              size="small"
              variant="tertiary"
              ariaLabel={t`Hide pipelines`}
              onClick={() => setIsSidebarCollapsed(true)}
            />
          </StyledSidebarSection>
          <StyledSidebarSection>
            <StyledSectionTitle>{t`Shared`}</StyledSectionTitle>
            {shared.map(renderNavItem)}
            {shared.length === 0 && !api.isLoading && (
              <StyledSectionTitle
                style={{ textTransform: 'none', letterSpacing: 0 }}
              >{t`None yet`}</StyledSectionTitle>
            )}
          </StyledSidebarSection>
          <StyledSidebarSection>
            <StyledSectionTitle>{t`Personal`}</StyledSectionTitle>
            {personal.map(renderNavItem)}
          </StyledSidebarSection>
          <div>
            <Button
              title={t`New pipeline`}
              Icon={IconPlus}
              size="small"
              variant="secondary"
              onClick={() => setIsCreatingPipeline(true)}
            />
          </div>
        </StyledSidebar>
      )}

      <StyledMain>
        {api.isLoading ? (
          <StyledEmpty>{t`Loading…`}</StyledEmpty>
        ) : pipelines.length === 0 ? (
          <StyledEmpty>
            <IconLayoutKanban size={32} />
            <div>{t`Create your first task pipeline to start organizing work.`}</div>
            <Button
              title={t`New pipeline`}
              Icon={IconPlus}
              accent="blue"
              onClick={() => setIsCreatingPipeline(true)}
            />
          </StyledEmpty>
        ) : (
          <>
            <StyledHeader>
              <StyledTitle>
                <PipelineSwitcher
                  pipelines={pipelines}
                  selectedKey={selectedKey}
                  onSelect={selectPipeline}
                  onCreate={() => setIsCreatingPipeline(true)}
                >
                  {isMine ? (
                    <IconUser size={18} />
                  ) : selectedPipeline?.visibility === 'PERSONAL' ? (
                    <IconLock size={18} />
                  ) : (
                    <IconUsers size={18} />
                  )}
                  <StyledSwitcherName>
                    {isMine ? t`My tasks` : (selectedPipeline?.name ?? '')}
                  </StyledSwitcherName>
                </PipelineSwitcher>
              </StyledTitle>
              {selectedPipeline && (
                <StyledAvatars
                  title={pipelineMembers
                    .map((member) => member.fullName)
                    .join(', ')}
                >
                  {pipelineMembers.slice(0, 6).map((member) => (
                    <MemberAvatar key={member.id} member={member} size="sm" />
                  ))}
                </StyledAvatars>
              )}
              <StyledSearch>
                <IconSearch size={14} />
                <input
                  aria-label={t`Search tasks`}
                  value={search}
                  placeholder={t`Search tasks`}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </StyledSearch>
              {selectedPipeline && (
                <StyledSelect
                  aria-label={t`Assignee filter`}
                  value={assigneeFilter}
                  onChange={(event) => setAssigneeFilter(event.target.value)}
                >
                  <option value="all">{t`Everyone`}</option>
                  <option value="me">{t`Mine (member or step)`}</option>
                  <option value="unassigned">{t`Unassigned`}</option>
                  {pipelineMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </StyledSelect>
              )}
              {selectedPipeline && selectedPipeline.labels.length > 0 && (
                <StyledSelect
                  aria-label={t`Label filter`}
                  value={labelFilter ?? ''}
                  onChange={(event) =>
                    setLabelFilter(event.target.value || null)
                  }
                >
                  <option value="">{t`All labels`}</option>
                  {selectedPipeline.labels.map((label) => (
                    <option key={label.name} value={label.name}>
                      {label.name}
                    </option>
                  ))}
                </StyledSelect>
              )}
              {selectedPipeline && (
                <StyledSegmented>
                  <StyledSegment
                    type="button"
                    isActive={view === 'board'}
                    onClick={() => setView('board')}
                    aria-label={t`Board`}
                  >
                    <IconLayoutKanban size={14} />
                    {t`Board`}
                  </StyledSegment>
                  <StyledSegment
                    type="button"
                    isActive={view === 'list'}
                    onClick={() => setView('list')}
                    aria-label={t`List`}
                  >
                    <IconList size={14} />
                    {t`List`}
                  </StyledSegment>
                </StyledSegmented>
              )}
              {selectedPipeline && (
                <IconButton
                  Icon={IconArchive}
                  variant="secondary"
                  size="small"
                  ariaLabel={t`Archived tasks`}
                  onClick={() => setArchivedOpen(true)}
                />
              )}
              {selectedPipeline && (
                <IconButton
                  Icon={IconSettings}
                  variant="secondary"
                  size="small"
                  ariaLabel={t`Pipeline settings`}
                  onClick={() => setSettingsOpen(true)}
                />
              )}
              {selectedPipeline && (
                <Button
                  title={t`New task`}
                  Icon={IconPlus}
                  accent="blue"
                  size="small"
                  onClick={() => setIsCreatingTask(true)}
                />
              )}
            </StyledHeader>

            {!tasksApi.isLoading &&
              tasksApi.tasks.length > 0 &&
              visibleTasks.length === 0 && (
                <StyledFilterNotice>
                  {search.trim().length > 0
                    ? t`No tasks match “${search.trim()}”.`
                    : t`No tasks match these filters.`}
                  <StyledTextButton
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setAssigneeFilter('all');
                      setLabelFilter(null);
                    }}
                  >
                    {t`Clear filters`}
                  </StyledTextButton>
                </StyledFilterNotice>
              )}
            {tasksApi.isLoading ? (
              <StyledEmpty>{t`Loading tasks…`}</StyledEmpty>
            ) : isMine ? (
              <TaskListView
                tasks={visibleTasks}
                stagesById={stagesById}
                membersById={membersById}
                showPipeline
                onOpenTask={(task) => setOpenTask(task.id)}
              />
            ) : selectedPipeline && view === 'board' ? (
              <TaskBoard
                stages={selectedPipeline.stages}
                tasks={visibleTasks}
                allTasks={tasksApi.tasks}
                membersById={membersById}
                labelColors={labelColors}
                onOpenTask={setOpenTask}
                onMoveTask={(taskId, stageId, position) =>
                  void guard(() => tasksApi.moveTask(taskId, stageId, position))
                }
                onQuickAdd={async (stageId, title) => {
                  try {
                    await tasksApi.createTask({
                      pipelineId: selectedPipeline.id,
                      stageId,
                      title,
                    });
                    await api.reload();
                  } catch (error) {
                    enqueueErrorSnackBar({
                      message: friendlyErrorMessage(
                        error,
                        t`Could not create the task`,
                      ),
                    });
                    throw error;
                  }
                }}
              />
            ) : selectedPipeline ? (
              <TaskListView
                tasks={visibleTasks}
                stagesById={stagesById}
                membersById={membersById}
                showPipeline={false}
                onOpenTask={(task) => setOpenTask(task.id)}
              />
            ) : null}
          </>
        )}
      </StyledMain>

      {isCreatingPipeline && (
        <CreateTaskPipelineModal
          existingNames={pipelines.map((pipeline) => pipeline.name)}
          canCreateWorkspacePipelines={api.canCreateWorkspacePipelines}
          onClose={() => setIsCreatingPipeline(false)}
          onCreate={async (input) => {
            const created = await api.createPipeline({
              ...input,
              stages: [
                { name: t`To do`, color: 'gray' },
                { name: t`In progress`, color: 'blue' },
                { name: t`Blocked`, color: 'red' },
                { name: t`Done`, color: 'green', isDone: true },
              ],
            });

            setIsCreatingPipeline(false);
            enqueueSuccessSnackBar({ message: t`Pipeline created` });

            if (created) {
              selectPipeline(created.id);
            }
          }}
        />
      )}

      {isCreatingTask && selectedPipeline && (
        <NewTaskModal
          pipeline={selectedPipeline}
          members={pipelineMembers}
          defaultAssigneeId={
            pipelineMembers.some((member) => member.id === currentMemberId)
              ? currentMemberId
              : null
          }
          onClose={() => setIsCreatingTask(false)}
          onCreate={async (input) => {
            await tasksApi.createTask({
              pipelineId: selectedPipeline.id,
              ...input,
            });
            setIsCreatingTask(false);
            enqueueSuccessSnackBar({ message: t`Task created` });
            await api.reload();
          }}
        />
      )}

      {settingsOpen && selectedPipeline && (
        <TaskPipelineSettingsModal
          pipeline={selectedPipeline}
          api={api}
          membersById={membersById}
          allMembers={allWorkspaceMembers}
          currentWorkspaceMemberId={currentMemberId}
          onClose={() => setSettingsOpen(false)}
          onTasksMayHaveChanged={() => {
            // La importación de Fathom corre en segundo plano: se refresca ya y un par de veces más.
            void tasksApi.refetch();
            window.setTimeout(() => void tasksApi.refetch(), 4000);
            window.setTimeout(() => void tasksApi.refetch(), 12000);
          }}
          onDeleted={() => {
            setSettingsOpen(false);
            setSearchParams(new URLSearchParams());
          }}
        />
      )}

      {archivedOpen && selectedPipeline && (
        <ArchivedTasksModal
          pipelineId={selectedPipeline.id}
          stageName={(stageId) => stagesById.get(stageId)?.name ?? ''}
          onRestore={async (taskId) => {
            await guard(async () => {
              await tasksApi.setArchived(taskId, false);
              await tasksApi.refetch();
              await api.reload();
              enqueueSuccessSnackBar({ message: t`Task restored` });
            });
          }}
          onClose={() => setArchivedOpen(false)}
        />
      )}

      {openTask && openTaskPipeline && (
        <TaskDetailPanel
          key={openTask.id}
          task={openTask}
          pipeline={openTaskPipeline}
          membersById={membersById}
          currentWorkspaceMemberId={currentMemberId}
          onClose={() => setOpenTask(null)}
          onUpdate={(input) => tasksApi.updateTask(openTask.id, input)}
          onMove={async (stageId) => {
            const others = tasksApi.tasks.filter(
              (task) => task.stageId === stageId && task.id !== openTask.id,
            );
            const position =
              others.reduce((max, task) => Math.max(max, task.position), 0) +
              1024;

            await tasksApi.moveTask(openTask.id, stageId, position);
            await api.reload();
          }}
          onArchive={async (archived) => {
            await tasksApi.setArchived(openTask.id, archived);

            if (archived) {
              setOpenTask(null);
              enqueueSuccessSnackBar({ message: t`Task archived` });
            }

            await api.reload();
          }}
          onDelete={async () => {
            await tasksApi.deleteTask(openTask.id);
            setOpenTask(null);
            enqueueSuccessSnackBar({ message: t`Task deleted` });
            await api.reload();
          }}
          onOpenMeeting={(meetingId) =>
            navigate(`${AppPath.MeetingsPage}?meeting=${meetingId}`)
          }
          onUploadAttachment={(file, purpose, checklistItemId) =>
            tasksApi.uploadAttachment(
              openTask.id,
              file,
              purpose,
              checklistItemId ?? null,
            )
          }
          onDeleteAttachment={(attachmentId) =>
            tasksApi.deleteAttachment(openTask.id, attachmentId)
          }
        />
      )}
    </StyledPage>
  );
};
