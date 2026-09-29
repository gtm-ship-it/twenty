import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { safeHttpUrl } from '@/task-pipelines/utils/safeHttpUrl';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// Solo imágenes subidas a este CRM (fotos de pasos, capturas en comentarios).
export const isOwnImageUrl = (src: string | undefined): boolean => {
  const safe = safeHttpUrl(src);

  if (safe === undefined) {
    return false;
  }

  try {
    const url = new URL(safe);
    const server = new URL(REACT_APP_SERVER_BASE_URL);

    // Mismo dominio que el CRM (en local el front y la API van en puertos
    // distintos); cualquier otro host sigue bloqueado.
    return (
      url.hostname === server.hostname && url.pathname.startsWith('/file/')
    );
  } catch {
    return false;
  }
};

// Markdown de terceros (correos, Fathom, comentarios): sin imágenes remotas
// (evita píxeles de rastreo que revelan quién abrió la tarea; solo se muestran
// las subidas a este mismo CRM) y enlaces solo http(s), siempre en otra pestaña.
export const SafeMarkdown = ({
  children,
  stopLinkPropagation = false,
}: {
  children: string;
  stopLinkPropagation?: boolean;
}) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      img: ({ src, alt }) => {
        const source = typeof src === 'string' ? src : undefined;

        if (!isOwnImageUrl(source)) {
          return alt ? <span>{alt}</span> : null;
        }

        return (
          <a
            href={source}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={source}
              alt={alt ?? ''}
              loading="lazy"
              style={{ borderRadius: 4, display: 'block', maxWidth: '100%' }}
            />
          </a>
        );
      },
      a: ({ href, children: linkChildren }) => {
        const safeHref = safeHttpUrl(href);

        if (safeHref === undefined) {
          return <span>{linkChildren}</span>;
        }

        return (
          <a
            href={safeHref}
            target="_blank"
            rel="noreferrer"
            onClick={
              stopLinkPropagation
                ? (event) => event.stopPropagation()
                : undefined
            }
          >
            {linkChildren}
          </a>
        );
      },
    }}
  >
    {children}
  </ReactMarkdown>
);
