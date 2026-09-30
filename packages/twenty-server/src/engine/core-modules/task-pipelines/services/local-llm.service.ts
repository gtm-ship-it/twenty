import { Injectable, Logger } from '@nestjs/common';

import http from 'node:http';
import https from 'node:https';

import { isNonEmptyString } from '@sniptt/guards';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const DEFAULT_MODEL = 'qwen3:8b';
const DEFAULT_NUM_THREAD = 4;
// Una reunión larga en CPU tarda 1-3 min; 15 min es "algo se colgó".
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;
const CONTEXT_TOKENS = 8192;

export class LocalLlmUnavailableError extends Error {}

// POST JSON sin los límites por defecto de fetch (undici corta a los 5 min
// esperando la respuesta, y en CPU cargar el modelo + leer una reunión larga
// tarda más). Aquí el único límite es el nuestro.
const postJson = (
  url: string,
  body: string,
  timeoutMs: number,
): Promise<{ status: number; text: string }> =>
  new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            text: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        response.on('error', reject);
      },
    );
    const timer = setTimeout(
      () => request.destroy(new Error('Ollama timed out')),
      timeoutMs,
    );

    request.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.on('close', () => clearTimeout(timer));
    request.end(body);
  });

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
    const startedAt = Date.now();

    try {
      const response = await postJson(
        `${baseUrl.replace(/\/$/, '')}/api/chat`,
        JSON.stringify({
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
        REQUEST_TIMEOUT_MS,
      );

      if (response.status < 200 || response.status >= 300) {
        throw new LocalLlmUnavailableError(
          `Ollama answered ${response.status}: ${response.text.slice(0, 300)}`,
        );
      }

      let payload: {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      try {
        payload = JSON.parse(response.text);
      } catch {
        throw new LocalLlmUnavailableError(
          `Ollama returned an unreadable answer: ${response.text.slice(0, 200)}`,
        );
      }

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
        `Ollama request failed after ${Math.round((Date.now() - startedAt) / 1000)}s: ${(error as Error).message}`,
      );
    }
  }
}
