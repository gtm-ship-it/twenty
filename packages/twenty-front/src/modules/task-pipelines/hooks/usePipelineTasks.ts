import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isDefined } from 'twenty-shared/utils';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import {
  CREATE_PIPELINE_TASK,
  DELETE_PIPELINE_TASK,
  GET_MY_PIPELINE_TASKS,
  GET_PIPELINE_TASKS,
  MOVE_PIPELINE_TASK,
  SET_PIPELINE_TASK_ARCHIVED,
  UPDATE_PIPELINE_TASK,
} from '@/task-pipelines/graphql/taskPipelinesDocuments';
import {
  type CreatePipelineTaskInput,
  type PipelineTask,
  type UpdatePipelineTaskInput,
} from '@/task-pipelines/types/TaskPipelineTypes';
import {
  mergePipelineTasks,
  type TaskOverride,
} from '@/task-pipelines/utils/mergePipelineTasks';

// Las tareas que crea Fathom al terminar una reunión aparecen solas.
const LIVE_REFRESH_MS = 30_000;

// La lista del servidor (caché de Apollo + polling) es la fuente de verdad.
// Encima se aplican "overrides" locales: cambios optimistas y resultados de
// mutaciones que un poll viejo todavía no refleja. Un override se descarta
// solo cuando el servidor ya muestra algo igual o más nuevo, así un poll que
// salió antes de la mutación nunca revierte lo que el usuario acaba de hacer.
export const usePipelineTasks = (
  pipelineId: string | null,
  mode: 'pipeline' | 'mine',
) => {
  const client = useApolloCoreClient();
  const key = mode === 'mine' ? 'mine' : (pipelineId ?? '');

  const pipelineQuery = useQuery<{ taskPipelineTasks: PipelineTask[] }>(
    GET_PIPELINE_TASKS,
    {
      client,
      variables: { pipelineId },
      skip: mode !== 'pipeline' || !pipelineId,
      fetchPolicy: 'cache-and-network',
      pollInterval: LIVE_REFRESH_MS,
    },
  );

  const mineQuery = useQuery<{ myTaskPipelineTasks: PipelineTask[] }>(
    GET_MY_PIPELINE_TASKS,
    {
      client,
      skip: mode !== 'mine',
      fetchPolicy: 'cache-and-network',
      pollInterval: LIVE_REFRESH_MS,
    },
  );

  const serverTasks =
    mode === 'mine'
      ? mineQuery.data?.myTaskPipelineTasks
      : pipelineQuery.data?.taskPipelineTasks;

  const [overrides, setOverrides] = useState<{
    key: string;
    byId: Record<string, TaskOverride>;
  }>({
    key,
    byId: {},
  });

  const currentOverrides = useMemo(
    () => (overrides.key === key ? overrides.byId : {}),
    [overrides, key],
  );

  const setOverride = useCallback(
    (taskId: string, override: TaskOverride | undefined) =>
      setOverrides((previous) => {
        const byId = previous.key === key ? { ...previous.byId } : {};

        if (override === undefined) {
          delete byId[taskId];
        } else {
          byId[taskId] = override;
        }

        return { key, byId };
      }),
    [key],
  );

  // Limpieza de overrides que el servidor ya confirmó.
  useEffect(() => {
    if (!serverTasks) {
      return;
    }

    setOverrides((previous) => {
      if (previous.key !== key) {
        return { key, byId: {} };
      }

      const { remaining, changed } = mergePipelineTasks.prune(
        serverTasks,
        previous.byId,
      );

      return changed ? { key, byId: remaining } : previous;
    });
  }, [serverTasks, key]);

  const tasks = useMemo(
    () => mergePipelineTasks(serverTasks ?? [], currentOverrides),
    [serverTasks, currentOverrides],
  );

  const refetch = async () => {
    if (mode === 'mine') {
      await mineQuery.refetch();
    } else if (pipelineId !== null) {
      await pipelineQuery.refetch();
    }
  };

  const [createMutation] = useMutation<{
    createTaskPipelineTask: PipelineTask;
  }>(CREATE_PIPELINE_TASK, { client });
  const [updateMutation] = useMutation<{
    updateTaskPipelineTask: PipelineTask;
  }>(UPDATE_PIPELINE_TASK, { client });
  const [moveMutation] = useMutation<{ moveTaskPipelineTask: PipelineTask }>(
    MOVE_PIPELINE_TASK,
    {
      client,
    },
  );
  const [archiveMutation] = useMutation<{
    setTaskPipelineTaskArchived: PipelineTask;
  }>(SET_PIPELINE_TASK_ARCHIVED, { client });
  const [deleteMutation] = useMutation(DELETE_PIPELINE_TASK, { client });

  const confirm = (task: PipelineTask) =>
    setOverride(task.id, { kind: 'confirmed', task });

  const createTask = async (input: CreatePipelineTaskInput) => {
    const result = await createMutation({ variables: { input } });
    const created = result.data?.createTaskPipelineTask;

    if (created) {
      setOverride(created.id, { kind: 'created', task: created });
    }

    return created ?? null;
  };

  const updateTask = async (taskId: string, input: UpdatePipelineTaskInput) => {
    const result = await updateMutation({ variables: { taskId, input } });
    const updated = result.data?.updateTaskPipelineTask;

    if (updated) {
      confirm(updated);
    }

    return updated ?? null;
  };

  const moveTask = async (
    taskId: string,
    stageId: string,
    position: number,
  ) => {
    const current = tasks.find((task) => task.id === taskId);

    if (isDefined(current)) {
      setOverride(taskId, {
        kind: 'pending',
        task: { ...current, stageId, position },
      });
    }

    try {
      const result = await moveMutation({
        variables: { input: { taskId, stageId, position } },
      });

      if (result.data?.moveTaskPipelineTask) {
        confirm(result.data.moveTaskPipelineTask);
      }
    } catch (error) {
      setOverride(taskId, undefined);
      throw error;
    }
  };

  const setArchived = async (taskId: string, archived: boolean) => {
    const result = await archiveMutation({ variables: { taskId, archived } });
    const task = result.data?.setTaskPipelineTaskArchived;

    if (archived) {
      setOverride(taskId, { kind: 'removed', since: Date.now() });
    } else if (task) {
      confirm(task);
    }
  };

  const deleteTask = async (taskId: string) => {
    await deleteMutation({ variables: { taskId } });
    setOverride(taskId, { kind: 'removed', since: Date.now() });
  };

  const activeQuery = mode === 'mine' ? mineQuery : pipelineQuery;

  return {
    tasks,
    isLoading: activeQuery.loading && !serverTasks,
    error: activeQuery.error,
    refetch,
    createTask,
    updateTask,
    moveTask,
    setArchived,
    deleteTask,
  };
};
