import { isNonEmptyString } from '@sniptt/guards';

// Devuelve el número en E.164 (+1XXXXXXXXXX) o null si no se puede interpretar.
// Atlas solo marca a Norteamérica desde estas cuentas, así que los 10 dígitos
// pelados se asumen +1. Un calling code explícito (p.ej. "+57") se respeta.
export const normalizePhoneNumber = (
  rawNumber: string | null | undefined,
  callingCode?: string | null,
): string | null => {
  if (!isNonEmptyString(rawNumber)) {
    return null;
  }

  const trimmed = rawNumber.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 0) {
    return null;
  }

  if (hasPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const normalizedCallingCode = isNonEmptyString(callingCode)
    ? callingCode.replace(/\D/g, '')
    : '';

  // Con calling code guardado en el CRM confiamos en él (Atlas valida el resto);
  // así un número mal formado se ve en la lista y Atlas lo rechaza con motivo,
  // en vez de desaparecer como "sin teléfono".
  if (normalizedCallingCode.length > 0) {
    return digits.length >= 7 && digits.length <= 14
      ? `+${normalizedCallingCode}${digits}`
      : null;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return null;
};
