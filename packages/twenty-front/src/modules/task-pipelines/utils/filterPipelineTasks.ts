import { type PipelineTask } from '@/task-pipelines/types/TaskPipelineTypes';

export type TaskAssigneeFilter = 'all' | 'me' | 'unassigned' | string;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const filterPipelineTasks = (
  tasks: PipelineTask[],
  {
    search,
    assignee,
    label,
    currentWorkspaceMemberId,
  }: {
    search: string;
    assignee: TaskAssigneeFilter;
    label: string | null;
    currentWorkspaceMemberId: string | null;
  },
): PipelineTask[] => {
  const needle = normalize(search.trim());

  return tasks.filter((task) => {
    if (assignee === 'me' && task.assigneeWorkspaceMemberId !== currentWorkspaceMemberId) {
      return false;
    }

    if (assignee === 'unassigned' && task.assigneeWorkspaceMemberId !== null) {
      return false;
    }

    if (
      assignee !== 'all' &&
      assignee !== 'me' &&
      assignee !== 'unassigned' &&
      task.assigneeWorkspaceMemberId !== assignee
    ) {
      return false;
    }

    if (label && !task.labels.includes(label)) {
      return false;
    }

    if (needle.length > 0) {
      const haystack = normalize(
        `${task.title} ${task.body} ${task.labels.join(' ')} ${task.originalText ?? ''}`,
      );

      return haystack.includes(needle);
    }

    return true;
  });
};
