import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import {
  ADD_TASK_PIPELINE_MEMBER,
  CONNECT_FATHOM,
  CREATE_TASK_PIPELINE,
  DELETE_TASK_PIPELINE,
  DISCONNECT_FATHOM,
  GET_TASK_PIPELINES,
  REMOVE_TASK_PIPELINE_MEMBER,
  SAVE_TASK_PIPELINE_STAGES,
  SYNC_FATHOM,
  UPDATE_TASK_PIPELINE,
  UPDATE_TASK_PIPELINE_MEMBER,
} from '@/task-pipelines/graphql/taskPipelinesDocuments';
import {
  type TaskPipeline,
  type TaskPipelineLabel,
  type TaskPipelineRole,
  type TaskPipelineVisibility,
} from '@/task-pipelines/types/TaskPipelineTypes';

export type StageDraft = {
  id?: string | null;
  name: string;
  color: string;
  isDone?: boolean;
};

export const useTaskPipelines = () => {
  const client = useApolloCoreClient();

  const { data, loading, error, refetch } = useQuery<{
    taskPipelines: TaskPipeline[];
    canCreateWorkspaceTaskPipelines: boolean;
  }>(GET_TASK_PIPELINES, { client, fetchPolicy: 'cache-and-network' });

  const [createMutation] = useMutation<{ createTaskPipeline: TaskPipeline }>(
    CREATE_TASK_PIPELINE,
    { client },
  );
  const [updateMutation] = useMutation(UPDATE_TASK_PIPELINE, { client });
  const [deleteMutation] = useMutation(DELETE_TASK_PIPELINE, { client });
  const [saveStagesMutation] = useMutation(SAVE_TASK_PIPELINE_STAGES, { client });
  const [addMemberMutation] = useMutation(ADD_TASK_PIPELINE_MEMBER, { client });
  const [updateMemberMutation] = useMutation(UPDATE_TASK_PIPELINE_MEMBER, { client });
  const [removeMemberMutation] = useMutation(REMOVE_TASK_PIPELINE_MEMBER, { client });
  const [connectFathomMutation] = useMutation(CONNECT_FATHOM, { client });
  const [disconnectFathomMutation] = useMutation(DISCONNECT_FATHOM, { client });
  const [syncFathomMutation] = useMutation<{
    syncFathomConnection: {
      meetingsProcessed: number;
      tasksCreated: number;
      actionItemsSeen: number;
      error: string | null;
    };
  }>(SYNC_FATHOM, { client });

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const createPipeline = async (input: {
    name: string;
    color: string;
    visibility: TaskPipelineVisibility;
  }) => {
    const result = await createMutation({ variables: { input } });

    await reload();

    return result.data?.createTaskPipeline ?? null;
  };

  const updatePipeline = async (
    pipelineId: string,
    input: { name?: string; color?: string; labels?: TaskPipelineLabel[] },
  ) => {
    await updateMutation({ variables: { pipelineId, input } });
    await reload();
  };

  const deletePipeline = async (pipelineId: string) => {
    await deleteMutation({ variables: { pipelineId } });
    await reload();
  };

  const saveStages = async (
    pipelineId: string,
    stages: StageDraft[],
    moveTasksToStageId: string | null,
  ) => {
    await saveStagesMutation({
      variables: {
        pipelineId,
        stages: stages.map((stage) => ({
          id: stage.id ?? null,
          name: stage.name,
          color: stage.color,
          isDone: stage.isDone ?? false,
        })),
        moveTasksToStageId,
      },
    });
    await reload();
  };

  const addMember = async (pipelineId: string, workspaceMemberId: string, role: TaskPipelineRole) => {
    await addMemberMutation({
      variables: { pipelineId, memberWorkspaceMemberId: workspaceMemberId, role },
    });
    await reload();
  };

  const updateMember = async (
    pipelineId: string,
    workspaceMemberId: string,
    patch: { role?: TaskPipelineRole; aliases?: string[] },
  ) => {
    await updateMemberMutation({
      variables: {
        pipelineId,
        memberWorkspaceMemberId: workspaceMemberId,
        role: patch.role ?? null,
        aliases: patch.aliases ?? null,
      },
    });
    await reload();
  };

  const removeMember = async (pipelineId: string, workspaceMemberId: string) => {
    await removeMemberMutation({
      variables: { pipelineId, memberWorkspaceMemberId: workspaceMemberId },
    });
    await reload();
  };

  const connectFathom = async (pipelineId: string, label: string, apiKey: string) => {
    await connectFathomMutation({ variables: { pipelineId, label, apiKey } });
    await reload();
  };

  const disconnectFathom = async (connectionId: string) => {
    await disconnectFathomMutation({ variables: { connectionId } });
    await reload();
  };

  const syncFathom = async (connectionId: string) => {
    const result = await syncFathomMutation({ variables: { connectionId } });

    await reload();

    return result.data?.syncFathomConnection ?? null;
  };

  return {
    pipelines: data?.taskPipelines ?? [],
    canCreateWorkspacePipelines: data?.canCreateWorkspaceTaskPipelines ?? false,
    isLoading: loading && !data,
    error,
    reload,
    createPipeline,
    updatePipeline,
    deletePipeline,
    saveStages,
    addMember,
    updateMember,
    removeMember,
    connectFathom,
    disconnectFathom,
    syncFathom,
  };
};
