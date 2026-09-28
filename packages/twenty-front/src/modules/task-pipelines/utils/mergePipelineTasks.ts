import { type PipelineTask } from '@/task-pipelines/types/TaskPipelineTypes';

// pending   = cambio optimista aún sin respuesta del servidor
// confirmed = respuesta de una mutación (el servidor la tiene; un poll viejo tal vez no)
// created   = tarea nueva que el poll todavía no trae
// removed   = archivada/borrada; se oculta aunque un poll viejo la devuelva
export type TaskOverride =
  | { kind: 'pending'; task: PipelineTask }
  | { kind: 'confirmed'; task: PipelineTask }
  | { kind: 'created'; task: PipelineTask }
  | { kind: 'removed'; since: number };

const REMOVED_TTL_MS = 5 * 60 * 1000;

const time = (value: string) => new Date(value).getTime();

const applyOverrides = (
  serverTasks: PipelineTask[],
  overrides: Record<string, TaskOverride>,
): PipelineTask[] => {
  const result: PipelineTask[] = [];
  const seen = new Set<string>();

  for (const task of serverTasks) {
    seen.add(task.id);
    const override = overrides[task.id];

    if (override === undefined) {
      result.push(task);
      continue;
    }

    if (override.kind === 'removed') {
      continue;
    }

    // Si el servidor ya trae una versión más nueva que la confirmada, gana el servidor.
    if (
      override.kind === 'confirmed' &&
      time(task.updatedAt) > time(override.task.updatedAt)
    ) {
      result.push(task);
      continue;
    }

    result.push(override.task);
  }

  for (const [taskId, override] of Object.entries(overrides)) {
    if (!seen.has(taskId) && override.kind === 'created') {
      result.push(override.task);
    }
  }

  return result;
};

// Quita los overrides que el servidor ya refleja.
const prune = (
  serverTasks: PipelineTask[],
  overrides: Record<string, TaskOverride>,
): { remaining: Record<string, TaskOverride>; changed: boolean } => {
  const serverById = new Map(serverTasks.map((task) => [task.id, task]));
  const remaining: Record<string, TaskOverride> = {};
  let changed = false;

  for (const [taskId, override] of Object.entries(overrides)) {
    const server = serverById.get(taskId);
    let keep = true;

    if (override.kind === 'created' || override.kind === 'confirmed') {
      keep =
        server === undefined
          ? override.kind === 'created'
          : time(server.updatedAt) < time(override.task.updatedAt);
    } else if (override.kind === 'removed') {
      keep =
        server !== undefined && Date.now() - override.since < REMOVED_TTL_MS;
    }

    if (keep) {
      remaining[taskId] = override;
    } else {
      changed = true;
    }
  }

  return { remaining, changed };
};

export const mergePipelineTasks = Object.assign(applyOverrides, { prune });
