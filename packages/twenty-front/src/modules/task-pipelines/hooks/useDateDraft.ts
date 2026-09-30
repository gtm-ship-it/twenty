import { type KeyboardEvent, useEffect, useState } from 'react';

import {
  dueFromInputValue,
  dueInputValue,
} from '@/task-pipelines/utils/taskDueStatus';

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

// <input type="date"> dispara un cambio por cada dígito del año (0002, 0020,
// 0202, 2026…). Se edita en local y se guarda al salir del campo o con Enter,
// y un año imposible se descarta.
export const useDateDraft = (
  value: string | null,
  onCommit: (next: string | null) => void,
) => {
  const serverValue = dueInputValue(value);
  const [draft, setDraft] = useState(serverValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(serverValue);
    }
  }, [serverValue, isEditing]);

  const commit = () => {
    setIsEditing(false);

    if (draft === serverValue) {
      return;
    }

    if (draft === '') {
      onCommit(null);

      return;
    }

    const year = Number(draft.slice(0, 4));

    if (!Number.isFinite(year) || year < MIN_YEAR || year > MAX_YEAR) {
      setDraft(serverValue);

      return;
    }

    onCommit(dueFromInputValue(draft));
  };

  return {
    value: draft,
    onFocus: () => setIsEditing(true),
    onChange: (event: { target: { value: string } }) => {
      setIsEditing(true);
      setDraft(event.target.value);
    },
    onBlur: commit,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.currentTarget.blur();
      }
    },
  };
};
