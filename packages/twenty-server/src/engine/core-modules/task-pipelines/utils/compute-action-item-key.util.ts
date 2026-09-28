import { createHash } from 'crypto';

import { normalizePersonName } from 'src/engine/core-modules/task-pipelines/utils/normalize-person-name.util';

// Fathom no da id por accionable: la clave es reunión + segundo + texto normalizado.
export const computeActionItemKey = ({
  recordingId,
  recordingTimestamp,
  description,
}: {
  recordingId: string;
  recordingTimestamp: string | null;
  description: string;
}): string =>
  createHash('sha256')
    .update(
      `${recordingId}|${recordingTimestamp ?? ''}|${normalizePersonName(description)}`,
    )
    .digest('hex')
    .slice(0, 40);
