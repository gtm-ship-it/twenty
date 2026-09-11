import { type EmailThreadMessageParticipant } from '@/activities/emails/types/EmailThreadMessageParticipant';
import { type MessageThread } from '@/activities/emails/types/MessageThread';

export type EmailThreadMessage = {
  id: string;
  text: string;
  // HTML saneado en el servidor. Nulo en correos solo-texto y en todo lo
  // importado antes de que existiera el campo.
  bodyHtml: string | null;
  receivedAt: string;
  subject: string;
  headerMessageId: string;
  messageThreadId: string;
  messageParticipants: EmailThreadMessageParticipant[];
  messageThread: MessageThread;
  isDraft: boolean;
  __typename: 'EmailThreadMessage';
};
