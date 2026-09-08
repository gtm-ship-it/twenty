import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import { IconChevronDown, IconChevronUp, IconTrash } from 'twenty-ui/icon';
import { Button, IconButton } from 'twenty-ui/input';
import { MAIN_COLOR_NAMES } from 'twenty-ui/theme';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';
import { v4 } from 'uuid';

import {
  DEFAULT_PIPELINE_COLUMNS,
  type InboxPipeline,
  type InboxPipelineColumn,
  type InboxPipelineMode,
} from '@/inbox/types/InboxPipeline';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';

const StyledOverlay = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.overlayPrimary};
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 1000;
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-height: 90vh;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]};
  width: 440px;
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledModeRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 64px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
`;

const StyledButtonsRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

const StyledStagesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledStageRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledStageTagButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
`;

const StyledStageNameInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledDeleteContainer = styled.div`
  margin-right: auto;
`;

type PipelineEditorModalProps = {
  pipeline: InboxPipeline | null;
  onSave: (pipeline: InboxPipeline) => void;
  onDelete?: (pipelineId: string) => void;
  onClose: () => void;
};

export const PipelineEditorModal = ({
  pipeline,
  onSave,
  onDelete,
  onClose,
}: PipelineEditorModalProps) => {
  const [name, setName] = useState(pipeline?.name ?? '');
  const [mode, setMode] = useState<InboxPipelineMode>(
    pipeline?.mode ?? 'EXCLUDE',
  );
  const [rulesText, setRulesText] = useState(
    (pipeline?.rules ?? []).join('\n'),
  );
  const [columns, setColumns] = useState<InboxPipelineColumn[]>(
    pipeline?.columns?.length
      ? pipeline.columns
      : DEFAULT_PIPELINE_COLUMNS.map((column) => ({ ...column })),
  );

  const updateColumn = (index: number, patch: Partial<InboxPipelineColumn>) => {
    setColumns((previous) =>
      previous.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...patch } : column,
      ),
    );
  };

  const cycleColumnColor = (index: number) => {
    const currentColor = columns[index].color;
    const colorIndex = MAIN_COLOR_NAMES.indexOf(
      currentColor as (typeof MAIN_COLOR_NAMES)[number],
    );
    const nextColor =
      MAIN_COLOR_NAMES[(colorIndex + 1) % MAIN_COLOR_NAMES.length];

    updateColumn(index, { color: nextColor });
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    setColumns((previous) => {
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }

      const next = [...previous];

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

      return next;
    });
  };

  const removeColumn = (index: number) => {
    setColumns((previous) =>
      previous.length > 1
        ? previous.filter((_, columnIndex) => columnIndex !== index)
        : previous,
    );
  };

  const handleSave = () => {
    const rules = rulesText
      .split(/[\n,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);

    const sanitizedColumns = columns
      .map((column) => ({ ...column, name: column.name.trim() }))
      .filter((column) => column.name.length > 0);

    onSave({
      id: pipeline?.id ?? v4(),
      name: name.trim() || t`Pipeline`,
      mode,
      rules,
      columns:
        sanitizedColumns.length > 0
          ? sanitizedColumns
          : DEFAULT_PIPELINE_COLUMNS,
      cardColumns: pipeline?.cardColumns ?? {},
    });
  };

  return (
    <StyledOverlay onClick={onClose}>
      <StyledCard onClick={(event) => event.stopPropagation()}>
        <H2Title
          title={pipeline ? t`Edit pipeline` : t`New pipeline`}
          description={t`A board for this inbox's emails, with your own rules and columns. Only visible to you.`}
        />
        <SettingsTextInput
          instanceId="pipeline-name"
          label={t`Name`}
          placeholder={t`e.g. Sales`}
          value={name}
          onChange={setName}
          fullWidth
        />
        <div>
          <StyledFieldLabel>{t`Which emails enter this pipeline?`}</StyledFieldLabel>
          <StyledModeRow>
            <Button
              title={t`All except these`}
              size="small"
              variant="secondary"
              accent={mode === 'EXCLUDE' ? 'blue' : 'default'}
              onClick={() => setMode('EXCLUDE')}
            />
            <Button
              title={t`Only these`}
              size="small"
              variant="secondary"
              accent={mode === 'ONLY' ? 'blue' : 'default'}
              onClick={() => setMode('ONLY')}
            />
          </StyledModeRow>
        </div>
        <div>
          <StyledFieldLabel>
            {mode === 'EXCLUDE' ? t`Addresses to exclude` : t`Addresses to include`}
          </StyledFieldLabel>
          <StyledTextArea
            value={rulesText}
            onChange={(event) => setRulesText(event.target.value)}
            placeholder={'maria@acme.com\n@internaldomain.com'}
          />
          <StyledHint>
            {t`One per line. Use @domain.com to match a whole domain.`}
          </StyledHint>
        </div>
        <div>
          <StyledFieldLabel>{t`Stages`}</StyledFieldLabel>
          <StyledStagesList>
            {columns.map((column, index) => (
              <StyledStageRow key={index}>
                <StyledStageTagButton
                  type="button"
                  title={t`Click to change color`}
                  onClick={() => cycleColumnColor(index)}
                >
                  <Tag
                    color={column.color as TagColor}
                    text={column.name || '…'}
                  />
                </StyledStageTagButton>
                <StyledStageNameInput
                  value={column.name}
                  onChange={(event) =>
                    updateColumn(index, { name: event.target.value })
                  }
                />
                <IconButton
                  Icon={IconChevronUp}
                  size="small"
                  variant="tertiary"
                  disabled={index === 0}
                  onClick={() => moveColumn(index, -1)}
                />
                <IconButton
                  Icon={IconChevronDown}
                  size="small"
                  variant="tertiary"
                  disabled={index === columns.length - 1}
                  onClick={() => moveColumn(index, 1)}
                />
                <IconButton
                  Icon={IconTrash}
                  size="small"
                  variant="tertiary"
                  disabled={columns.length <= 1}
                  onClick={() => removeColumn(index)}
                />
              </StyledStageRow>
            ))}
          </StyledStagesList>
          <StyledHint>{t`Click the colored tag to change the stage color.`}</StyledHint>
          <Button
            title={t`+ Add stage`}
            size="small"
            variant="secondary"
            onClick={() =>
              setColumns((previous) => [
                ...previous,
                { name: '', color: 'gray' },
              ])
            }
          />
        </div>
        <StyledButtonsRow>
          {pipeline && onDelete && (
            <StyledDeleteContainer>
              <Button
                title={t`Delete`}
                variant="secondary"
                accent="danger"
                size="small"
                onClick={() => onDelete(pipeline.id)}
              />
            </StyledDeleteContainer>
          )}
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button title={t`Save`} accent="blue" onClick={handleSave} />
        </StyledButtonsRow>
      </StyledCard>
    </StyledOverlay>
  );
};
