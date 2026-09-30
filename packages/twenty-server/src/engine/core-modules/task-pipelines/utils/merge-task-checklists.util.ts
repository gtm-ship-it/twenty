// Fusión de checklists entre varias personas editando la misma tarjeta.
//
// El front manda `base` (cómo veía las checklists justo antes de su cambio) y
// `next` (cómo quedan después). Se aplica SOLO la diferencia base → next sobre
// lo que hay guardado ahora (`current`). Así, si otra persona agregó un punto o
// una foto entretanto, un clic mío en otra casilla no se lo borra.

export type ChecklistPointShape = {
  id: string;
  text: string;
  done: boolean;
  assigneeWorkspaceMemberId: string | null;
  dueAt: string | null;
};

export type ChecklistShape<
  P extends ChecklistPointShape = ChecklistPointShape,
> = {
  id: string;
  title: string;
  items: P[];
};

const POINT_FIELDS = [
  'text',
  'done',
  'assigneeWorkspaceMemberId',
  'dueAt',
] as const;

const normalizeDue = (value: string | Date | null | undefined) =>
  value === null || value === undefined ? null : new Date(value).toISOString();

const samePointField = (
  field: (typeof POINT_FIELDS)[number],
  a: ChecklistPointShape,
  b: ChecklistPointShape,
) =>
  field === 'dueAt'
    ? normalizeDue(a.dueAt) === normalizeDue(b.dueAt)
    : (a[field] ?? null) === (b[field] ?? null);

const locate = (checklists: ChecklistShape[]) => {
  const byItem = new Map<
    string,
    { checklistId: string; point: ChecklistPointShape }
  >();

  for (const checklist of checklists) {
    for (const point of checklist.items) {
      byItem.set(point.id, { checklistId: checklist.id, point });
    }
  }

  return byItem;
};

export type ChecklistMergeResult<P extends ChecklistPointShape> = {
  checklists: ChecklistShape<P | ChecklistPointShape>[];
  // Puntos que este cambio borró explícitamente (para borrar sus fotos).
  removedItemIds: string[];
  // Puntos cuyo responsable cambió en este cambio (solo esos se validan).
  changedAssigneeItemIds: string[];
};

export const mergeTaskChecklists = <P extends ChecklistPointShape>({
  current,
  base,
  next,
}: {
  current: ChecklistShape<P>[];
  base: ChecklistShape[];
  next: ChecklistShape[];
}): ChecklistMergeResult<P> => {
  const baseItems = locate(base);
  const nextItems = locate(next);
  const baseChecklistIds = new Set(base.map((checklist) => checklist.id));
  const nextChecklistById = new Map(
    next.map((checklist) => [checklist.id, checklist]),
  );
  const baseChecklistById = new Map(
    base.map((checklist) => [checklist.id, checklist]),
  );

  const removedChecklistIds = new Set(
    base
      .filter((checklist) => !nextChecklistById.has(checklist.id))
      .map((checklist) => checklist.id),
  );
  const removedItemIds = [...baseItems.keys()].filter(
    (itemId) => !nextItems.has(itemId),
  );
  const removedItemSet = new Set(removedItemIds);
  const changedAssigneeItemIds: string[] = [];

  // 1) partir de lo guardado, sin lo que este cambio borró
  let result: ChecklistShape<P | ChecklistPointShape>[] = current
    .filter((checklist) => !removedChecklistIds.has(checklist.id))
    .map((checklist) => ({
      ...checklist,
      items: checklist.items.filter((item) => !removedItemSet.has(item.id)),
    }));

  // 2) títulos cambiados y checklists nuevas (en su posición relativa)
  for (const [index, checklist] of next.entries()) {
    const before = baseChecklistById.get(checklist.id);
    const existing = result.find((entry) => entry.id === checklist.id);

    if (existing !== undefined) {
      if (before !== undefined && before.title !== checklist.title) {
        existing.title = checklist.title;
      }

      continue;
    }

    if (baseChecklistIds.has(checklist.id)) {
      // Otra persona la borró entretanto: se respeta su borrado.
      continue;
    }

    const insertAt = Math.min(index, result.length);

    result = [
      ...result.slice(0, insertAt),
      { id: checklist.id, title: checklist.title, items: [] },
      ...result.slice(insertAt),
    ];
  }

  // 3) puntos: nuevos, movidos de checklist y campos cambiados
  for (const checklist of next) {
    for (const [index, point] of checklist.items.entries()) {
      const before = baseItems.get(point.id);
      const target = result.find((entry) => entry.id === checklist.id);

      if (target === undefined) {
        continue;
      }

      const where = locate(result).get(point.id);

      if (before === undefined) {
        if (where === undefined) {
          const previousId = checklist.items[index - 1]?.id;
          const afterIndex = target.items.findIndex(
            (item) => item.id === previousId,
          );
          const insertAt =
            afterIndex >= 0
              ? afterIndex + 1
              : Math.min(index, target.items.length);

          target.items = [
            ...target.items.slice(0, insertAt),
            { ...point },
            ...target.items.slice(insertAt),
          ];

          if (point.assigneeWorkspaceMemberId !== null) {
            changedAssigneeItemIds.push(point.id);
          }
        }

        continue;
      }

      if (where === undefined) {
        // Otra persona lo borró entretanto.
        continue;
      }

      const stored = where.point;
      const patch: Partial<ChecklistPointShape> = {};

      for (const field of POINT_FIELDS) {
        if (!samePointField(field, before.point, point)) {
          (patch as Record<string, unknown>)[field] = point[field] ?? null;
        }
      }

      if ('assigneeWorkspaceMemberId' in patch) {
        changedAssigneeItemIds.push(point.id);
      }

      const updated = { ...stored, ...patch };

      if (
        before.checklistId !== checklist.id &&
        where.checklistId !== checklist.id
      ) {
        // Movido a otra checklist en este cambio.
        const source = result.find((entry) => entry.id === where.checklistId);

        if (source !== undefined) {
          source.items = source.items.filter((item) => item.id !== point.id);
        }

        target.items = [...target.items, updated];
      } else {
        const holder = result.find((entry) => entry.id === where.checklistId);

        if (holder !== undefined) {
          holder.items = holder.items.map((item) =>
            item.id === point.id ? updated : item,
          );
        }
      }
    }
  }

  return { checklists: result, removedItemIds, changedAssigneeItemIds };
};

// Misma idea para listas simples (miembros, etiquetas): current + añadidos − quitados.
export const mergeIdList = ({
  current,
  base,
  next,
}: {
  current: string[];
  base: string[];
  next: string[];
}): string[] => {
  const added = next.filter((id) => !base.includes(id));
  const removed = new Set(base.filter((id) => !next.includes(id)));

  return [
    ...current.filter((id) => !removed.has(id)),
    ...added.filter((id) => !current.includes(id)),
  ];
};
