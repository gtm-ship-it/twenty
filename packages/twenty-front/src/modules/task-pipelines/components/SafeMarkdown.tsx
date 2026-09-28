import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { safeHttpUrl } from '@/task-pipelines/utils/safeHttpUrl';

// Markdown de terceros (correos, Fathom, comentarios): sin imágenes remotas
// (evita píxeles de rastreo que revelan quién abrió la tarea) y enlaces solo
// http(s), siempre en otra pestaña.
export const SafeMarkdown = ({
  children,
  stopLinkPropagation = false,
}: {
  children: string;
  stopLinkPropagation?: boolean;
}) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    disallowedElements={['img']}
    unwrapDisallowed
    components={{
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
