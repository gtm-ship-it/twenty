import { isNonEmptyString } from '@sniptt/guards';

import { type FathomActionItem } from 'src/engine/core-modules/task-pipelines/fathom/fathom.types';
import { normalizePersonName } from 'src/engine/core-modules/task-pipelines/utils/normalize-person-name.util';
import {
  type AssignableMember,
  findMemberByName,
  resolveActionItemAssignee,
  type TranscriptHint,
} from 'src/engine/core-modules/task-pipelines/utils/resolve-action-item-assignee.util';

const MAX_CARDS = 25;
const MAX_ITEMS_PER_CARD = 30;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 1000;

export type ActionPointCard = {
  title: string;
  description: string;
  memberIds: string[];
  timestampSeconds: number | null;
  items: { text: string; assigneeId: string | null }[];
};

// ------------------------------------------------------------------ prompt

export const ACTION_POINTS_SCHEMA = {
  type: 'object',
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'members', 'items'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          members: { type: 'array', items: { type: 'string' } },
          timestamp: { type: ['number', 'null'] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['text', 'assignee'],
              properties: {
                text: { type: 'string' },
                assignee: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const ACTION_POINTS_SYSTEM_PROMPT = `Eres un asistente que convierte el resumen de una reunión en tarjetas de tareas tipo Trello.
Reglas:
1. Usa SOLO los próximos pasos / acciones ("Próximos pasos", "Next Steps", "Action Items"), los ACCIONABLES DE FATHOM si vienen, y compromisos explícitos del resumen. No inventes tareas ni repitas la misma tarea dos veces.
2. Una tarjeta = una acción o tema. Si una acción involucra a varias personas, es UNA tarjeta con todas ellas en "members" y un punto ("items") por persona con lo que le toca a cada una.
3. "members" y "assignee" deben ser el nombre EXACTO ("name") de un miembro del tablero. Reconoce los alias (p. ej. si un miembro tiene el alias "Jay", "Jay" es ese miembro). Si la persona no es miembro del tablero o es "el equipo"/"todos", deja assignee en null.
4. "title": corto (máx. 80 caracteres), en español, empieza con un verbo. "description": 1-2 frases de contexto.
5. "items": pasos concretos en español. Si la acción es de una sola persona, igual pon al menos 1 punto.
6. "timestamp": el número del parámetro timestamp= del enlace de ese próximo paso (segundos), o null.
7. Escribe siempre en español aunque el resumen esté en inglés.`;

export const buildActionPointsUserPrompt = ({
  title,
  startedAt,
  participants,
  members,
  summaryMarkdown,
  fathomActionItems,
}: {
  title: string;
  startedAt: Date | null;
  participants: { name: string | null; email: string | null }[];
  members: AssignableMember[];
  summaryMarkdown: string;
  fathomActionItems: FathomActionItem[];
}): string => {
  const memberLines = members.map((member) => ({
    name: memberDisplayName(member),
    aliases: member.aliases,
  }));
  const fathomLines = fathomActionItems
    .filter((item) => isNonEmptyString(item.description))
    .map(
      (item) =>
        `- ${item.description}${item.assignee?.name ? ` (asignado en Fathom: ${item.assignee.name})` : ''}`,
    );

  return [
    `REUNIÓN: ${title}${startedAt ? ` (${startedAt.toISOString().slice(0, 10)})` : ''}`,
    `PARTICIPANTES: ${participants
      .map((participant) => participant.name ?? participant.email)
      .filter(isNonEmptyString)
      .join(', ')}`,
    '',
    'MIEMBROS DEL TABLERO:',
    JSON.stringify(memberLines),
    '',
    ...(fathomLines.length > 0
      ? ['ACCIONABLES DE FATHOM:', ...fathomLines, '']
      : []),
    'RESUMEN DE LA REUNIÓN (markdown de Fathom):',
    summaryMarkdown,
  ].join('\n');
};

// ------------------------------------------------------------- normalizing

export const memberDisplayName = (member: AssignableMember) =>
  [member.firstName, member.lastName].filter(isNonEmptyString).join(' ') ||
  member.email ||
  member.workspaceMemberId;

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const resolveName = (
  members: AssignableMember[],
  name: unknown,
): string | null => {
  if (!isNonEmptyString(name)) {
    return null;
  }

  // El nombre completo que devolvió la IA, o cualquiera de sus alias.
  const byDisplayName = members.filter(
    (member) =>
      normalizePersonName(memberDisplayName(member)) ===
      normalizePersonName(name),
  );

  if (byDisplayName.length === 1) {
    return byDisplayName[0].workspaceMemberId;
  }

  return findMemberByName(members, name)?.workspaceMemberId ?? null;
};

const uniqueIds = (ids: (string | null)[]) => [
  ...new Set(ids.filter(isNonEmptyString)),
];

// Valida lo que devolvió la IA: solo miembros del tablero, textos no vacíos,
// sin tarjetas repetidas. Los miembros de la tarjeta son quienes tienen puntos
// (la IA tiende a agregar gente mencionada que no tiene nada que hacer).
export const normalizeLlmCards = (
  raw: unknown,
  members: AssignableMember[],
): ActionPointCard[] => {
  const rawCards = Array.isArray((raw as { cards?: unknown })?.cards)
    ? ((raw as { cards: unknown[] }).cards as Record<string, unknown>[])
    : [];
  const seenTitles = new Set<string>();
  const cards: ActionPointCard[] = [];

  for (const rawCard of rawCards.slice(0, MAX_CARDS)) {
    if (typeof rawCard !== 'object' || rawCard === null) {
      continue;
    }

    const rawItems = Array.isArray(rawCard.items)
      ? (rawCard.items as Record<string, unknown>[])
      : [];
    const cardMemberIds = uniqueIds(
      (Array.isArray(rawCard.members) ? rawCard.members : []).map((name) =>
        resolveName(members, name),
      ),
    );

    const items = rawItems
      .filter(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          isNonEmptyString(item.text),
      )
      .slice(0, MAX_ITEMS_PER_CARD)
      .map((item) => ({
        text: clip(String(item.text).trim(), MAX_TEXT_LENGTH),
        assigneeId: resolveName(members, item.assignee),
      }));

    const title = isNonEmptyString(rawCard.title)
      ? clip(String(rawCard.title).trim(), MAX_TITLE_LENGTH)
      : (items[0]?.text ?? '');

    if (!isNonEmptyString(title)) {
      continue;
    }

    const titleKey = normalizePersonName(title);

    if (seenTitles.has(titleKey)) {
      continue;
    }

    seenTitles.add(titleKey);

    if (items.length === 0) {
      items.push({ text: title, assigneeId: cardMemberIds[0] ?? null });
    }

    const assigneeIds = uniqueIds(items.map((item) => item.assigneeId));
    const memberIds = assigneeIds.length > 0 ? assigneeIds : cardMemberIds;

    // Tarjeta de una sola persona: sus puntos sin dueño también son suyos.
    const finalItems =
      memberIds.length === 1
        ? items.map((item) => ({
            ...item,
            assigneeId: item.assigneeId ?? memberIds[0],
          }))
        : items;

    const timestamp = Number(rawCard.timestamp);

    cards.push({
      title,
      description: isNonEmptyString(rawCard.description)
        ? clip(String(rawCard.description).trim(), MAX_TEXT_LENGTH)
        : '',
      memberIds,
      timestampSeconds:
        Number.isFinite(timestamp) && timestamp >= 0
          ? Math.floor(timestamp)
          : null,
      items: finalItems,
    });
  }

  return cards;
};

const timestampToSeconds = (value: string | null | undefined) => {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const parts = value.split(':').map(Number);

  return parts.some(Number.isNaN)
    ? null
    : parts.reduce((total, part) => total * 60 + part, 0);
};

// Sin IA (no configurada o falló): una tarjeta por próximo paso, asignada con
// la cascada determinista (correo/nombre/mención/quién hablaba).
export const cardsFromActionItems = ({
  items,
  members,
  invitees,
  transcript,
}: {
  items: FathomActionItem[];
  members: AssignableMember[];
  invitees: { name: string | null; email: string | null }[];
  transcript: TranscriptHint[];
}): ActionPointCard[] =>
  items
    .filter((item) => isNonEmptyString(item.description?.trim()))
    .slice(0, MAX_CARDS)
    .map((item) => {
      const text = clip((item.description ?? '').trim(), MAX_TEXT_LENGTH);
      const resolved = resolveActionItemAssignee({
        assignee: item.assignee
          ? {
              name: item.assignee.name ?? null,
              email: item.assignee.email ?? null,
            }
          : null,
        description: text,
        recordingTimestamp: item.recording_timestamp ?? null,
        invitees,
        transcript,
        members,
      });
      const assigneeId = resolved.workspaceMemberId;

      return {
        title: clip(text, MAX_TITLE_LENGTH),
        description: '',
        memberIds: assigneeId ? [assigneeId] : [],
        timestampSeconds: timestampToSeconds(item.recording_timestamp),
        items: [{ text, assigneeId }],
      };
    });

export const secondsToTimestamp = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
};

// Enlace de Fathom al segundo exacto de la grabación.
export const playbackUrlAt = (
  shareUrl: string | null,
  seconds: number | null,
): string | null => {
  if (!isNonEmptyString(shareUrl)) {
    return null;
  }

  if (seconds === null) {
    return shareUrl;
  }

  try {
    const url = new URL(shareUrl);

    url.searchParams.set('timestamp', String(seconds));

    return url.toString();
  } catch {
    return shareUrl;
  }
};
