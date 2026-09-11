// Un color estable por buzon: la misma cuenta sale siempre del mismo color,
// aunque cambie el orden de los eventos o se filtre. Asi se distingue de un
// vistazo lo propio de lo que viene de un buzon compartido.
const ACCOUNT_COLORS = [
  '#3b7de9',
  '#28a745',
  '#c2410c',
  '#7c3aed',
  '#0891b2',
  '#be123c',
  '#a16207',
];

const FALLBACK_COLOR = '#64748b';

export const getAccountColor = (handle: string | null | undefined): string => {
  if (handle === null || handle === undefined || handle.length === 0) {
    return FALLBACK_COLOR;
  }

  let hash = 0;

  for (let index = 0; index < handle.length; index++) {
    hash = (hash * 31 + handle.charCodeAt(index)) | 0;
  }

  return ACCOUNT_COLORS[Math.abs(hash) % ACCOUNT_COLORS.length];
};
