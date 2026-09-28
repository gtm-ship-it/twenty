import {
  looksLikeEmail,
  normalizeEmail,
  normalizePersonName,
} from 'src/engine/core-modules/task-pipelines/utils/normalize-person-name.util';

export type AssignableMember = {
  workspaceMemberId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  aliases: string[];
};

export type AssigneeHint = {
  name: string | null;
  email: string | null;
};

export type TranscriptHint = {
  speakerName: string | null;
  speakerEmail: string | null;
  timestamp: string | null;
};

export type AssigneeResolution =
  | 'EMAIL'
  | 'ALIAS'
  | 'NAME'
  | 'INVITEE'
  | 'MENTION'
  | 'SPEAKER'
  | 'SOLE_MEMBER'
  | 'NONE';

export type ResolvedAssignee = {
  workspaceMemberId: string | null;
  resolution: AssigneeResolution;
};

const timestampToSeconds = (
  value: string | null | undefined,
): number | null => {
  if (!value) {
    return null;
  }

  const parts = value.split(':').map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
};

// Todas las formas en que se puede nombrar a un miembro (nombre completo,
// nombre de pila, alias) ya normalizadas.
const getMemberNames = (member: AssignableMember): string[] => {
  const fullName = normalizePersonName(
    `${member.firstName ?? ''} ${member.lastName ?? ''}`,
  );
  const firstName = normalizePersonName(member.firstName);

  const aliasNames = member.aliases
    .filter((alias) => !looksLikeEmail(alias))
    .map(normalizePersonName);

  return [fullName, firstName, ...aliasNames].filter((name) => name.length > 0);
};

const getMemberEmails = (member: AssignableMember): string[] =>
  [
    normalizeEmail(member.email),
    ...member.aliases.filter(looksLikeEmail).map(normalizeEmail),
  ].filter((email) => email.length > 0);

const uniqueMatch = (
  members: AssignableMember[],
  predicate: (member: AssignableMember) => boolean,
): AssignableMember | null => {
  const matches = members.filter(predicate);

  return matches.length === 1 ? matches[0] : null;
};

const findByEmail = (members: AssignableMember[], email: string | null) => {
  const normalized = normalizeEmail(email);

  if (normalized.length === 0) {
    return null;
  }

  return uniqueMatch(members, (member) =>
    getMemberEmails(member).includes(normalized),
  );
};

const findByName = (members: AssignableMember[], name: string | null) => {
  const normalized = normalizePersonName(name);

  if (normalized.length === 0) {
    return null;
  }

  // 1) coincidencia exacta con nombre completo / de pila / alias
  const exact = uniqueMatch(members, (member) =>
    getMemberNames(member).includes(normalized),
  );

  if (exact) {
    return exact;
  }

  // 2) el primer token del nombre de Fathom es el nombre de pila de un solo miembro
  const firstToken = normalized.split(' ')[0];

  return uniqueMatch(members, (member) =>
    getMemberNames(member).some(
      (memberName) => memberName.split(' ')[0] === firstToken,
    ),
  );
};

// Cascada determinista para decidir a quién del tablero le toca un accionable.
// Solo usa datos que entrega Fathom; si nada coincide devuelve NONE y la tarea
// queda "por asignar" (nunca se adivina a alguien de fuera del tablero).
export const resolveActionItemAssignee = ({
  assignee,
  description,
  recordingTimestamp,
  invitees,
  transcript,
  members,
}: {
  assignee: AssigneeHint | null;
  description: string;
  recordingTimestamp: string | null;
  invitees: AssigneeHint[];
  transcript: TranscriptHint[];
  members: AssignableMember[];
}): ResolvedAssignee => {
  if (members.length === 0) {
    return { workspaceMemberId: null, resolution: 'NONE' };
  }

  const byEmail = findByEmail(members, assignee?.email ?? null);

  if (byEmail) {
    return {
      workspaceMemberId: byEmail.workspaceMemberId,
      resolution: 'EMAIL',
    };
  }

  const assigneeName = normalizePersonName(assignee?.name);

  if (assigneeName.length > 0) {
    const byAlias = uniqueMatch(members, (member) =>
      member.aliases
        .filter((alias) => !looksLikeEmail(alias))
        .map(normalizePersonName)
        .includes(assigneeName),
    );

    if (byAlias) {
      return {
        workspaceMemberId: byAlias.workspaceMemberId,
        resolution: 'ALIAS',
      };
    }

    const byName = findByName(members, assignee?.name ?? null);

    if (byName) {
      return {
        workspaceMemberId: byName.workspaceMemberId,
        resolution: 'NAME',
      };
    }

    // El nombre coincide con un invitado del calendario -> su correo -> miembro.
    const invitee = invitees.find(
      (candidate) => normalizePersonName(candidate.name) === assigneeName,
    );
    const byInvitee = findByEmail(members, invitee?.email ?? null);

    if (byInvitee) {
      return {
        workspaceMemberId: byInvitee.workspaceMemberId,
        resolution: 'INVITEE',
      };
    }
  }

  // El accionable nombra a una sola persona del tablero ("Yeison to verify…").
  const normalizedDescription = ` ${normalizePersonName(description)} `;
  const byMention = uniqueMatch(members, (member) =>
    getMemberNames(member).some(
      (memberName) =>
        memberName.length >= 3 &&
        normalizedDescription.includes(` ${memberName} `),
    ),
  );

  if (byMention) {
    return {
      workspaceMemberId: byMention.workspaceMemberId,
      resolution: 'MENTION',
    };
  }

  // Fathom nombró a alguien concreto que NO está en el tablero (p. ej. el
  // cliente): no se adivina por quién hablaba; queda por asignar, salvo en un
  // tablero de una sola persona, donde todo es de su dueño.
  const fathomNamedSomeone =
    normalizePersonName(assignee?.name).length > 0 ||
    normalizeEmail(assignee?.email).length > 0;

  if (fathomNamedSomeone) {
    return members.length === 1
      ? {
          workspaceMemberId: members[0].workspaceMemberId,
          resolution: 'SOLE_MEMBER',
        }
      : { workspaceMemberId: null, resolution: 'NONE' };
  }

  // Sin asignado en Fathom: quien hablaba en ese segundo (normalmente quien se comprometió).
  const actionSeconds = timestampToSeconds(recordingTimestamp);

  if (actionSeconds !== null && transcript.length > 0) {
    let speakerLine: TranscriptHint | null = null;

    for (const line of transcript) {
      const lineSeconds = timestampToSeconds(line.timestamp);

      if (lineSeconds !== null && lineSeconds <= actionSeconds) {
        speakerLine = line;
      }
    }

    if (speakerLine) {
      const bySpeaker =
        findByEmail(members, speakerLine.speakerEmail) ??
        findByName(members, speakerLine.speakerName);

      if (bySpeaker) {
        return {
          workspaceMemberId: bySpeaker.workspaceMemberId,
          resolution: 'SPEAKER',
        };
      }
    }
  }

  // Tablero de una sola persona (típico de los personales): es suyo.
  if (members.length === 1) {
    return {
      workspaceMemberId: members[0].workspaceMemberId,
      resolution: 'SOLE_MEMBER',
    };
  }

  return { workspaceMemberId: null, resolution: 'NONE' };
};
