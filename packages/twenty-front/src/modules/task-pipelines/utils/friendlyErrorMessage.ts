import { t } from '@lingui/core/macro';

// Traduce errores técnicos (red, Fathom, validación) a algo que se entienda.
export const friendlyErrorMessage = (
  error: unknown,
  fallback?: string,
): string => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (/rejected the API key/i.test(raw)) {
    return t`Fathom did not accept that API key. Generate a new one in Fathom → Settings → API Access and paste it again.`;
  }

  if (/rate limit/i.test(raw)) {
    return t`Fathom is limiting requests right now. Try again in a minute.`;
  }

  if (/did not answer in time|Could not reach Fathom/i.test(raw)) {
    return t`Fathom did not respond. Try again in a moment.`;
  }

  if (
    /Response not successful|Failed to fetch|NetworkError|status code 5\d\d/i.test(
      raw,
    )
  ) {
    return t`Could not reach the CRM server. Check your connection and try again.`;
  }

  if (raw.length > 0 && raw.length < 180 && !/[{}<>]/.test(raw)) {
    return raw;
  }

  return fallback ?? t`Something went wrong. Please try again.`;
};
