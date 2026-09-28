import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';

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

// Las tareas que crea Fathom al terminar una reunión aparecen solas.
const LIVE_REFRESH_MS = 30_000;

export const usePipelineTasks = (pipelineId: string | null, mode: 'pipeline' | 'mine') => {
  const client = useApolloCoreClient();
  const key = mode === 'mine' ? 'mine' : (pipelineId ?? '');

  const pipelineQuery = useQuery<{ taskPipelineTasks: PipelineTask[] }>(GET_PIPELINE_TASKS, {
    client,
    variables: { pipelineId },
    skip: mode !== 'pipeline' || !pipelineId,
    fetchPolicy: 'cache-and-network',
    pollInterval: LIVE_REFRESH_MS,
  });

  const mineQuery = useQuery<{ myTaskPipelineTasks: PipelineTask[] }>(GET_MY_PIPELINE_TASKS, {
    client,
    skip: mode !== 'mine',
    fetchPolicy: 'cache-and-network',
    pollInterval: LIVE_REFRESH_MS,
  });

  const serverTasks =
    mode === 'mine' ? mineQuery.data?.myTaskPipelineTasks : pipelineQuery.data?.taskPipelineTasks;

  // Copia local (para cambios optimistas) atada al tablero que la originó: al
  // cambiar de tablero nunca se muestran tareas del anterior ni se vacía la
  // lista que ya llegó de la caché.
  const [local, setLocal] = useState<{ key: string; tasks: PipelineTask[] }>({ key, tasks: [] });

  useEffect(() => {
    if (serverTasks) {
      setLocal({ key, tasks: serverTasks });
    }
  }, [serverTasks, key]);

  const tasks = local.key === key ? local.tasks : (serverTasks ?? []);

  const setTasks = (updater: PipelineTask[] | ((previous: PipelineTask[]) => PipelineTask[])) =>
    setLocal((previous) => {
      const base = previous.key === key ? previous.tasks : (serverTasks ?? []);

      return {
        key,
        tasks: typeof updater === 'function' ? updater(base) : updater,
      };
    });

  const refetch = async () => {
    if (mode === 'mine') {
      await mineQuery.refetch();
    } else if (pipelineId) {
      await pipelineQuery.refetch();
    }
  };

  const [createMutation] = useMutation<{ createTaskPipelineTask: PipelineTask }>(
    CREATE_PIPELINE_TASK,
    { client },
  );
  const [updateMutation] = useMutation<{ updateTaskPipelineTask: PipelineTask }>(
    UPDATE_PIPELINE_TASK,
    { client },
  );
  const [moveMutation] = useMutation<{ moveTaskPipelineTask: PipelineTask }>(MOVE_PIPELINE_TASK, {
    client,
  });
  const [archiveMutation] = useMutation<{ setTaskPipelineTaskArchived: PipelineTask }>(
    SET_PIPELINE_TASK_ARCHIVED,
    { client },
  );
  const [deleteMutation] = useMutation(DELETE_PIPELINE_TASK, { client });

  const replaceTask = (task: PipelineTask) =>
    setTasks((previous) => previous.map((entry) => (entry.id === task.id ? task : entry)));

  const createTask = async (input: CreatePipelineTaskInput) => {
    const result = await createMutation({ variables: { input } });
    const created = result.data?.createTaskPipelineTask;

    if (created) {
      setTasks((previous) => [...previous, created]);
    }

    return created ?? null;
  };

  const updateTask = async (taskId: string, input: UpdatePipelineTaskInput) => {
    const result = await updateMutation({ variables: { taskId, input } });
    const updated = result.data?.updateTaskPipelineTask;

    if (updated) {
      replaceTask(updated);
    }

    return updated ?? null;
  };

  // Optimista: la tarjeta se mueve al instante; si el servidor falla se recarga.
  const moveTask = async (taskId: string, stageId: string, position: number) => {
    const previous = tasks;

    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, stageId, position } : task)),
    );

    try {
      const result = await moveMutation({ variables: { input: { taskId, stageId, position } } });

      if (result.data?.moveTaskPipelineTask) {
        replaceTask(result.data.moveTaskPipelineTask);
      }
    } catch (error) {
      setTasks(previous);
      throw error;
    }
  };

  const setArchived = async (taskId: string, archived: boolean) => {
    await archiveMutation({ variables: { taskId, archived } });
    setTasks((current) => current.filter((task) => task.id !== taskId || !archived));
  };

  const deleteTask = async (taskId: string) => {
    await deleteMutation({ variables: { taskId } });
    setTasks((current) => current.filter((task) => task.id !== taskId));
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
    replaceTask,
  };
};
