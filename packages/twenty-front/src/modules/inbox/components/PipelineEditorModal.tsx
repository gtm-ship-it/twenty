import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';
import { v4 } from 'uuid';

import {
  DEFAULT_PIPELINE_COLUMNS,
  type InboxPipeline,
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
  const [columnsText, setColumnsText] = useState(
    (pipeline?.columns ?? DEFAULT_PIPELINE_COLUMNS).join(', '),
  );

  const handleSave = () => {
    const rules = rulesText
      .split(/[\n,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);

    const columns = columnsText
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    onSave({
      id: pipeline?.id ?? v4(),
      name: name.trim() || t`Pipeline`,
      mode,
      rules,
      columns: columns.length > 0 ? columns : DEFAULT_PIPELINE_COLUMNS,
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
          <StyledFieldLabel>{t`Columns (comma separated)`}</StyledFieldLabel>
          <StyledTextArea
            value={columnsText}
            onChange={(event) => setColumnsText(event.target.value)}
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
