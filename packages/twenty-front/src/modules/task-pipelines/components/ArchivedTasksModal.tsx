import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconArrowBackUp } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import {
  StyledHint,
  StyledTextInput,
  TaskModal,
} from '@/task-pipelines/components/TaskPipelineUi';
import { GET_PIPELINE_TASKS } from '@/task-pipelines/graphql/taskPipelinesDocuments';
import { type PipelineTask } from '@/task-pipelines/types/TaskPipelineTypes';

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  max-height: 60vh;
  overflow-y: auto;
`;

const StyledRow = styled.div`
  align-items: center;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledRowText = styled.div`
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex: 1;
  flex-direction: column;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  gap: 2px;
  min-width: 0;

  span {
    color: ${themeCssVariables.font.color.tertiary};
    font-size: ${themeCssVariables.font.size.xs};
  }
`;

type ArchivedTasksModalProps = {
  pipelineId: string;
  stageName: (stageId: string) => string;
  onRestore: (taskId: string) => Promise<void>;
  onClose: () => void;
};

// Como "Elementos archivados" de Trello: lo archivado sale del tablero pero
// no se borra; desde aquí se ve y se devuelve a su columna.
export const ArchivedTasksModal = ({
  pipelineId,
  stageName,
  onRestore,
  onClose,
}: ArchivedTasksModalProps) => {
  const client = useApolloCoreClient();
  const [search, setSearch] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const query = useQuery<{ taskPipelineTasks: PipelineTask[] }>(
    GET_PIPELINE_TASKS,
    {
      client,
      variables: { pipelineId, includeArchived: true },
      fetchPolicy: 'network-only',
    },
  );

  const needle = search.trim().toLowerCase();
  const archived = (query.data?.taskPipelineTasks ?? [])
    .filter((task) => task.archivedAt !== null)
    .filter(
      (task) =>
        needle.length === 0 || task.title.toLowerCase().includes(needle),
    )
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));

  return (
    <TaskModal title={t`Archived tasks`} width={560} onClose={onClose}>
      <StyledTextInput
        aria-label={t`Search archived tasks`}
        placeholder={t`Search archived tasks`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {query.loading && !query.data ? (
        <StyledHint>{t`Loading…`}</StyledHint>
      ) : archived.length === 0 ? (
        <StyledHint>{t`No archived tasks.`}</StyledHint>
      ) : (
        <StyledList>
          {archived.map((task) => (
            <StyledRow key={task.id}>
              <StyledRowText>
                {task.title}
                <span>
                  {stageName(task.stageId)}
                  {task.archivedAt &&
                    ` · ${t`archived`} ${new Date(task.archivedAt).toLocaleDateString()}`}
                </span>
              </StyledRowText>
              <Button
                title={restoringId === task.id ? t`Restoring…` : t`Restore`}
                size="small"
                variant="secondary"
                Icon={IconArrowBackUp}
                disabled={restoringId !== null}
                onClick={async () => {
                  setRestoringId(task.id);

                  try {
                    await onRestore(task.id);
                    await query.refetch();
                  } finally {
                    setRestoringId(null);
                  }
                }}
              />
            </StyledRow>
          ))}
        </StyledList>
      )}
    </TaskModal>
  );
};
