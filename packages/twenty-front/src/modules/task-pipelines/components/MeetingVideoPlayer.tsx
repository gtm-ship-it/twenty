import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import Hls from 'hls.js';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledVideo = styled.video`
  aspect-ratio: 16 / 9;
  background: #000;
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
  { src: string | null; fallbackUrl: string | null; onTimeUpdate?: (seconds: number) => void }
>(({ src, fallbackUrl, onTimeUpdate }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

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

    if (!video || !src) {
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30 });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setFailed(true);
          hls.destroy();
        }
      });
      hls.loadSource(src);
      hls.attachMedia(video);

      return () => hls.destroy();
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.onerror = () => setFailed(true);

      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    setFailed(true);

    return undefined;
  }, [src]);

  if (!src || failed) {
    return (
      <StyledFallback>
        <div>{src ? t`The recording could not be loaded here.` : t`No recording available for this meeting.`}</div>
        {fallbackUrl && (
          <a href={fallbackUrl} target="_blank" rel="noreferrer">
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
      onTimeUpdate={(event) => onTimeUpdate?.((event.target as HTMLVideoElement).currentTime)}
    />
  );
});

MeetingVideoPlayer.displayName = 'MeetingVideoPlayer';
