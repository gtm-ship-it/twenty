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

  // Una persona "está" en una tarjeta si es miembro o tiene un punto asignado.
  const involves = (task: PipelineTask, memberId: string | null) =>
    memberId !== null &&
    (task.memberWorkspaceMemberIds.includes(memberId) ||
      task.checklists.some((checklist) =>
        checklist.items.some(
          (item) => item.assigneeWorkspaceMemberId === memberId,
        ),
      ));

  return tasks.filter((task) => {
    if (assignee === 'me' && !involves(task, currentWorkspaceMemberId)) {
      return false;
    }

    if (assignee === 'unassigned' && task.memberWorkspaceMemberIds.length > 0) {
      return false;
    }

    if (
      assignee !== 'all' &&
      assignee !== 'me' &&
      assignee !== 'unassigned' &&
      !involves(task, assignee)
    ) {
      return false;
    }

    if (label && !task.labels.includes(label)) {
      return false;
    }

    if (needle.length > 0) {
      const haystack = normalize(
        `${task.title} ${task.body} ${task.labels.join(' ')} ${task.originalText ?? ''} ${task.checklists
          .flatMap((checklist) => [
            checklist.title,
            ...checklist.items.map((item) => item.text),
          ])
          .join(' ')}`,
      );

      return haystack.includes(needle);
    }

    return true;
  });
};
