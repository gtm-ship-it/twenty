import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconLock, IconUsers } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { MAIN_COLOR_NAMES } from 'twenty-ui/theme';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  StyledErrorText,
  StyledFieldLabel,
  StyledHint,
  StyledTextInput,
  TaskModal,
} from '@/task-pipelines/components/TaskPipelineUi';
import { type TaskPipelineVisibility } from '@/task-pipelines/types/TaskPipelineTypes';

const StyledOptions = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: 1fr 1fr;
`;

const StyledOption = styled.button<{ isActive: boolean }>`
  background: ${({ isActive }) =>
    isActive ? themeCssVariables.accent.quaternary : themeCssVariables.background.primary};
  border: 1px solid
    ${({ isActive }) => (isActive ? themeCssVariables.color.blue : themeCssVariables.border.color.medium)};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]};
  text-align: left;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const StyledOptionTitle = styled.span`
  align-items: center;
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSwatches = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSwatch = styled.button<{ isActive: boolean }>`
  border: 2px solid ${({ isActive }) => (isActive ? themeCssVariables.font.color.primary : 'transparent')};
  border-radius: 50%;
  cursor: pointer;
  height: 22px;
  padding: 0;
  width: 22px;
`;

export const PipelineColorSwatches = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) => (
  <StyledSwatches>
    {MAIN_COLOR_NAMES.map((colorName) => (
      <StyledSwatch
        key={colorName}
        type="button"
        aria-label={colorName}
        isActive={value === colorName}
        style={{ background: themeCssVariables.tag.background[colorName] }}
        onClick={() => onChange(colorName)}
      />
    ))}
  </StyledSwatches>
);

export const CreateTaskPipelineModal = ({
  canCreateWorkspacePipelines,
  onCreate,
  onClose,
}: {
  canCreateWorkspacePipelines: boolean;
  onCreate: (input: { name: string; color: string; visibility: TaskPipelineVisibility }) => Promise<void>;
  onClose: () => void;
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [visibility, setVisibility] = useState<TaskPipelineVisibility>(
    canCreateWorkspacePipelines ? 'WORKSPACE' : 'PERSONAL',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length === 0) {
      setError(t`Give the pipeline a name`);

      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onCreate({ name: name.trim(), color, visibility });
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : t`Could not create the pipeline`);
      setIsSaving(false);
    }
  };

  return (
    <TaskModal
      title={t`New task pipeline`}
      onClose={onClose}
      footer={
        <>
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button title={t`Create`} accent="blue" disabled={isSaving} onClick={() => void submit()} />
        </>
      }
    >
      <div>
        <StyledFieldLabel htmlFor="task-pipeline-name">{t`Name`}</StyledFieldLabel>
        <StyledTextInput
          id="task-pipeline-name"
          autoFocus
          placeholder={t`e.g. GTM team, Personal, Sunset onboarding`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void submit();
            }
          }}
        />
      </div>
      <div>
        <StyledFieldLabel>{t`Who can see it`}</StyledFieldLabel>
        <StyledOptions>
          <StyledOption
            type="button"
            isActive={visibility === 'WORKSPACE'}
            disabled={!canCreateWorkspacePipelines}
            onClick={() => setVisibility('WORKSPACE')}
          >
            <StyledOptionTitle>
              <IconUsers size={16} />
              {t`Shared`}
            </StyledOptionTitle>
            <StyledHint>
              {canCreateWorkspacePipelines
                ? t`You choose which workspace members join.`
                : t`Only workspace admins can create shared pipelines.`}
            </StyledHint>
          </StyledOption>
          <StyledOption type="button" isActive={visibility === 'PERSONAL'} onClick={() => setVisibility('PERSONAL')}>
            <StyledOptionTitle>
              <IconLock size={16} />
              {t`Personal`}
            </StyledOptionTitle>
            <StyledHint>{t`Private to you. Not even admins see it unless you invite them.`}</StyledHint>
          </StyledOption>
        </StyledOptions>
      </div>
      <div>
        <StyledFieldLabel>{t`Color`}</StyledFieldLabel>
        <PipelineColorSwatches value={color} onChange={setColor} />
      </div>
      <StyledHint>{t`It starts with the stages To do · In progress · Blocked · Done — you can rename, recolor, reorder or replace them in its settings.`}</StyledHint>
      {error && <StyledErrorText>{error}</StyledErrorText>}
    </TaskModal>
  );
};
