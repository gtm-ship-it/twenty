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
  position: relative;
`;

const StyledStageTagButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
`;

const StyledColorPickerPopup = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  left: 0;
  padding: ${themeCssVariables.spacing[2]};
  position: absolute;
  top: calc(100% + 4px);
  z-index: 10;
`;

const StyledColorSwatch = styled.button<{ isActive: boolean }>`
  border: 2px solid
    ${({ isActive }) =>
      isActive ? themeCssVariables.font.color.primary : 'transparent'};
  border-radius: 50%;
  cursor: pointer;
  height: 20px;
  padding: 0;
  width: 20px;

  &:hover {
    border-color: ${themeCssVariables.font.color.tertiary};
  }
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

const StyledRuleInputRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledRuleChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledRuleChip = styled.span`
  align-items: center;
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledRuleChipRemove = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: 0;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledAccountsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledAccountRow = styled.label`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDeleteContainer = styled.div`
  margin-right: auto;
`;

type PipelineEditorAccount = {
  id: string;
  handle: string;
};

type PipelineEditorModalProps = {
  pipeline: InboxPipeline | null;
  accounts: PipelineEditorAccount[];
  onSave: (pipeline: InboxPipeline) => void;
  onDelete?: (pipelineId: string) => void;
  onClose: () => void;
};

export const PipelineEditorModal = ({
  pipeline,
  accounts,
  onSave,
  onDelete,
  onClose,
}: PipelineEditorModalProps) => {
  const [name, setName] = useState(pipeline?.name ?? '');
  const [mode, setMode] = useState<InboxPipelineMode>(
    pipeline?.mode ?? 'EXCLUDE',
  );
  const [rules, setRules] = useState<string[]>(pipeline?.rules ?? []);
  const [ruleInput, setRuleInput] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>(
    pipeline?.accountIds ?? [],
  );

  const addRule = () => {
    const entry = ruleInput.trim().toLowerCase();

    if (entry.length === 0 || rules.includes(entry)) {
      setRuleInput('');
      return;
    }

    setRules([...rules, entry]);
    setRuleInput('');
  };

  const toggleAccount = (accountId: string) => {
    setAccountIds((previous) =>
      previous.includes(accountId)
        ? previous.filter((id) => id !== accountId)
        : [...previous, accountId],
    );
  };
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

  const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(
    null,
  );

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
    const sanitizedColumns = columns
      .map((column) => ({ ...column, name: column.name.trim() }))
      .filter((column) => column.name.length > 0);

    onSave({
      id: pipeline?.id ?? v4(),
      name: name.trim() || t`Pipeline`,
      mode,
      rules,
      accountIds,
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
          <StyledRuleInputRow>
            <StyledStageNameInput
              value={ruleInput}
              onChange={(event) => setRuleInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addRule();
                }
              }}
              placeholder={t`maria@acme.com or @acme.com`}
            />
            <Button
              title={t`Add`}
              size="small"
              variant="secondary"
              accent="blue"
              disabled={ruleInput.trim().length === 0}
              onClick={addRule}
            />
          </StyledRuleInputRow>
          {rules.length > 0 && (
            <StyledRuleChips>
              {rules.map((rule) => (
                <StyledRuleChip key={rule}>
                  {rule}
                  <StyledRuleChipRemove
                    type="button"
                    onClick={() =>
                      setRules(rules.filter((entry) => entry !== rule))
                    }
                  >
                    ✕
                  </StyledRuleChipRemove>
                </StyledRuleChip>
              ))}
            </StyledRuleChips>
          )}
          <StyledHint>
            {t`Use @domain.com to match a whole domain.`}
          </StyledHint>
        </div>
        <div>
          <StyledFieldLabel>{t`Inboxes feeding this pipeline`}</StyledFieldLabel>
          <StyledAccountsList>
            <StyledAccountRow>
              <input
                type="checkbox"
                checked={accountIds.length === 0}
                onChange={() => setAccountIds([])}
              />
              {t`All my accounts`}
            </StyledAccountRow>
            {accounts.map((account) => (
              <StyledAccountRow key={account.id}>
                <input
                  type="checkbox"
                  checked={accountIds.includes(account.id)}
                  onChange={() => toggleAccount(account.id)}
                />
                {account.handle}
              </StyledAccountRow>
            ))}
          </StyledAccountsList>
        </div>
        <div>
          <StyledFieldLabel>{t`Stages`}</StyledFieldLabel>
          <StyledStagesList>
            {columns.map((column, index) => (
              <StyledStageRow key={index}>
                <StyledStageTagButton
                  type="button"
                  title={t`Click to change color`}
                  onClick={() =>
                    setColorPickerIndex(
                      colorPickerIndex === index ? null : index,
                    )
                  }
                >
                  <Tag
                    color={column.color as TagColor}
                    text={column.name || '…'}
                  />
                </StyledStageTagButton>
                {colorPickerIndex === index && (
                  <StyledColorPickerPopup>
                    {MAIN_COLOR_NAMES.map((colorName) => (
                      <StyledColorSwatch
                        key={colorName}
                        type="button"
                        isActive={column.color === colorName}
                        style={{
                          background:
                            themeCssVariables.tag.background[colorName],
                        }}
                        onClick={() => {
                          updateColumn(index, { color: colorName });
                          setColorPickerIndex(null);
                        }}
                      />
                    ))}
                  </StyledColorPickerPopup>
                )}
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
