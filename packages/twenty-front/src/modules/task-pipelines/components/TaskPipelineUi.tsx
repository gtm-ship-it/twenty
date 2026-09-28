import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Avatar } from 'twenty-ui/data-display';
import { IconChevronDown, IconX } from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type TaskMemberInfo } from '@/task-pipelines/hooks/useWorkspaceMembersById';

// Piezas visuales compartidas por Tasks y Reuniones (mismo lenguaje que el
// módulo Email del fork: overlay + tarjeta, campos sobrios, tags de color).

const StyledOverlay = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.overlayPrimary};
  display: flex;
  inset: 0;
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
  position: fixed;
  z-index: 1000;
`;

const StyledCard = styled.div<{ width: number }>`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 32px);
  max-width: 100%;
  overflow: hidden;
  width: ${({ width }) => `${width}px`};
`;

const StyledCardHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledCardTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledCardFooter = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

export const TaskModal = ({
  title,
  width = 480,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  width?: number;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  // Foco dentro del modal al abrir; se devuelve a donde estaba al cerrar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const firstField = cardRef.current?.querySelector<HTMLElement>(
      'input, textarea, select',
    );

    (firstField ?? cardRef.current)?.focus();

    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <StyledOverlay onMouseDown={onClose}>
      <StyledCard
        ref={cardRef}
        tabIndex={-1}
        width={width}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <StyledCardHeader>
          <StyledCardTitle id={titleId}>{title}</StyledCardTitle>
          <IconButton
            Icon={IconX}
            size="small"
            variant="tertiary"
            onClick={onClose}
            ariaLabel={t`Close`}
          />
        </StyledCardHeader>
        <StyledCardBody>{children}</StyledCardBody>
        {footer !== undefined && footer !== null && (
          <StyledCardFooter>{footer}</StyledCardFooter>
        )}
      </StyledCard>
    </StyledOverlay>
  );
};

export const StyledFieldLabel = styled.label`
  color: ${themeCssVariables.font.color.tertiary};
  display: block;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  letter-spacing: 0.02em;
  margin-bottom: ${themeCssVariables.spacing[1]};
  text-transform: uppercase;
`;

export const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
`;

export const StyledErrorText = styled.div`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const StyledTextInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

export const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.5;
  min-height: 90px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  resize: vertical;
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

export const StyledSelect = styled.select`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

export const StyledRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

export const StyledColorDot = styled.span<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  height: 10px;
  width: 10px;
`;

export const StyledSegmented = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: inline-flex;
  gap: 2px;
  padding: 2px;
`;

export const StyledSegment = styled.button<{ isActive: boolean }>`
  align-items: center;
  background: ${({ isActive }) =>
    isActive ? themeCssVariables.background.primary : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${({ isActive }) =>
    isActive ? themeCssVariables.boxShadow.light : 'none'};
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

// --------------------------------------------------------------- personas

const StyledMemberButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  max-width: 100%;
  min-height: 30px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledMemberMenu = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  box-sizing: border-box;
  min-width: 220px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[1]};
  position: fixed;
  z-index: 2000;
`;

const StyledChevron = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-flex;
  margin-left: auto;
`;

const StyledMemberOption = styled.button<{ isSelected: boolean }>`
  align-items: center;
  background: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledMemberSearch = styled.input`
  background: transparent;
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  margin-bottom: ${themeCssVariables.spacing[1]};
  outline: none;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledMuted = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

export const MemberAvatar = ({
  member,
  size = 'sm',
}: {
  member: TaskMemberInfo | null | undefined;
  size?: 'xs' | 'sm' | 'md';
}) => (
  <Avatar
    size={size}
    type="rounded"
    avatarUrl={member?.avatarUrl ?? null}
    placeholder={member?.fullName ?? '?'}
    placeholderColorSeed={member?.id ?? 'unassigned'}
  />
);

export const MemberPicker = ({
  members,
  value,
  onChange,
  allowUnassigned = true,
  placeholder,
}: {
  members: TaskMemberInfo[];
  value: string | null;
  onChange: (workspaceMemberId: string | null) => void;
  allowUnassigned?: boolean;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const selected = members.find((member) => member.id === value) ?? null;

  // El menú flota por encima de modales/paneles con scroll (position: fixed),
  // y se abre hacia arriba si abajo no cabe.
  const openMenu = () => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (rect !== undefined) {
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(300, openUp ? spaceAbove : spaceBelow);

      setMenuStyle({
        left: rect.left,
        maxHeight,
        width: Math.max(rect.width, 240),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    }

    setIsOpen(true);
  };

  // Esc cierra solo el menú, no el panel/modal que lo contiene.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);

    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) !== true &&
        menuRef.current?.contains(target) !== true
      ) {
        setIsOpen(false);
      }
    };
    // Un scroll de la página movería el botón: se cierra el menú (salvo el propio scroll del menú).
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node) !== true) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);

    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen]);

  const filtered = members.filter((member) =>
    `${member.fullName} ${member.email ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <StyledMemberButton
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
      >
        {selected ? (
          <>
            <MemberAvatar member={selected} size="xs" />
            {selected.fullName}
          </>
        ) : (
          <StyledMuted>{placeholder ?? t`Unassigned`}</StyledMuted>
        )}
        <StyledChevron>
          <IconChevronDown size={14} />
        </StyledChevron>
      </StyledMemberButton>
      {isOpen && (
        <StyledMemberMenu ref={menuRef} style={menuStyle} role="listbox">
          {members.length > 6 && (
            <StyledMemberSearch
              autoFocus
              aria-label={t`Search people`}
              placeholder={t`Search people`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
          {allowUnassigned && (
            <StyledMemberOption
              type="button"
              isSelected={value === null}
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
            >
              <StyledMuted>{t`Unassigned`}</StyledMuted>
            </StyledMemberOption>
          )}
          {filtered.map((member) => (
            <StyledMemberOption
              key={member.id}
              type="button"
              isSelected={member.id === value}
              onClick={() => {
                onChange(member.id);
                setIsOpen(false);
                setSearch('');
              }}
            >
              <MemberAvatar member={member} size="xs" />
              <span>
                {member.fullName}
                {member.email && <StyledMuted> · {member.email}</StyledMuted>}
              </span>
            </StyledMemberOption>
          ))}
          {filtered.length === 0 && (
            <StyledMuted style={{ padding: 8 }}>{t`No matches`}</StyledMuted>
          )}
        </StyledMemberMenu>
      )}
    </div>
  );
};

export const PRIORITY_META: Record<
  string,
  { label: () => string; color: string }
> = {
  URGENT: { label: () => t`Urgent`, color: 'red' },
  HIGH: { label: () => t`High`, color: 'orange' },
  MEDIUM: { label: () => t`Medium`, color: 'yellow' },
  LOW: { label: () => t`Low`, color: 'gray' },
};
