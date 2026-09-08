export type InboxPipelineMode = 'ONLY' | 'EXCLUDE';

export type InboxPipeline = {
  id: string;
  name: string;
  // ONLY: solo correos que matcheen las reglas. EXCLUDE: todo excepto lo que matchee.
  mode: InboxPipelineMode;
  // direcciones exactas o dominios con @ (ej. "maria@acme.com", "@acme.com")
  rules: string[];
  columns: string[];
  // threadId -> índice de columna; los hilos sin entrada caen en la columna 0
  cardColumns: Record<string, number>;
};

export const DEFAULT_PIPELINE_COLUMNS = [
  'Nuevo',
  'En proceso',
  'Respondido',
  'Cerrado',
];

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

    return parsed.filter(
      (pipeline): pipeline is InboxPipeline =>
        typeof pipeline?.id === 'string' &&
        typeof pipeline?.name === 'string' &&
        (pipeline?.mode === 'ONLY' || pipeline?.mode === 'EXCLUDE') &&
        Array.isArray(pipeline?.rules) &&
        Array.isArray(pipeline?.columns),
    );
  } catch {
    return [];
  }
};
