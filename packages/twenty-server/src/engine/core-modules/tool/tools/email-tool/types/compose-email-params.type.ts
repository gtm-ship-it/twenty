import { type EmailAttachment } from 'twenty-shared/types';
import { type EmailDocument } from 'twenty-shared/utils';

export type ComposeEmailParams = {
  recipients: {
    to: string;
    cc?: string;
    bcc?: string;
  };
  subject: string;
  body: string | EmailDocument;
  connectedAccountId?: string;
  files?: Array<EmailAttachment>;
  inReplyTo?: string;
  // La firma llega como HTML aparte, NO concatenada al body: el body es un
  // documento TipTap serializado y pegarle HTML lo invalida (el servidor
  // dejaba de parsearlo y enviaba el JSON crudo al destinatario).
  signatureHtml?: string;
};
