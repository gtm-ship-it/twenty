export type TaskDueStatus = 'overdue' | 'today' | 'soon' | 'later' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const getTaskDueStatus = (
  dueAt: string | null,
  isDone: boolean,
  now: Date = new Date(),
): TaskDueStatus => {
  if (!dueAt || isDone) {
    return 'none';
  }

  const due = new Date(dueAt);
  const dayDiff = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);

  if (dayDiff < 0) {
    return 'overdue';
  }

  if (dayDiff === 0) {
    return 'today';
  }

  return dayDiff <= 3 ? 'soon' : 'later';
};

export const formatTaskDueDate = (dueAt: string, locale?: string): string =>
  new Date(dueAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

// <input type="date"> trabaja con YYYY-MM-DD local; guardamos fin del día local.
export const dueInputValue = (dueAt: string | null): string => {
  if (!dueAt) {
    return '';
  }

  const date = new Date(dueAt);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const dueFromInputValue = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day, 17, 0, 0).toISOString();
};
