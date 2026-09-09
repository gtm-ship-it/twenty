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
  left: 0;
  padding: ${themeCssVariables.spacing[2]};
  position: absolute;
  top: calc(100% + 4px);
  width: 250px;
  z-index: 10;
`;

const StyledColorPickerHeader = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledColorPickerClose = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: 0 ${themeCssVariables.spacing[1]};

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledColorSwatches = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
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

const StyledRuleChip = styled.span<{ isExcluded: boolean }>`
  align-items: center;
  background: ${({ isExcluded }) =>
    isExcluded
      ? themeCssVariables.tag.background.red
      : themeCssVariables.tag.background.green};
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
  const [onlyRules, setOnlyRules] = useState<string[]>(
    pipeline?.onlyRules ?? [],
  );
  const [excludeRules, setExcludeRules] = useState<string[]>(
    pipeline?.excludeRules ?? [],
  );
  const [onlyInput, setOnlyInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>(
    pipeline?.accountIds ?? [],
  );

  const addRule = (
    input: string,
    current: string[],
    setCurrent: (next: string[]) => void,
    clearInput: () => void,
  ) => {
    const entry = input.trim().toLowerCase();

    if (entry.length === 0 || current.includes(entry)) {
      clearInput();
      return;
    }

    setCurrent([...current, entry]);
    clearInput();
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
      onlyRules,
      excludeRules,
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
          <StyledFieldLabel>{t`Only these senders`}</StyledFieldLabel>
          <StyledHint>
            {t`Leave empty to receive everything that is not excluded.`}
          </StyledHint>
          <StyledRuleInputRow>
            <StyledStageNameInput
              value={onlyInput}
              onChange={(event) => setOnlyInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addRule(onlyInput, onlyRules, setOnlyRules, () =>
                    setOnlyInput(''),
                  );
                }
              }}
              placeholder={t`maria@acme.com or @acme.com`}
            />
            <Button
              title={t`Add`}
              size="small"
              variant="secondary"
              accent="blue"
              disabled={onlyInput.trim().length === 0}
              onClick={() =>
                addRule(onlyInput, onlyRules, setOnlyRules, () =>
                  setOnlyInput(''),
                )
              }
            />
          </StyledRuleInputRow>
          {onlyRules.length > 0 && (
            <StyledRuleChips>
              {onlyRules.map((rule) => (
                <StyledRuleChip key={rule} isExcluded={false}>
                  {rule}
                  <StyledRuleChipRemove
                    type="button"
                    onClick={() =>
                      setOnlyRules(onlyRules.filter((entry) => entry !== rule))
                    }
                  >
                    ✕
                  </StyledRuleChipRemove>
                </StyledRuleChip>
              ))}
            </StyledRuleChips>
          )}
        </div>
        <div>
          <StyledFieldLabel>{t`All except these senders`}</StyledFieldLabel>
          <StyledHint>
            {t`Exclusions always win. Use @domain.com to match a whole domain.`}
          </StyledHint>
          <StyledRuleInputRow>
            <StyledStageNameInput
              value={excludeInput}
              onChange={(event) => setExcludeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addRule(excludeInput, excludeRules, setExcludeRules, () =>
                    setExcludeInput(''),
                  );
                }
              }}
              placeholder={t`spam@x.com or @newsletter.com`}
            />
            <Button
              title={t`Add`}
              size="small"
              variant="secondary"
              accent="blue"
              disabled={excludeInput.trim().length === 0}
              onClick={() =>
                addRule(excludeInput, excludeRules, setExcludeRules, () =>
                  setExcludeInput(''),
                )
              }
            />
          </StyledRuleInputRow>
          {excludeRules.length > 0 && (
            <StyledRuleChips>
              {excludeRules.map((rule) => (
                <StyledRuleChip key={rule} isExcluded>
                  {rule}
                  <StyledRuleChipRemove
                    type="button"
                    onClick={() =>
                      setExcludeRules(
                        excludeRules.filter((entry) => entry !== rule),
                      )
                    }
                  >
                    ✕
                  </StyledRuleChipRemove>
                </StyledRuleChip>
              ))}
            </StyledRuleChips>
          )}
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
                    <StyledColorPickerHeader>
                      {t`Pick a color — changes apply live`}
                      <StyledColorPickerClose
                        type="button"
                        onClick={() => setColorPickerIndex(null)}
                      >
                        ✕
                      </StyledColorPickerClose>
                    </StyledColorPickerHeader>
                    <StyledColorSwatches>
                      {MAIN_COLOR_NAMES.map((colorName) => (
                        <StyledColorSwatch
                          key={colorName}
                          type="button"
                          isActive={column.color === colorName}
                          style={{
                            background:
                              themeCssVariables.tag.background[colorName],
                          }}
                          onClick={() =>
                            updateColumn(index, { color: colorName })
                          }
                        />
                      ))}
                    </StyledColorSwatches>
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
