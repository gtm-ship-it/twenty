import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

import { isNonEmptyString } from '@sniptt/guards';

// El HTML de un correo es contenido no confiable: es el vector clasico de XSS
// y de rastreo. Se sanea una sola vez, al importar, para no depender de que
// cada consumidor se acuerde de hacerlo.
//
// Las imagenes remotas NO se eliminan aqui: se mueve su `src` a `data-src`
// para que el visor pueda ofrecer "mostrar imagenes" sin avisar al remitente
// de que abriste el correo hasta que tu lo decidas.
const REMOTE_SRC_PROTOCOLS = /^(https?:)?\/\//i;

let purifier: ReturnType<typeof DOMPurify> | null = null;

const getPurifier = () => {
  if (purifier === null) {
    purifier = DOMPurify(new JSDOM('').window);

    purifier.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src');

        if (isNonEmptyString(src) && REMOTE_SRC_PROTOCOLS.test(src)) {
          node.setAttribute('data-src', src);
          node.removeAttribute('src');
        }
      }

      // Un `url(...)` dentro de un style en linea descarga un recurso remoto
      // igual que una imagen, asi que delata la apertura del correo aunque
      // las imagenes esten bloqueadas. Se quita el atributo entero: no
      // merece la pena parsear CSS para salvar el resto de la declaracion.
      const style = node.getAttribute?.('style');

      if (isNonEmptyString(style) && /url\s*\(/i.test(style)) {
        node.removeAttribute('style');
      }

      // Todo enlace se abre fuera y sin filtrar el referrer.
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  return purifier;
};

export const sanitizeMessageBodyHtml = (
  html: string | null | undefined,
): string | null => {
  if (!isNonEmptyString(html)) {
    return null;
  }

  const sanitized = getPurifier().sanitize(html, {
    // `style` se permite como atributo (los correos maquetan con estilos en
    // linea), pero no como etiqueta: una hoja de estilos completa puede
    // romper el visor y filtrar datos con selectores.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
    FORBID_ATTR: ['srcset'],
    ALLOW_DATA_ATTR: true,
  });

  return isNonEmptyString(sanitized) ? sanitized : null;
};
