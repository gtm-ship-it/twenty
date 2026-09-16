import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconX } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useDebouncedCallback } from 'use-debounce';

import { anyFieldFilterValueComponentState } from '@/object-record/record-filter/states/anyFieldFilterValueComponentState';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';

const StyledContainer = styled.div<{ isActive: boolean }>`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid
    ${({ isActive }) =>
      isActive
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  height: 24px;
  padding-left: ${themeCssVariables.spacing[2]};
  padding-right: ${themeCssVariables.spacing[1]};
  width: 200px;

  &:focus-within {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledInput = styled.input`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  min-width: 0;
  outline: none;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

const StyledClearButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  padding: 0;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

// Barra de búsqueda siempre visible en la vista (tabla y kanban). Escribe en el
// mismo estado que "Filter → Search any field", así que se combina con los
// filtros de la vista y funciona con "seleccionar todo".
export const ViewBarSearchInput = ({ viewBarId }: { viewBarId: string }) => {
  const { t } = useLingui();
  const { objectMetadataItem } = useRecordIndexContextOrThrow();

  const [anyFieldFilterValue, setAnyFieldFilterValue] = useAtomComponentState(
    anyFieldFilterValueComponentState,
    viewBarId,
  );

  const [inputValue, setInputValue] = useState(anyFieldFilterValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Si el valor cambia desde fuera (chip "Any field" quitado, cambio de vista), reflejarlo.
  useEffect(() => {
    setInputValue(anyFieldFilterValue);
  }, [anyFieldFilterValue]);

  const applySearchDebounced = useDebouncedCallback((value: string) => {
    setAnyFieldFilterValue(value);
  }, 250);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    applySearchDebounced(event.target.value);
  };

  const handleClear = () => {
    applySearchDebounced.cancel();
    setInputValue('');
    setAnyFieldFilterValue('');
    inputRef.current?.focus();
  };

  const placeholder = t`Search ${objectMetadataItem.labelPlural.toLowerCase()}…`;

  return (
    <StyledContainer isActive={inputValue.length > 0}>
      <IconSearch size={14} />
      <StyledInput
        ref={inputRef}
        type="text"
        value={inputValue}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            handleClear();
          }
        }}
        aria-label={placeholder}
      />
      {inputValue.length > 0 && (
        <StyledClearButton
          type="button"
          onClick={handleClear}
          aria-label={t`Clear search`}
        >
          <IconX size={14} />
        </StyledClearButton>
      )}
    </StyledContainer>
  );
};
