import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import Hls from 'hls.js';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { safeHttpUrl } from '@/task-pipelines/utils/safeHttpUrl';

const StyledVideo = styled.video`
  aspect-ratio: 16 / 9;
  background: ${themeCssVariables.background.invertedPrimary};
  border-radius: ${themeCssVariables.border.radius.md};
  display: block;
  width: 100%;
`;

const StyledFallback = styled.div`
  align-items: center;
  aspect-ratio: 16 / 9;
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
  text-align: center;

  a {
    color: ${themeCssVariables.color.blue};
  }
`;

export type MeetingVideoPlayerHandle = {
  seekTo: (seconds: number) => void;
};

// El HLS de Fathom pasa por el proxy del servidor (Fathom no deja incrustar su
// reproductor ni leer su stream desde otro dominio). Safari lo reproduce de
// forma nativa; el resto de navegadores usa hls.js.
export const MeetingVideoPlayer = forwardRef<
  MeetingVideoPlayerHandle,
  {
    // sourceKey identifica la grabación: el token del src cambia en cada
    // consulta, pero eso no debe reiniciar el video que se está viendo.
    sourceKey: string;
    src: string | null;
    fallbackUrl: string | null;
    onTimeUpdate?: (seconds: number) => void;
  }
>(({ sourceKey, src, fallbackUrl, onTimeUpdate }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  // El src con token se congela por grabación (no es estado de render: es la
  // fuente ya cargada en hls.js y no debe cambiar mientras se ve el video).
  // oxlint-disable-next-line twenty/no-state-useref
  const stableSrc = useRef<{ key: string; src: string | null }>({
    key: sourceKey,
    src,
  });

  if (
    stableSrc.current.key !== sourceKey ||
    (stableSrc.current.src === null && src !== null)
  ) {
    stableSrc.current = { key: sourceKey, src };
  }

  const effectiveSrc = stableSrc.current.src;

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.currentTime = seconds;
      void video.play().catch(() => undefined);
    },
  }));

  useEffect(() => {
    const video = videoRef.current;

    setFailed(false);

    if (!video || !effectiveSrc) {
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30 });
      let mediaRecoveries = 0;

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          return;
        }

        // Primero se intenta recuperar (red caída un momento, buffer roto).
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && mediaRecoveries < 3) {
          mediaRecoveries++;
          hls.startLoad();

          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 3) {
          mediaRecoveries++;
          hls.recoverMediaError();

          return;
        }

        setFailed(true);
        hls.destroy();
      });
      hls.loadSource(effectiveSrc);
      hls.attachMedia(video);

      return () => hls.destroy();
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      const onError = () => setFailed(true);

      video.src = effectiveSrc;
      video.addEventListener('error', onError);

      return () => {
        video.removeEventListener('error', onError);
        video.removeAttribute('src');
        video.load();
      };
    }

    setFailed(true);

    return undefined;
  }, [effectiveSrc]);

  if (!effectiveSrc || failed) {
    return (
      <StyledFallback>
        <div>
          {effectiveSrc
            ? t`The recording could not be loaded here.`
            : t`No recording available for this meeting.`}
        </div>
        {safeHttpUrl(fallbackUrl) && (
          <a href={safeHttpUrl(fallbackUrl)} target="_blank" rel="noreferrer">
            {t`Open it in Fathom`}
          </a>
        )}
      </StyledFallback>
    );
  }

  return (
    <StyledVideo
      ref={videoRef}
      controls
      preload="metadata"
      onTimeUpdate={(event) =>
        onTimeUpdate?.((event.target as HTMLVideoElement).currentTime)
      }
    />
  );
});

MeetingVideoPlayer.displayName = 'MeetingVideoPlayer';
