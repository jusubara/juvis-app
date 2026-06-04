'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  onCapture: (base64: string, mimeType: string) => void;
  onClose: () => void;
}

interface DetectedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function CameraScanner({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef<DetectedRect | null>(null);
  const lastDetectTime = useRef(0);

  const [hasDocument, setHasDocument] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Detect document boundary by finding bounding box of bright region
  const detectDocument = (
    data: Uint8ClampedArray,
    w: number,
    h: number,
  ): DetectedRect | null => {
    const THRESHOLD = 170;
    const STEP = 4; // sample every 4th pixel for performance
    const MARGIN = Math.min(w, h) * 0.05;

    let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;

    for (let y = MARGIN; y < h - MARGIN; y += STEP) {
      for (let x = MARGIN; x < w - MARGIN; x += STEP) {
        const i = (Math.floor(y) * w + Math.floor(x)) * 4;
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (gray > THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          count++;
        }
      }
    }

    if (count < 100) return null;

    const rw = maxX - minX;
    const rh = maxY - minY;
    if (rw < w * 0.2 || rh < h * 0.2) return null;
    if (rw > w * 0.97 || rh > h * 0.97) return null;
    // Aspect ratio sanity: should be roughly A4/letter
    const aspect = rw / rh;
    if (aspect < 0.4 || aspect > 2.5) return null;

    return { x: minX, y: minY, width: rw, height: rh };
  };

  const drawOverlay = (
    octx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rect: DetectedRect | null,
  ) => {
    octx.clearRect(0, 0, w, h);
    if (!rect) return;

    const { x, y, width: rw, height: rh } = rect;
    const cs = 28; // corner size

    octx.strokeStyle = '#FFD700';
    octx.lineWidth = 3;
    octx.strokeRect(x, y, rw, rh);

    octx.fillStyle = '#FFD700';
    // TL
    octx.fillRect(x, y, cs, 4);
    octx.fillRect(x, y, 4, cs);
    // TR
    octx.fillRect(x + rw - cs, y, cs, 4);
    octx.fillRect(x + rw - 4, y, 4, cs);
    // BL
    octx.fillRect(x, y + rh - 4, cs, 4);
    octx.fillRect(x, y + rh - cs, 4, cs);
    // BR
    octx.fillRect(x + rw - cs, y + rh - 4, cs, 4);
    octx.fillRect(x + rw - 4, y + rh - cs, 4, cs);
  };

  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const procCanvas = processingCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !procCanvas || !overlayCanvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    if (procCanvas.width !== vw) procCanvas.width = vw;
    if (procCanvas.height !== vh) procCanvas.height = vh;
    if (overlayCanvas.width !== vw) overlayCanvas.width = vw;
    if (overlayCanvas.height !== vh) overlayCanvas.height = vh;

    const ctx = procCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, vw, vh);

    // Detect every ~200ms to save CPU
    const now = Date.now();
    if (now - lastDetectTime.current > 200) {
      lastDetectTime.current = now;
      const imageData = ctx.getImageData(0, 0, vw, vh);
      const rect = detectDocument(imageData.data, vw, vh);
      detectedRef.current = rect;

      const octx = overlayCanvas.getContext('2d')!;
      drawOverlay(octx, vw, vh, rect);
      setHasDocument(!!rect);
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
          rafRef.current = requestAnimationFrame(renderFrame);
        }
      } catch {
        if (!cancelled) setError('카메라 접근 권한이 없습니다.\n브라우저 설정에서 카메라를 허용해주세요.');
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [renderFrame, stopCamera]);

  const capture = useCallback(() => {
    const procCanvas = processingCanvasRef.current;
    if (!procCanvas) return;

    const rect = detectedRef.current;

    const sx = rect?.x ?? 0;
    const sy = rect?.y ?? 0;
    const sw = rect?.width ?? procCanvas.width;
    const sh = rect?.height ?? procCanvas.height;

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const octx = out.getContext('2d')!;
    octx.drawImage(procCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    // Grayscale + contrast enhancement
    const imgData = octx.getImageData(0, 0, sw, sh);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      // Contrast: darken shadows, brighten highlights
      const enhanced = gray < 128
        ? Math.max(0, gray * 0.7)
        : Math.min(255, 255 - (255 - gray) * 0.6);
      d[i] = d[i + 1] = d[i + 2] = Math.round(enhanced);
    }
    octx.putImageData(imgData, 0, 0);

    const dataUrl = out.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];

    stopCamera();
    onCapture(base64, 'image/jpeg');
  }, [stopCamera, onCapture]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
        }}
      >
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
          문서 스캔
        </span>
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Camera view */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
          }}
        />

        {/* Hidden processing canvas */}
        <canvas ref={processingCanvasRef} style={{ display: 'none' }} />

        {/* Overlay canvas (same objectFit so coords align) */}
        <canvas
          ref={overlayCanvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />

        {/* Guide text */}
        {ready && !hasDocument && (
          <div
            style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.65)', color: '#fff',
              padding: '8px 18px', borderRadius: 20, fontSize: 13,
              whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            문서를 화면에 맞춰주세요
          </div>
        )}

        {/* Detected label */}
        {hasDocument && (
          <div
            style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(255,215,0,0.85)', color: '#000',
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            문서 감지됨
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)', color: '#fff',
              fontSize: 14, textAlign: 'center', padding: 32, gap: 16,
            }}
          >
            <div style={{ fontSize: 36 }}>🚫</div>
            <div style={{ whiteSpace: 'pre-line' }}>{error}</div>
            <button
              onClick={handleClose}
              style={{
                marginTop: 8, padding: '10px 24px', borderRadius: 8,
                background: '#fff', color: '#000', fontWeight: 600,
                fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        )}
      </div>

      {/* Capture button */}
      {!error && (
        <div
          style={{
            padding: '28px 0 32px',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            background: 'rgba(0,0,0,0.9)', gap: 32,
          }}
        >
          {/* Cancel */}
          <button
            onClick={handleClose}
            style={{
              color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            취소
          </button>

          {/* Shutter */}
          <button
            onClick={capture}
            disabled={!ready}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: hasDocument ? '#fff' : 'rgba(255,255,255,0.45)',
              border: `4px solid ${hasDocument ? '#FFD700' : 'rgba(255,255,255,0.4)'}`,
              cursor: ready ? 'pointer' : 'default',
              boxShadow: hasDocument ? '0 0 24px rgba(255,215,0,0.6)' : 'none',
              transition: 'all .2s',
            }}
          />

          {/* Spacer to balance cancel */}
          <div style={{ width: 32 }} />
        </div>
      )}
    </div>
  );
}
