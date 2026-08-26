import { Column, Container, Row } from 'react-email';
import { type I18n } from '@lingui/core';

import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

// PTS AI branding (fork: gtm-ship-it/twenty, branch ptsai-emails). Upstream footer pointed to twenty.com.
export const Footer = ({ i18n }: FooterProps) => {
  return (
    <Container style={footerContainerStyle}>
      <Row>
        <Column>
          <ShadowText>
            <Link
              href="https://www.ptsai.ai/"
              value={i18n._('Website')}
              aria-label={i18n._("Visit PTS AI's website")}
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="https://app.crm.pts-automation.cloud/"
              value={i18n._('Open CRM')}
              aria-label={i18n._('Open the PTS AI CRM')}
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="mailto:gtm@ptstax.com"
              value={i18n._('Support')}
              aria-label={i18n._('Email PTS AI support')}
            />
          </ShadowText>
        </Column>
      </Row>
      <Row>
        <ShadowText>
          {i18n._('PTS AI \u00b7 AI-assisted growth engines for multi-branch businesses')}
        </ShadowText>
      </Row>
    </Container>
  );
};
