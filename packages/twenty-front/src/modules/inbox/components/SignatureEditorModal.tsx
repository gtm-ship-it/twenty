import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

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
  width: 560px;
`;

const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: monospace;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 120px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
`;

const StyledHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledPreviewLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledPreview = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px dashed ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  min-height: 60px;
  padding: ${themeCssVariables.spacing[3]};

  img {
    max-height: 80px;
    max-width: 100%;
  }
`;

const StyledButtonsRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

type SignatureEditorModalProps = {
  signature: string;
  isSaving: boolean;
  onSave: (signatureHtml: string) => void;
  onClose: () => void;
};

export const SignatureEditorModal = ({
  signature,
  isSaving,
  onSave,
  onClose,
}: SignatureEditorModalProps) => {
  const [draft, setDraft] = useState(signature);

  return (
    <StyledOverlay onClick={onClose}>
      <StyledCard onClick={(event) => event.stopPropagation()}>
        <H2Title
          title={t`Email signature`}
          description={t`Appended at the end of every email you send from the CRM.`}
        />
        <StyledTextArea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            'Yeison Botero<br/>PTS AI<br/><img src="https://www.ptsai.ai/logo.png" height="40"/>'
          }
        />
        <StyledHint>
          {t`Plain text and HTML are supported. Use <br/> for line breaks and <img src="https://..."/> for your logo.`}
        </StyledHint>
        <div>
          <StyledPreviewLabel>{t`Preview`}</StyledPreviewLabel>
          <StyledPreview
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: draft || `<i>${t`Empty signature`}</i>`,
            }}
          />
        </div>
        <StyledButtonsRow>
          <Button title={t`Cancel`} variant="secondary" onClick={onClose} />
          <Button
            title={isSaving ? t`Saving...` : t`Save`}
            accent="blue"
            disabled={isSaving}
            onClick={() => onSave(draft)}
          />
        </StyledButtonsRow>
      </StyledCard>
    </StyledOverlay>
  );
};
