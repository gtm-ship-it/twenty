// "José  Pérez-Gómez" -> "jose perez gomez". Base de toda comparación de nombres.
export const normalizePersonName = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeEmail = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
