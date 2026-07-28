const DEFAULT_TIMEOUT_MS = 8000;
const SEEK_SECONDS = 0.1;
const JPEG_QUALITY = 0.85;

/**
 * Extract a JPEG poster frame from a local File or a playable media URL.
 * URL extraction may fail when CORS taints the canvas — callers should treat that as soft failure.
 */
export async function extractVideoPosterBlob(
  source: File | string,
  options?: { timeoutMs?: number; crossOrigin?: boolean },
): Promise<Blob> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const useObjectUrl = typeof source !== 'string';
  const src = useObjectUrl ? URL.createObjectURL(source) : source;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  if (!useObjectUrl && options?.crossOrigin !== false) {
    video.crossOrigin = 'anonymous';
  }

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('error', onError);
        video.removeEventListener('seeked', onSeeked);
        fn();
      };

      const timer = window.setTimeout(() => {
        finish(() => reject(new Error('Video poster extraction timed out.')));
      }, timeoutMs);

      const onError = () => {
        finish(() => reject(new Error('Video could not be decoded for poster extraction.')));
      };

      const onSeeked = () => {
        finish(() => resolve());
      };

      const onLoaded = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const seekTo = duration > 0 ? Math.min(SEEK_SECONDS, Math.max(0, duration - 0.05)) : SEEK_SECONDS;
        try {
          video.currentTime = seekTo;
        } catch {
          finish(() => reject(new Error('Video seek failed during poster extraction.')));
        }
      };

      video.addEventListener('error', onError);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('loadeddata', onLoaded);
      video.src = src;
      video.load();
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new Error('Video has no drawable frame.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas is not available for poster extraction.');
    }
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('Failed to encode poster JPEG.'));
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    });

    return blob;
  } finally {
    video.removeAttribute('src');
    video.load();
    if (useObjectUrl) {
      URL.revokeObjectURL(src);
    }
  }
}
