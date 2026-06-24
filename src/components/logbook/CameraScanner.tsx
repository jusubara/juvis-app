'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  onCapture: (base64: string, mimeType: string) => void;
  onClose: () => void;
}

type Point = { x: number; y: number };
type Quad = [Point, Point, Point, Point]; // TL, TR, BR, BL

interface Captured {
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  corners: Quad;
}

const STABLE_MS = 1500;
const ARC_R = 44;
const CIRC = 2 * Math.PI * ARC_R;

function detectDoc(data: Uint8ClampedArray, w: number, h: number): Quad | null {
  const STEP = 4;
  const MARGIN = Math.min(w, h) * 0.05;
  let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;

  for (let y = MARGIN; y < h - MARGIN; y += STEP) {
    for (let x = MARGIN; x < w - MARGIN; x += STEP) {
      const i = (Math.floor(y) * w + Math.floor(x)) * 4;
      if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] > 190) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        count++;
      }
    }
  }

  if (count < 100) return null;
  const rw = maxX - minX, rh = maxY - minY;
  const areaPct = (rw * rh) / (w * h);
  if (areaPct < 0.25 || areaPct > 0.85) return null;
  const asp = rw / rh;
  if (asp < 0.5 || asp > 2.0) return null;
  return [
    { x: minX, y: minY }, { x: maxX, y: minY },
    { x: maxX, y: maxY }, { x: minX, y: maxY },
  ];
}

function drawScanOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, q: Quad | null) {
  ctx.clearRect(0, 0, w, h);
  if (!q) return;
  const [tl, tr, br, bl] = q;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,122,255,0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,122,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const pt of q) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,122,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

export default function CameraScanner({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const procCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef<Quad | null>(null);
  const stableStartRef = useRef(0);
  const autoFiredRef = useRef(false);
  const lastDetectRef = useRef(0);
  const captureCallbackRef = useRef<() => void>(() => {});
  const adjustContainerRef = useRef<HTMLDivElement>(null);
  const prevQuadRef = useRef<Quad | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'scanning' | 'adjusting'>('scanning');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDoc, setHasDoc] = useState(false);
  const [countPct, setCountPct] = useState(0);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [dispCorners, setDispCorners] = useState<Quad | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const doCapture = useCallback(() => {
    const canvas = procCanvasRef.current;
    if (!canvas) return;
    const iw = canvas.width, ih = canvas.height;
    const q = detectedRef.current;
    const corners: Quad = q ?? [
      { x: iw * 0.05, y: ih * 0.05 }, { x: iw * 0.95, y: ih * 0.05 },
      { x: iw * 0.95, y: ih * 0.95 }, { x: iw * 0.05, y: ih * 0.95 },
    ];
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    stopCamera();
    setCaptured({ imageDataUrl, imageWidth: iw, imageHeight: ih, corners });
    setPhase('adjusting');
  }, [stopCamera]);

  useEffect(() => { captureCallbackRef.current = doCapture; }, [doCapture]);

  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const proc = procCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !proc || !overlay || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(renderFrame); return;
    }
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) { rafRef.current = requestAnimationFrame(renderFrame); return; }

    if (proc.width !== vw) proc.width = vw;
    if (proc.height !== vh) proc.height = vh;
    if (overlay.width !== vw) overlay.width = vw;
    if (overlay.height !== vh) overlay.height = vh;

    const ctx = proc.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, vw, vh);

    const now = Date.now();
    if (now - lastDetectRef.current > 200) {
      lastDetectRef.current = now;
      const imgData = ctx.getImageData(0, 0, vw, vh);
      const q = detectDoc(imgData.data, vw, vh);
      detectedRef.current = q;
      drawScanOverlay(overlay.getContext('2d')!, vw, vh, q);
      setHasDoc(!!q);

      if (q) {
        const prev = prevQuadRef.current;
        const posStable = prev
          ? q.every((pt, i) =>
              Math.abs(pt.x - prev[i].x) < vw * 0.1 &&
              Math.abs(pt.y - prev[i].y) < vh * 0.1
            )
          : false;
        prevQuadRef.current = q;

        if (posStable) {
          if (!stableStartRef.current) stableStartRef.current = now;
          const elapsed = now - stableStartRef.current;
          setCountPct(Math.min(1, elapsed / STABLE_MS));
          if (elapsed >= STABLE_MS && !autoFiredRef.current) {
            autoFiredRef.current = true;
            captureCallbackRef.current();
            return;
          }
        } else {
          stableStartRef.current = 0;
          setCountPct(0);
        }
      } else {
        prevQuadRef.current = null;
        stableStartRef.current = 0;
        setCountPct(0);
      }
    }
    rafRef.current = requestAnimationFrame(renderFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start / restart camera when scanning phase is active
  useEffect(() => {
    if (phase !== 'scanning') return;
    let cancelled = false;
    stableStartRef.current = 0;
    autoFiredRef.current = false;
    prevQuadRef.current = null;
    setReady(false);
    setError(null);
    setHasDoc(false);
    setCountPct(0);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
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

    return () => { cancelled = true; stopCamera(); };
  }, [phase, renderFrame, stopCamera]);

  // Compute display corners when adjustment phase starts
  useEffect(() => {
    if (phase !== 'adjusting' || !captured) return;
    const init = () => {
      const el = adjustContainerRef.current;
      if (!el) return;
      const { imageWidth: iw, imageHeight: ih, corners } = captured;
      const cw = el.clientWidth, ch = el.clientHeight;
      const s = Math.min(cw / iw, ch / ih);
      const ox = (cw - iw * s) / 2, oy = (ch - ih * s) / 2;
      setDispCorners(corners.map(p => ({ x: p.x * s + ox, y: p.y * s + oy })) as Quad);
    };
    requestAnimationFrame(init);
  }, [phase, captured]);

  // Document-level drag listeners
  useEffect(() => {
    if (dragIdx === null) return;
    const el = adjustContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const move = (cx: number, cy: number) => {
      const x = Math.max(0, Math.min(rect.width, cx - rect.left));
      const y = Math.max(0, Math.min(rect.height, cy - rect.top));
      setDispCorners(prev => {
        if (!prev) return prev;
        const next = [...prev] as Quad;
        next[dragIdx] = { x, y };
        return next;
      });
    };

    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
    const end = () => setDragIdx(null);

    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', tm, { passive: false });
    document.addEventListener('touchend', end);
    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', end);
      document.removeEventListener('touchmove', tm);
      document.removeEventListener('touchend', end);
    };
  }, [dragIdx]);

  const confirm = useCallback(async () => {
    if (!captured || !dispCorners) return;
    const el = adjustContainerRef.current;
    if (!el) return;
    setProcessing(true);

    // Defer heavy work so "처리 중..." renders first
    await new Promise(r => setTimeout(r, 50));

    const { imageWidth: iw, imageHeight: ih, imageDataUrl } = captured;
    const cw = el.clientWidth, ch = el.clientHeight;
    const s = Math.min(cw / iw, ch / ih);
    const ox = (cw - iw * s) / 2, oy = (ch - ih * s) / 2;
    const imgCorners = dispCorners.map(p => ({ x: (p.x - ox) / s, y: (p.y - oy) / s })) as Quad;

    const img = new Image();
    img.src = imageDataUrl;
    await new Promise<void>(r => { img.onload = () => r(); });

    const srcCv = document.createElement('canvas');
    srcCv.width = iw; srcCv.height = ih;
    const srcCtx = srcCv.getContext('2d')!;
    srcCtx.drawImage(img, 0, 0);
    const src = srcCtx.getImageData(0, 0, iw, ih);

    const [tl, tr, br, bl] = imgCorners;
    const rawW = Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y));
    const rawH = Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y));
    const sc = Math.min(1, 1600 / Math.max(rawW, rawH));
    const ow = Math.round(rawW * sc), oh = Math.round(rawH * sc);

    const outCv = document.createElement('canvas');
    outCv.width = ow; outCv.height = oh;
    const octx = outCv.getContext('2d')!;
    const od = octx.createImageData(ow, oh);

    // Bilinear quad mapping (inverse: dst → src)
    for (let dy = 0; dy < oh; dy++) {
      const fy = dy / (oh - 1 || 1);
      for (let dx = 0; dx < ow; dx++) {
        const fx = dx / (ow - 1 || 1);
        const sx = (1-fx)*(1-fy)*tl.x + fx*(1-fy)*tr.x + fx*fy*br.x + (1-fx)*fy*bl.x;
        const sy = (1-fx)*(1-fy)*tl.y + fx*(1-fy)*tr.y + fx*fy*br.y + (1-fx)*fy*bl.y;
        const six = Math.min(iw - 1, Math.max(0, Math.round(sx)));
        const siy = Math.min(ih - 1, Math.max(0, Math.round(sy)));
        const si = (siy * iw + six) * 4, di = (dy * ow + dx) * 4;
        od.data[di] = src.data[si];
        od.data[di + 1] = src.data[si + 1];
        od.data[di + 2] = src.data[si + 2];
        od.data[di + 3] = 255;
      }
    }
    octx.putImageData(od, 0, 0);

    // Grayscale + contrast enhancement
    const fin = octx.getImageData(0, 0, ow, oh);
    const d = fin.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      const e = g < 128 ? Math.max(0, g * 0.7) : Math.min(255, 255 - (255 - g) * 0.6);
      d[i] = d[i + 1] = d[i + 2] = Math.round(e);
    }
    octx.putImageData(fin, 0, 0);

    const dataUrl = outCv.toDataURL('image/jpeg', 0.92);
    setProcessing(false);
    onCapture(dataUrl.split(',')[1], 'image/jpeg');
  }, [captured, dispCorners, onCapture]);

  const retake = useCallback(() => {
    setCaptured(null);
    setDispCorners(null);
    setPhase('scanning');
  }, []);

  const close = useCallback(() => { stopCamera(); onClose(); }, [stopCamera, onClose]);

  const openGallery = useCallback(() => { galleryInputRef.current?.click(); }, []);

  const onGalleryFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const corners: Quad = [
          { x: 0, y: 0 }, { x: iw, y: 0 },
          { x: iw, y: ih }, { x: 0, y: ih },
        ];
        stopCamera();
        setCaptured({ imageDataUrl: dataUrl, imageWidth: iw, imageHeight: ih, corners });
        setPhase('adjusting');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [stopCamera]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* ── SCANNING PHASE ── */}
      {phase === 'scanning' && (
        <>
          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '44px 20px 16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)',
          }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>문서 스캔</span>
            <CloseBtnRound onClick={close} />
          </div>

          {/* Camera viewport */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <video ref={videoRef} muted playsInline style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            }} />
            <canvas ref={procCanvasRef} style={{ display: 'none' }} />
            <canvas ref={overlayCanvasRef} style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', pointerEvents: 'none',
            }} />

            {/* Status pill */}
            {ready && (
              <div style={{
                position: 'absolute', bottom: 24, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', pointerEvents: 'none',
              }}>
                <div style={{
                  background: hasDoc ? 'rgba(0,122,255,0.88)' : 'rgba(0,0,0,0.65)',
                  color: '#fff', padding: '8px 20px', borderRadius: 20,
                  fontSize: 13, fontWeight: hasDoc ? 600 : 400,
                  transition: 'background 0.3s',
                }}>
                  {hasDoc ? '문서 감지됨 - 잠시 기다려주세요...' : '문서를 화면 안에 맞춰주세요'}
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#fff', textAlign: 'center', padding: 32, gap: 16,
              }}>
                <div style={{ fontSize: 40 }}>🚫</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{error}</div>
                <button onClick={close} style={{
                  padding: '10px 28px', borderRadius: 10, background: '#fff',
                  color: '#000', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
                }}>닫기</button>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          {!error && (
            <div style={{
              padding: '24px 0 40px', background: 'rgba(0,0,0,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 44,
            }}>
              <button onClick={close} style={{
                color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none',
                fontSize: 14, cursor: 'pointer', minWidth: 48, padding: 0,
              }}>취소</button>

              {/* Shutter with countdown arc */}
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                {hasDoc && (
                  <svg width={96} height={96} style={{ position: 'absolute', top: -8, left: -8 }}>
                    <circle cx={48} cy={48} r={ARC_R} fill="none" stroke="rgba(0,122,255,0.25)" strokeWidth={4} />
                    <circle cx={48} cy={48} r={ARC_R} fill="none"
                      stroke="#007AFF" strokeWidth={4} strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={CIRC * (1 - countPct)}
                      transform="rotate(-90 48 48)"
                    />
                  </svg>
                )}
                <button onClick={doCapture} disabled={!ready} style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: hasDoc ? '#fff' : 'rgba(255,255,255,0.45)',
                  border: `5px solid ${hasDoc ? '#007AFF' : 'rgba(255,255,255,0.35)'}`,
                  cursor: ready ? 'pointer' : 'default',
                  boxShadow: hasDoc ? '0 0 20px rgba(0,122,255,0.5)' : 'none',
                  transition: 'all 0.25s', padding: 0,
                }} />
              </div>

              <button onClick={openGallery} style={{
                color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none',
                fontSize: 14, cursor: 'pointer', minWidth: 48, padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 22 }}>🖼</span>
                <span style={{ fontSize: 11 }}>갤러리</span>
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onGalleryFile}
              />
            </div>
          )}
        </>
      )}

      {/* ── ADJUSTING PHASE ── */}
      {phase === 'adjusting' && captured && (
        <>
          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '44px 20px 12px', background: 'rgba(0,0,0,0.92)',
          }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>영역 조정</span>
            <CloseBtnRound onClick={close} />
          </div>

          <div style={{ padding: '6px 20px 10px', background: 'rgba(0,0,0,0.92)' }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
              꼭짓점을 드래그하여 문서 영역을 조정하세요
            </span>
          </div>

          {/* Adjustment canvas area */}
          <div
            ref={adjustContainerRef}
            style={{
              flex: 1, position: 'relative', overflow: 'hidden',
              background: '#111', userSelect: 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={captured.imageDataUrl}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />

            {dispCorners && (
              <svg style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                overflow: 'visible', touchAction: 'none',
              }}>
                {/* Blue quad overlay */}
                <polygon
                  points={dispCorners.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(0,122,255,0.15)"
                  stroke="rgba(0,122,255,0.85)"
                  strokeWidth={2}
                />
                {/* Corner handles */}
                {dispCorners.map((pt, i) => (
                  <g
                    key={i}
                    onMouseDown={e => { e.preventDefault(); setDragIdx(i); }}
                    onTouchStart={e => { e.preventDefault(); setDragIdx(i); }}
                    style={{ cursor: dragIdx === i ? 'grabbing' : 'grab' }}
                  >
                    <circle cx={pt.x} cy={pt.y} r={24} fill="transparent" />
                    <circle cx={pt.x} cy={pt.y} r={11} fill="#fff" stroke="rgba(0,122,255,0.9)" strokeWidth={2.5} />
                    <circle cx={pt.x} cy={pt.y} r={3.5} fill="rgba(0,122,255,0.9)" />
                  </g>
                ))}
              </svg>
            )}
          </div>

          {/* Bottom buttons */}
          <div style={{
            display: 'flex', gap: 12, padding: '16px 20px 40px',
            background: 'rgba(0,0,0,0.92)',
          }}>
            <button onClick={retake} disabled={processing} style={{
              flex: 1, height: 50, borderRadius: 12,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer',
            }}>
              다시 찍기
            </button>
            <button onClick={confirm} disabled={processing} style={{
              flex: 2, height: 50, borderRadius: 12,
              background: processing ? 'rgba(0,122,255,0.5)' : '#007AFF',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: processing ? 'default' : 'pointer', transition: 'background 0.2s',
            }}>
              {processing ? '처리 중...' : '확인'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CloseBtnRound({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 34, height: 34, borderRadius: '50%',
      background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
      color: '#fff', fontSize: 20, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 0, lineHeight: 1,
    }}>×</button>
  );
}
