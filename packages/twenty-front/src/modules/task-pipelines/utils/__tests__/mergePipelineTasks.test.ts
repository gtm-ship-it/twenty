import { mergePipelineTasks } from '@/task-pipelines/utils/mergePipelineTasks';
import { type PipelineTask } from '@/task-pipelines/types/TaskPipelineTypes';

const task = (
  id: string,
  updatedAt: string,
  extra: Partial<PipelineTask> = {},
): PipelineTask => ({
  id,
  pipelineId: 'p',
  pipelineName: 'P',
  stageId: 's1',
  position: 1,
  title: id,
  body: '',
  assigneeWorkspaceMemberId: null,
  memberWorkspaceMemberIds: [],
  startAt: null,
  checklists: [],
  checklistDoneCount: 0,
  checklistTotalCount: 0,
  attachments: [],
  coverAttachmentId: null,
  coverUrl: null,
  dueAt: null,
  priority: null,
  labels: [],
  checklist: [],
  relatedRecords: [],
  source: 'MANUAL',
  sourceLink: null,
  meeting: null,
  originalText: null,
  needsAssignment: false,
  createdByWorkspaceMemberId: null,
  completedAt: null,
  archivedAt: null,
  commentCount: 0,
  createdAt: '2026-09-28T10:00:00Z',
  updatedAt,
  ...extra,
});

describe('mergePipelineTasks', () => {
  const server = [
    task('a', '2026-09-28T10:00:00Z'),
    task('b', '2026-09-28T10:00:00Z'),
  ];

  it('keeps a created task the poll does not have yet', () => {
    const merged = mergePipelineTasks(server, {
      c: { kind: 'created', task: task('c', '2026-09-28T10:01:00Z') },
    });

    expect(merged.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('hides a removed task even if a stale poll returns it', () => {
    expect(
      mergePipelineTasks(server, {
        a: { kind: 'removed', since: Date.now() },
      }).map((entry) => entry.id),
    ).toEqual(['b']);
  });

  it('a stale poll does not revert a confirmed move', () => {
    const moved = task('a', '2026-09-28T10:05:00Z', { stageId: 's2' });

    expect(
      mergePipelineTasks(server, { a: { kind: 'confirmed', task: moved } })[0]
        .stageId,
    ).toBe('s2');
  });

  it('a newer server version wins over an older confirmation', () => {
    const confirmed = task('a', '2026-09-28T09:00:00Z', { title: 'old' });

    expect(
      mergePipelineTasks(server, {
        a: { kind: 'confirmed', task: confirmed },
      })[0].title,
    ).toBe('a');
  });

  it('prunes overrides once the server catches up', () => {
    const { remaining, changed } = mergePipelineTasks.prune(
      [task('a', '2026-09-28T10:05:00Z'), task('c', '2026-09-28T10:01:00Z')],
      {
        a: { kind: 'confirmed', task: task('a', '2026-09-28T10:05:00Z') },
        c: { kind: 'created', task: task('c', '2026-09-28T10:01:00Z') },
        b: { kind: 'removed', since: Date.now() },
        d: { kind: 'pending', task: task('d', '2026-09-28T10:00:00Z') },
      },
    );

    expect(changed).toBe(true);
    expect(Object.keys(remaining)).toEqual(['d']);
  });
});
