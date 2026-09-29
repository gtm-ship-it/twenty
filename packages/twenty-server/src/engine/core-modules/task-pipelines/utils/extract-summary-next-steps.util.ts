import { type FathomActionItem } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';

export type SummaryNextStepsLanguage = 'es' | 'en';

export type SummaryNextSteps = {
  language: SummaryNextStepsLanguage;
  items: FathomActionItem[];
};

// Encabezados de la sección de pasos a seguir del resumen de Fathom, según el
// idioma en que Fathom escribió el resumen.
const HEADINGS: Record<string, SummaryNextStepsLanguage> = {
  'next steps': 'en',
  'action items': 'en',
  'proximos pasos': 'es',
  'siguientes pasos': 'es',
  'acciones a seguir': 'es',
  'elementos de accion': 'es',
};

const HEADING_REGEX = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET_REGEX = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const LINK_REGEX = /\[((?:[^\]\\]|\\.)+)\]\((https?:\/\/[^\s)]+)\)/;

const normalizeHeading = (value: string) =>
  value
    .replace(/[*_`]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[:.]+$/, '')
    .trim()
    .toLowerCase();

// Quita el formato markdown y deja texto plano ("**Mauro:** pedir \~25" → "Mauro: pedir ~25").
const toPlainText = (value: string) =>
  value
    .replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/(^|\s)[*_](\S)/g, '$1$2')
    .replace(/(\S)[*_](\s|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();

const secondsToTimestamp = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
};

const timestampFromUrl = (url: string): string | null => {
  try {
    const raw = new URL(url).searchParams.get('timestamp');
    const seconds = raw === null ? NaN : Number(raw);

    return Number.isFinite(seconds) ? secondsToTimestamp(seconds) : null;
  } catch {
    return null;
  }
};

// Fathom no siempre llena `action_items` (p. ej. con resúmenes en español),
// pero su resumen trae una sección "Próximos pasos" / "Next Steps". Cada viñeta
// se convierte en un accionable; una viñeta sin enlace con viñetas hijas es un
// encabezado de grupo (normalmente el nombre de la persona) y se antepone a sus hijas.
export const extractSummaryNextSteps = (
  markdown: string | null | undefined,
): SummaryNextSteps | null => {
  if (!markdown) {
    return null;
  }

  const lines = markdown.split(/\r?\n/);
  let language: SummaryNextStepsLanguage | null = null;
  let sectionLevel = 0;
  const bullets: { indent: number; text: string; url: string | null }[] = [];

  for (const line of lines) {
    const heading = HEADING_REGEX.exec(line);

    if (heading) {
      const level = heading[1].length;

      if (language !== null && level <= sectionLevel) {
        break;
      }

      if (language === null) {
        const match = HEADINGS[normalizeHeading(heading[2])];

        if (match) {
          language = match;
          sectionLevel = level;
        }
      }

      continue;
    }

    if (language === null) {
      continue;
    }

    const bullet = BULLET_REGEX.exec(line);

    if (!bullet) {
      continue;
    }

    const content = bullet[2];
    const link = LINK_REGEX.exec(content);
    const text = toPlainText(
      link ? content.replace(link[0], link[1]) : content,
    );

    if (text.length === 0) {
      continue;
    }

    bullets.push({
      indent: bullet[1].replace(/\t/g, '    ').length,
      text,
      url: link ? link[2] : null,
    });
  }

  if (language === null) {
    return null;
  }

  const items: FathomActionItem[] = [];

  bullets.forEach((bullet, index) => {
    const next = bullets[index + 1];
    const isGroupHeader =
      bullet.url === null && next !== undefined && next.indent > bullet.indent;

    if (isGroupHeader) {
      return;
    }

    // El grupo más cercano con menor sangría (p. ej. "Mauro") da contexto.
    let group: string | null = null;

    for (let i = index - 1; i >= 0; i--) {
      if (bullets[i].indent < bullet.indent) {
        const candidate = bullets[i];
        const nextOfCandidate = bullets[i + 1];

        if (
          candidate.url === null &&
          nextOfCandidate !== undefined &&
          nextOfCandidate.indent > candidate.indent
        ) {
          group = candidate.text.replace(/[:.]+$/, '').trim();
        }
        break;
      }
    }

    items.push({
      description: group ? `${group}: ${bullet.text}` : bullet.text,
      recording_timestamp: bullet.url ? timestampFromUrl(bullet.url) : null,
      recording_playback_url: bullet.url,
      completed: false,
      user_generated: false,
      assignee: null,
    });
  });

  return { language, items };
};
