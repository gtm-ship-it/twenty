import {
  mergeIdList,
  mergeTaskChecklists,
} from 'src/engine/core-modules/task-pipelines/utils/merge-task-checklists.util';

const point = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  text: id,
  done: false,
  assigneeWorkspaceMemberId: null,
  dueAt: null,
  ...extra,
});

describe('mergeTaskChecklists', () => {
  it('my tick does not delete a point someone else added meanwhile', () => {
    const base = [{ id: 'c', title: 'Pasos', items: [point('a')] }];
    const current = [
      { id: 'c', title: 'Pasos', items: [point('a'), point('x')] },
    ];
    const next = [
      { id: 'c', title: 'Pasos', items: [point('a', { done: true })] },
    ];

    const result = mergeTaskChecklists({ current, base, next });

    expect(
      result.checklists[0].items.map((item) => [item.id, item.done]),
    ).toEqual([
      ['a', true],
      ['x', false],
    ]);
    expect(result.removedItemIds).toEqual([]);
  });

  it('explicit removal only removes that point', () => {
    const base = [{ id: 'c', title: 'P', items: [point('a'), point('b')] }];
    const current = [
      { id: 'c', title: 'P', items: [point('a'), point('b'), point('x')] },
    ];
    const next = [{ id: 'c', title: 'P', items: [point('a')] }];

    const result = mergeTaskChecklists({ current, base, next });

    expect(result.checklists[0].items.map((item) => item.id)).toEqual([
      'a',
      'x',
    ]);
    expect(result.removedItemIds).toEqual(['b']);
  });

  it("field-level merge keeps the other person's edit to another field", () => {
    const base = [{ id: 'c', title: 'P', items: [point('a')] }];
    const current = [
      {
        id: 'c',
        title: 'P',
        items: [point('a', { assigneeWorkspaceMemberId: 'mauro' })],
      },
    ];
    const next = [{ id: 'c', title: 'P', items: [point('a', { done: true })] }];

    const [merged] = mergeTaskChecklists({ current, base, next }).checklists;

    expect(merged.items[0]).toMatchObject({
      done: true,
      assigneeWorkspaceMemberId: 'mauro',
    });
  });

  it('adds new points after their predecessor and new checklists', () => {
    const base = [{ id: 'c', title: 'P', items: [point('a')] }];
    const current = [{ id: 'c', title: 'P', items: [point('a'), point('x')] }];
    const next = [
      {
        id: 'c',
        title: 'P renamed',
        items: [point('a'), point('n', { assigneeWorkspaceMemberId: 'jony' })],
      },
      { id: 'd', title: 'Nueva', items: [point('m')] },
    ];

    const result = mergeTaskChecklists({ current, base, next });

    expect(result.checklists.map((checklist) => checklist.title)).toEqual([
      'P renamed',
      'Nueva',
    ]);
    expect(result.checklists[0].items.map((item) => item.id)).toEqual([
      'a',
      'n',
      'x',
    ]);
    expect(result.checklists[1].items.map((item) => item.id)).toEqual(['m']);
    expect(result.changedAssigneeItemIds).toEqual(['n']);
  });

  it('does not resurrect what someone else deleted', () => {
    const base = [{ id: 'c', title: 'P', items: [point('a'), point('b')] }];
    const current = [{ id: 'c', title: 'P', items: [point('a')] }];
    const next = [
      { id: 'c', title: 'P', items: [point('a'), point('b', { done: true })] },
    ];

    expect(
      mergeTaskChecklists({ current, base, next }).checklists[0].items.map(
        (item) => item.id,
      ),
    ).toEqual(['a']);
  });
});

describe('mergeIdList', () => {
  it('applies only my additions and removals', () => {
    expect(
      mergeIdList({
        current: ['a', 'b', 'x'],
        base: ['a', 'b'],
        next: ['a', 'c'],
      }),
    ).toEqual(['a', 'x', 'c']);
  });
});
