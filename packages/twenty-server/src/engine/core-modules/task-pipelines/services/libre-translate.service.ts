import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_CHARS_PER_REQUEST = 4_000;

// Traductor self-hosted (LibreTranslate, contenedor en el mismo VPS): sin LLM ni
// terceros. Devuelve null si no está configurado o falla, y el llamador
// conserva el texto original para reintentar más tarde.
@Injectable()
export class LibreTranslateService {
  private readonly logger = new Logger(LibreTranslateService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  isConfigured(): boolean {
    return isNonEmptyString(this.twentyConfigService.get('LIBRETRANSLATE_URL'));
  }

  async translateMany(
    texts: string[],
    { source = 'en', target = 'es' }: { source?: string; target?: string } = {},
  ): Promise<string[] | null> {
    const baseUrl = this.twentyConfigService.get('LIBRETRANSLATE_URL');

    if (!isNonEmptyString(baseUrl)) {
      return null;
    }

    if (texts.length === 0) {
      return [];
    }

    // Lotes para no mandar peticiones enormes (resúmenes largos).
    const batches: string[][] = [];
    let current: string[] = [];
    let currentSize = 0;

    for (const text of texts) {
      if (current.length > 0 && currentSize + text.length > MAX_CHARS_PER_REQUEST) {
        batches.push(current);
        current = [];
        currentSize = 0;
      }

      current.push(text);
      currentSize += text.length;
    }

    if (current.length > 0) {
      batches.push(current);
    }

    const results: string[] = [];

    try {
      for (const batch of batches) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(`${baseUrl.replace(/\/$/, '')}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: batch, source, target, format: 'text' }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`LibreTranslate responded ${response.status}`);
          }

          const payload = (await response.json()) as {
            translatedText?: string | string[];
          };
          const translated = Array.isArray(payload.translatedText)
            ? payload.translatedText
            : [payload.translatedText ?? ''];

          if (translated.length !== batch.length) {
            throw new Error('LibreTranslate returned an unexpected number of texts');
          }

          results.push(...translated);
        } finally {
          clearTimeout(timeout);
        }
      }

      return results;
    } catch (error) {
      this.logger.warn(`Translation failed: ${(error as Error).message}`);

      return null;
    }
  }

  // Traduce markdown línea a línea conservando viñetas, encabezados y enlaces
  // (LibreTranslate con format=text rompería la sintaxis si se lo mandamos entero).
  async translateMarkdown(markdown: string): Promise<string | null> {
    const lines = markdown.split('\n');
    const translatable: { index: number; prefix: string; text: string }[] = [];

    lines.forEach((line, index) => {
      const match = line.match(/^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)?)(.*)$/);
      const prefix = match?.[1] ?? '';
      const text = (match?.[2] ?? line).trim();

      if (text.length > 0 && /[a-zA-Z]/.test(text)) {
        translatable.push({ index, prefix, text });
      }
    });

    if (translatable.length === 0) {
      return markdown;
    }

    // Los enlaces markdown [texto](url) se protegen: solo se traduce el texto.
    const links: string[] = [];
    const protectedTexts = translatable.map(({ text }) =>
      text.replace(/\]\(([^)]+)\)/g, (_match, url: string) => {
        links.push(url);

        return `](§${links.length - 1}§)`;
      }),
    );

    const translated = await this.translateMany(protectedTexts);

    if (translated === null) {
      return null;
    }

    const output = [...lines];

    translatable.forEach(({ index, prefix }, position) => {
      const restored = translated[position].replace(
        /\]\(\s*§\s*(\d+)\s*§\s*\)/g,
        (_match, linkIndex: string) => `](${links[Number(linkIndex)] ?? ''})`,
      );

      output[index] = `${prefix}${restored}`;
    });

    return output.join('\n');
  }
}
