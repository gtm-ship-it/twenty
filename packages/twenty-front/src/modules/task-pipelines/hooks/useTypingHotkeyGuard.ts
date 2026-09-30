import { type FocusEvent, useCallback, useEffect, useId } from 'react';

import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }

  if (target.tagName !== 'INPUT') {
    return false;
  }

  const type = (target as HTMLInputElement).type;

  return !['checkbox', 'radio', 'button', 'submit', 'file', 'range'].includes(
    type,
  );
};

// Twenty tiene atajos globales sin modificador ("g" + letra = ir a Notas,
// Empresas…) que también se disparan dentro de campos de texto, salvo que el
// campo avise a la pila de foco. Nuestros campos son <input>/<textarea>
// nativos: este guard lo hace por todos. Se pone en el contenedor de la página
// (onFocus/onBlur de React burbujean también desde portales y modales).
export const useTypingHotkeyGuard = () => {
  const focusId = `ptsai-typing-${useId()}`;
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

  const onFocus = useCallback(
    (event: FocusEvent) => {
      if (!isTypingTarget(event.target)) {
        return;
      }

      pushFocusItemToFocusStack({
        focusId,
        component: { type: FocusComponentType.TEXT_INPUT, instanceId: focusId },
        globalHotkeysConfig: {
          enableGlobalHotkeysConflictingWithKeyboard: false,
        },
      });
    },
    [focusId, pushFocusItemToFocusStack],
  );

  const onBlur = useCallback(
    (event: FocusEvent) => {
      // Pasar de un campo a otro no debe reactivar los atajos.
      if (isTypingTarget(event.relatedTarget)) {
        return;
      }

      removeFocusItemFromFocusStackById({ focusId });
    },
    [focusId, removeFocusItemFromFocusStackById],
  );

  // Un campo que desaparece con el foco (se cierra el panel, se borra la
  // tarjeta) no dispara blur: antes de cada tecla se comprueba dónde está el
  // foco de verdad, así los atajos nunca quedan apagados fuera de un campo.
  useEffect(() => {
    const onKeyDownCapture = () => {
      if (!isTypingTarget(document.activeElement)) {
        removeFocusItemFromFocusStackById({ focusId });
      }
    };

    window.addEventListener('keydown', onKeyDownCapture, true);

    return () => {
      window.removeEventListener('keydown', onKeyDownCapture, true);
      removeFocusItemFromFocusStackById({ focusId });
    };
  }, [focusId, removeFocusItemFromFocusStackById]);

  return { onFocus, onBlur };
};
