import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const DEFAULT_MODEL = 'qwen3:8b';
const DEFAULT_NUM_THREAD = 4;
// Una reunión larga en CPU tarda 1-3 min; 15 min es "algo se colgó".
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;
const CONTEXT_TOKENS = 16384;

export class LocalLlmUnavailableError extends Error {}

// IA local (Ollama en el mismo VPS): gratis y sin mandar datos a terceros.
// Devuelve JSON que cumple el esquema pedido; el llamador valida el contenido.
@Injectable()
export class LocalLlmService {
  private readonly logger = new Logger(LocalLlmService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  isConfigured(): boolean {
    return isNonEmptyString(this.twentyConfigService.get('OLLAMA_URL'));
  }

  getModel(): string {
    const model = this.twentyConfigService.get('OLLAMA_MODEL');

    return isNonEmptyString(model) ? model : DEFAULT_MODEL;
  }

  async chatJson<T>({
    system,
    user,
    schema,
  }: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
  }): Promise<T> {
    const baseUrl = this.twentyConfigService.get('OLLAMA_URL');

    if (!isNonEmptyString(baseUrl)) {
      throw new LocalLlmUnavailableError('OLLAMA_URL is not configured');
    }

    const numThread =
      Number(this.twentyConfigService.get('OLLAMA_NUM_THREAD')) ||
      DEFAULT_NUM_THREAD;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.getModel(),
          stream: false,
          think: false,
          format: schema,
          // Se descarga de la RAM a los 5 min sin uso.
          keep_alive: '5m',
          options: {
            temperature: 0,
            num_ctx: CONTEXT_TOKENS,
            num_thread: numThread,
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!response.ok) {
        throw new LocalLlmUnavailableError(
          `Ollama answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
        );
      }

      const payload = (await response.json()) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      this.logger.log(
        `Ollama ${this.getModel()} answered in ${Math.round((Date.now() - startedAt) / 1000)}s (${payload.prompt_eval_count ?? '?'} → ${payload.eval_count ?? '?'} tokens)`,
      );

      const content = payload.message?.content ?? '';

      try {
        return JSON.parse(content) as T;
      } catch {
        throw new LocalLlmUnavailableError(
          `Ollama returned invalid JSON: ${content.slice(0, 200)}`,
        );
      }
    } catch (error) {
      if (error instanceof LocalLlmUnavailableError) {
        throw error;
      }

      throw new LocalLlmUnavailableError(
        controller.signal.aborted
          ? 'Ollama timed out'
          : `Ollama request failed: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
