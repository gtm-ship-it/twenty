export const timestampToSeconds = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  return value
    .split(':')
    .map((part) => Number(part) || 0)
    .reduce((total, part) => total * 60 + part, 0);
};
