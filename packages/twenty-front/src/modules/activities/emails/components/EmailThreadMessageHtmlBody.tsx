import { styled } from '@linaria/react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { t } from '@lingui/core/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledRemoteImagesBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledShowImagesButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  white-space: nowrap;
`;

// SIN `allow-scripts`: nada del correo puede ejecutarse, que es lo que de
// verdad protege la sesion. `allow-same-origin` SI hace falta: sin el, el
// iframe queda en un origen opaco, el padre no puede leer su documento para
// medir la altura, y el correo se renderiza con height 0 (invisible).
// Sin scripts, same-origin no le da al contenido ninguna capacidad extra.
const IFRAME_SANDBOX =
  'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

// Estilos base: el HTML del correo trae su propia maqueta, aqui solo se evita
// que se desborde y se le da un fondo claro (casi todos los correos asumen uno).
const BASE_STYLES = `
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff; color: #1f2933; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.45;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    img, table, video { max-width: 100% !important; height: auto; }
    table { border-collapse: collapse; }
    * { max-width: 100%; }
  </style>
`;

// Suelo minimo: si la medicion fallara por cualquier motivo, el correo se ve
// igualmente en vez de quedar en una caja de altura cero.
const MIN_HEIGHT = 80;

const restoreRemoteImages = (html: string) =>
  html.replace(/\sdata-src=/g, ' src=');

type EmailThreadMessageHtmlBodyProps = {
  bodyHtml: string;
};

export const EmailThreadMessageHtmlBody = ({
  bodyHtml,
}: EmailThreadMessageHtmlBodyProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [areRemoteImagesShown, setAreRemoteImagesShown] = useState(false);
  const [height, setHeight] = useState(0);

  const hasRemoteImages = bodyHtml.includes('data-src=');

  const srcDoc = useMemo(() => {
    const body = areRemoteImagesShown
      ? restoreRemoteImages(bodyHtml)
      : bodyHtml;

    // `base target=_blank` evita que un enlace intente navegar dentro del
    // iframe (que esta en un origen opaco y fallaria en silencio).
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">${BASE_STYLES}</head><body>${body}</body></html>`;
  }, [bodyHtml, areRemoteImagesShown]);

  // El iframe no se autodimensiona. Ademas el contenido crece cuando terminan
  // de cargar fuentes e imagenes, asi que no basta con medir una vez: se
  // observa el body. Si la medida fallara, MIN_HEIGHT evita que el correo
  // quede invisible.
  useLayoutEffect(() => {
    const iframe = iframeRef.current;

    if (iframe === null) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      const iframeDocument = iframe.contentDocument;
      const measured = iframeDocument?.documentElement?.scrollHeight;

      if (typeof measured === 'number' && measured > 0) {
        setHeight(measured);
      }
    };

    const observe = () => {
      measure();

      const body = iframe.contentDocument?.body;

      if (body && typeof ResizeObserver !== 'undefined') {
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(body);
      }
    };

    iframe.addEventListener('load', observe);
    observe();

    return () => {
      iframe.removeEventListener('load', observe);
      resizeObserver?.disconnect();
    };
  }, [srcDoc]);

  return (
    <StyledContainer>
      {hasRemoteImages && !areRemoteImagesShown && (
        <StyledRemoteImagesBar>
          <span>{t`Remote images are blocked to protect your privacy.`}</span>
          <StyledShowImagesButton
            type="button"
            onClick={() => setAreRemoteImagesShown(true)}
          >
            {t`Show images`}
          </StyledShowImagesButton>
        </StyledRemoteImagesBar>
      )}
      <iframe
        ref={iframeRef}
        title={t`Email content`}
        srcDoc={srcDoc}
        sandbox={IFRAME_SANDBOX}
        referrerPolicy="no-referrer"
        style={{
          border: 'none',
          width: '100%',
          height: `${Math.max(height, MIN_HEIGHT)}px`,
        }}
      />
    </StyledContainer>
  );
};
