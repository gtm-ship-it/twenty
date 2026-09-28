// Solo http(s): cualquier otro esquema (javascript:, data:, …) se descarta.
export const safeHttpUrl = (
  value: string | null | undefined,
): string | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  try {
    const url = new URL(value.trim());

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};
