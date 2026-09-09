export type InboxPipelineColumn = {
  name: string;
  // ThemeColor de twenty-ui (green, turquoise, sky, blue, purple, pink, red, orange, yellow, gray)
  color: string;
};

export type InboxPipeline = {
  id: string;
  name: string;
  // Las dos listas conviven y se pueden usar a la vez:
  //  - onlyRules vacía  => entra todo lo que no esté excluido
  //  - onlyRules con entradas => SOLO entra lo que matchee
  //  - excludeRules siempre gana sobre onlyRules
  // Entradas: dirección exacta ("maria@acme.com") o dominio ("@acme.com").
  onlyRules: string[];
  excludeRules: string[];
  // cuentas conectadas que alimentan este pipeline; vacío = todas las del usuario
  accountIds: string[];
  columns: InboxPipelineColumn[];
  // threadId -> índice de columna; los hilos sin entrada caen en la columna 0.
  // Un hilo presente aquí pertenece al pipeline aunque no cumpla las reglas
  // (agregado manualmente desde la bandeja).
  cardColumns: Record<string, number>;
};

export const DEFAULT_PIPELINE_COLUMNS: InboxPipelineColumn[] = [
  { name: 'Nuevo', color: 'blue' },
  { name: 'En proceso', color: 'yellow' },
  { name: 'Respondido', color: 'green' },
  { name: 'Cerrado', color: 'gray' },
];

const normalizeColumn = (column: unknown): InboxPipelineColumn | null => {
  // compat: versiones previas guardaban las columnas como strings
  if (typeof column === 'string') {
    return { name: column, color: 'gray' };
  }

  if (
    typeof column === 'object' &&
    column !== null &&
    typeof (column as InboxPipelineColumn).name === 'string'
  ) {
    return {
      name: (column as InboxPipelineColumn).name,
      color:
        typeof (column as InboxPipelineColumn).color === 'string'
          ? (column as InboxPipelineColumn).color
          : 'gray',
    };
  }

  return null;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

export const parseInboxPipelines = (
  pipelinesJson: string | null,
): InboxPipeline[] => {
  if (!pipelinesJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(pipelinesJson);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (pipeline) =>
          typeof pipeline?.id === 'string' &&
          typeof pipeline?.name === 'string' &&
          Array.isArray(pipeline?.columns),
      )
      .map((pipeline): InboxPipeline => {
        // compat: el formato viejo tenía un único `rules` gobernado por `mode`
        const legacyRules = asStringArray(pipeline.rules);
        const legacyIsOnly = pipeline.mode === 'ONLY';

        return {
          id: pipeline.id,
          name: pipeline.name,
          onlyRules: Array.isArray(pipeline.onlyRules)
            ? asStringArray(pipeline.onlyRules)
            : legacyIsOnly
              ? legacyRules
              : [],
          excludeRules: Array.isArray(pipeline.excludeRules)
            ? asStringArray(pipeline.excludeRules)
            : legacyIsOnly
              ? []
              : legacyRules,
          accountIds: asStringArray(pipeline.accountIds),
          columns: pipeline.columns
            .map(normalizeColumn)
            .filter(
              (
                column: InboxPipelineColumn | null,
              ): column is InboxPipelineColumn => column !== null,
            ),
          cardColumns:
            typeof pipeline.cardColumns === 'object' &&
            pipeline.cardColumns !== null
              ? pipeline.cardColumns
              : {},
        };
      });
  } catch {
    return [];
  }
};

const matchesRule = (handles: string[], rule: string): boolean => {
  const normalizedRule = rule.toLowerCase();

  return normalizedRule.startsWith('@')
    ? handles.some((handle) => handle.endsWith(normalizedRule))
    : handles.includes(normalizedRule);
};

/**
 * ¿Este hilo pertenece al pipeline?
 * excludeRules manda sobre onlyRules; onlyRules vacía = "todo lo demás".
 */
export const threadBelongsToPipeline = (
  participantHandles: (string | null | undefined)[],
  pipeline: Pick<InboxPipeline, 'onlyRules' | 'excludeRules'>,
): boolean => {
  const handles = participantHandles
    .filter((handle): handle is string => !!handle)
    .map((handle) => handle.toLowerCase());

  if (pipeline.excludeRules.some((rule) => matchesRule(handles, rule))) {
    return false;
  }

  if (pipeline.onlyRules.length === 0) {
    return true;
  }

  return pipeline.onlyRules.some((rule) => matchesRule(handles, rule));
};
