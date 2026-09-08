export type InboxPipelineMode = 'ONLY' | 'EXCLUDE';

export type InboxPipelineColumn = {
  name: string;
  // ThemeColor de twenty-ui (green, turquoise, sky, blue, purple, pink, red, orange, yellow, gray)
  color: string;
};

export type InboxPipeline = {
  id: string;
  name: string;
  // ONLY: solo correos que matcheen las reglas. EXCLUDE: todo excepto lo que matchee.
  mode: InboxPipelineMode;
  // direcciones exactas o dominios con @ (ej. "maria@acme.com", "@acme.com")
  rules: string[];
  columns: InboxPipelineColumn[];
  // threadId -> índice de columna; los hilos sin entrada caen en la columna 0
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
          (pipeline?.mode === 'ONLY' || pipeline?.mode === 'EXCLUDE') &&
          Array.isArray(pipeline?.rules) &&
          Array.isArray(pipeline?.columns),
      )
      .map(
        (pipeline): InboxPipeline => ({
          id: pipeline.id,
          name: pipeline.name,
          mode: pipeline.mode,
          rules: pipeline.rules.filter(
            (rule: unknown): rule is string => typeof rule === 'string',
          ),
          columns: pipeline.columns
            .map(normalizeColumn)
            .filter(
              (column: InboxPipelineColumn | null): column is InboxPipelineColumn =>
                column !== null,
            ),
          cardColumns:
            typeof pipeline.cardColumns === 'object' &&
            pipeline.cardColumns !== null
              ? pipeline.cardColumns
              : {},
        }),
      );
  } catch {
    return [];
  }
};
