import { computeInsertPosition } from '@/task-pipelines/utils/computeInsertPosition';
import { filterPipelineTasks } from '@/task-pipelines/utils/filterPipelineTasks';
import {
  dueFromInputValue,
  dueInputValue,
  getTaskDueStatus,
} from '@/task-pipelines/utils/taskDueStatus';
import { timestampToSeconds } from '@/task-pipelines/utils/timestampToSeconds';
import { type PipelineTask } from '@/task-pipelines/types/TaskPipelineTypes';

describe('computeInsertPosition', () => {
  it('handles an empty column', () => {
    expect(computeInsertPosition([], 0)).toBe(1024);
  });

  it('puts a card first, last and between neighbours', () => {
    expect(computeInsertPosition([1024, 2048], 0)).toBe(0);
    expect(computeInsertPosition([1024, 2048], 2)).toBe(3072);
    expect(computeInsertPosition([1024, 2048], 1)).toBe(1536);
  });

  it('clamps out-of-range indexes', () => {
    expect(computeInsertPosition([10], 99)).toBe(1034);
    expect(computeInsertPosition([10], -3)).toBe(-1014);
  });
});

describe('getTaskDueStatus', () => {
  const now = new Date(2026, 8, 28, 12, 0, 0);

  it('classifies due dates', () => {
    expect(getTaskDueStatus(new Date(2026, 8, 27, 17).toISOString(), false, now)).toBe('overdue');
    expect(getTaskDueStatus(new Date(2026, 8, 28, 9).toISOString(), false, now)).toBe('today');
    expect(getTaskDueStatus(new Date(2026, 8, 30, 9).toISOString(), false, now)).toBe('soon');
    expect(getTaskDueStatus(new Date(2026, 9, 10, 9).toISOString(), false, now)).toBe('later');
  });

  it('ignores done tasks and missing dates', () => {
    expect(getTaskDueStatus(new Date(2026, 8, 1).toISOString(), true, now)).toBe('none');
    expect(getTaskDueStatus(null, false, now)).toBe('none');
  });

  it('round-trips the date input value', () => {
    expect(dueInputValue(dueFromInputValue('2026-10-02'))).toBe('2026-10-02');
    expect(dueFromInputValue('')).toBeNull();
  });
});

describe('timestampToSeconds', () => {
  it('parses HH:MM:SS and MM:SS', () => {
    expect(timestampToSeconds('01:02:03')).toBe(3723);
    expect(timestampToSeconds('02:03')).toBe(123);
    expect(timestampToSeconds(null)).toBe(0);
  });
});

describe('filterPipelineTasks', () => {
  const base: PipelineTask = {
    id: '1', pipelineId: 'p', pipelineName: 'P', stageId: 's', position: 0, title: 'Enviar leads a Pilar',
    body: '', assigneeWorkspaceMemberId: 'me', dueAt: null, priority: null, labels: ['PTS Tax'], checklist: [],
    relatedRecords: [], source: 'MANUAL', sourceLink: null, meeting: null, originalText: 'Send leads',
    needsAssignment: false, createdByWorkspaceMemberId: null, completedAt: null, archivedAt: null,
    commentCount: 0, createdAt: '', updatedAt: '',
  };
  const tasks: PipelineTask[] = [
    base,
    { ...base, id: '2', title: 'Revisión del logo', assigneeWorkspaceMemberId: null, labels: [] },
    { ...base, id: '3', title: 'Otro', assigneeWorkspaceMemberId: 'other', labels: ['Sunset'] },
  ];
  const run = (overrides: Partial<Parameters<typeof filterPipelineTasks>[1]>) =>
    filterPipelineTasks(tasks, { search: '', assignee: 'all', label: null, currentWorkspaceMemberId: 'me', ...overrides }).map((task) => task.id);

  it('filters by assignee', () => {
    expect(run({ assignee: 'me' })).toEqual(['1']);
    expect(run({ assignee: 'unassigned' })).toEqual(['2']);
    expect(run({ assignee: 'other' })).toEqual(['3']);
  });

  it('filters by label and accent-insensitive search (incl. original text)', () => {
    expect(run({ label: 'Sunset' })).toEqual(['3']);
    expect(run({ search: 'revision' })).toEqual(['2']);
    expect(run({ search: 'send' })).toEqual(['1', '2', '3']);
  });
});
