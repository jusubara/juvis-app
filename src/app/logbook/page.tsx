'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  EastarEntry, OcrResult, OcrCrew, OcrLeg,
  APP_TYPES, APP_SUFFIXES, AC_TYPE_MAP, PIC_DUTIES,
} from '@/types/logbook';
import {
  loadEntries, saveEntry, bulkSaveEntries, deleteEntry,
  computeStats, fmtTime, normalizeTime, LogbookStats,
} from '@/lib/logbook-storage';
import { downloadCSVLocally, csvToEntries } from '@/lib/google-drive';
import GoogleDriveSync, { GoogleDriveSyncHandle } from '@/components/logbook/GoogleDriveSync';
import { INITIAL_ENTRIES } from '@/data/logbook-initial';

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Helper: parse log date "15-MAY-26" → "5/15" ─────────────────────────────

function parseLogDate(s: string): string {
  if (!s) return '';
  const months: Record<string, string> = {
    JAN:'1',FEB:'2',MAR:'3',APR:'4',MAY:'5',JUN:'6',
    JUL:'7',AUG:'8',SEP:'9',OCT:'10',NOV:'11',DEC:'12',
  };
  const m = s.match(/(\d{1,2})-([A-Z]{3})-(\d{2})/i);
  if (m) return `${months[m[2].toUpperCase()]}/${parseInt(m[1])}`;
  return s;
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepNum({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  const base = 'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white';
  const color = done ? 'bg-green-600' : active ? 'bg-blue-600' : 'bg-gray-300';
  return (
    <div className={`${base} ${color}`}>
      {done ? '✓' : n}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#f5f5f0', borderRadius: 6, padding: '8px 14px', minWidth: 100 }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

// ─── TO/LD cell ──────────────────────────────────────────────────────────────

function ChkCell({ checked }: { checked: boolean }) {
  return (
    <span style={{ fontSize: 13, color: checked ? '#1a56db' : '#ccc' }}>
      {checked ? '☑' : '☐'}
    </span>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LogbookPage() {
  // Online/Offline
  const [isOnline, setIsOnline] = useState(true);

  // Entries state — start with INITIAL_ENTRIES
  const [entries, setEntries] = useState<EastarEntry[]>(INITIAL_ENTRIES);
  const [stats, setStats] = useState<LogbookStats>(computeStats(INITIAL_ENTRIES));
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // OCR state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrData, setOcrData] = useState<OcrResult | null>(null);
  const [activeSteps, setActiveSteps] = useState<Set<number>>(new Set([1]));
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [selectedCrewIdx, setSelectedCrewIdx] = useState(-1);
  const [selectedLegs, setSelectedLegs] = useState<number[]>([]);
  const [appType, setAppType] = useState('');
  const [appSuffix, setAppSuffix] = useState('');
  const [appRwy, setAppRwy] = useState('');
  const [statuses, setStatuses] = useState<Record<number, { msg: string; cls: string }>>({
    1: { msg: '이미지를 업로드한 후 [AI 인식 실행]을 누르세요.', cls: 'info' },
    2: { msg: '크루를 선택하면 내 레그가 필터링됩니다.', cls: 'info' },
    3: { msg: '레그를 선택하세요. 복수 선택 가능합니다.', cls: 'info' },
    4: { msg: 'APP 정보를 입력하고 [로그북에 추가]를 누르세요.', cls: 'info' },
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvImportRef = useRef<HTMLInputElement>(null);
  const driveRef = useRef<GoogleDriveSyncHandle>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);

  // Online detection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load from Supabase on mount
  useEffect(() => {
    loadEntries().then((loaded) => {
      if (loaded.length > 0) {
        // Supabase has data — merge with initial (Supabase takes precedence by ID)
        const supabaseIds = new Set(loaded.map((e) => e.id));
        const filtered = INITIAL_ENTRIES.filter((e) => !supabaseIds.has(e.id));
        const merged = [...loaded, ...filtered];
        setEntries(merged);
        setStats(computeStats(merged));
      }
      setSupabaseLoaded(true);
    }).catch((err) => {
      setSupabaseError(err instanceof Error ? err.message : '연결 실패');
      setSupabaseLoaded(true);
    });
  }, []);

  const setStatus = (n: number, msg: string, cls: string) => {
    setStatuses((prev) => ({ ...prev, [n]: { msg, cls } }));
  };

  const markDone = (n: number) => {
    setDoneSteps((prev) => new Set(Array.from(prev).concat(n)));
  };

  const showStep = (n: number) => {
    setActiveSteps((prev) => new Set(Array.from(prev).concat(n)));
  };

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImageDataUrl(e.target?.result as string);
    reader.readAsDataURL(file);
    setStatus(1, '이미지 로드 완료. [AI 인식 실행]을 누르세요.', 'info');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── OCR ───────────────────────────────────────────────────────────────────

  const runOCR = async () => {
    if (!imageFile) { setStatus(1, '이미지를 먼저 업로드하세요.', 'error'); return; }
    setOcrRunning(true);
    setStatus(1, 'AI가 문서를 분석 중입니다…', 'loading');

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const res = await fetch('/api/parse-logbook', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setStatus(1, `오류: ${data.error || '파싱 실패'}`, 'error');
        setOcrRunning(false);
        return;
      }

      const parsed = data as OcrResult;
      setOcrData(parsed);
      setStatus(1, '인식 완료! 아래에서 크루를 선택하세요.', 'ok');
      markDone(1);
      showStep(2);
    } catch (err) {
      setStatus(1, `네트워크 오류: ${err instanceof Error ? err.message : ''}`, 'error');
    }
    setOcrRunning(false);
  };

  // ── Step 2: Crew selection ────────────────────────────────────────────────

  const selectCrew = (idx: number) => {
    if (!ocrData) return;
    setSelectedCrewIdx(idx);
    const crew = ocrData.crew[idx];
    setStatus(2, `${crew.name} 선택됨.`, 'ok');
    markDone(2);
    setSelectedLegs([]);
    showStep(3);
    setTimeout(() => step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

    // Auto-select legs for this crew
    const myLegs: number[] = [];
    (ocrData.legs ?? []).forEach((leg, i) => {
      const dc = crew.duty_codes?.[String(leg.leg)] || '';
      if (dc) myLegs.push(i);
    });
    setSelectedLegs(myLegs);
    setStatus(3, `${myLegs.length}개 레그 자동 선택됨. 확인 후 다음 단계를 진행하세요.`, 'ok');
    showStep(4);
    setTimeout(() => step4Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
  };

  // ── Step 3: Leg toggle ────────────────────────────────────────────────────

  const toggleLeg = (legIdx: number) => {
    setSelectedLegs((prev) => {
      const next = prev.includes(legIdx) ? prev.filter((x) => x !== legIdx) : [...prev, legIdx];
      setStatus(3, `${next.length}개 레그 선택됨.`, next.length > 0 ? 'ok' : 'info');
      return next;
    });
  };

  // ── Step 4: Add legs to logbook ───────────────────────────────────────────

  const addSelectedLegs = async () => {
    if (!ocrData || selectedCrewIdx < 0) { setStatus(4, '크루를 먼저 선택하세요.', 'error'); return; }
    if (!selectedLegs.length) { setStatus(4, '레그를 최소 1개 선택하세요.', 'error'); return; }

    const myCrew: OcrCrew = ocrData.crew[selectedCrewIdx];
    const myPosition = myCrew.position;
    const appFull = [appType, appSuffix].filter(Boolean).join(' ') + (appRwy ? ' RWY' + appRwy.toUpperCase() : '');
    const dateStr = parseLogDate(ocrData.date_utc);

    const acNoRaw = ocrData.ac_no || '';
    const acType = AC_TYPE_MAP[acNoRaw] || ((ocrData.ac_type || '').toLowerCase().includes('max') ? 'B38M' : 'B738');
    const acNo = acNoRaw ? 'HL' + acNoRaw : '';

    const posMatch = (val: string) => !!val && String(val).trim() === String(myPosition).trim();

    const newEntries: EastarEntry[] = selectedLegs.map((legIdx) => {
      const leg: OcrLeg = ocrData.legs[legIdx];
      const myDuty = myCrew.duty_codes?.[String(leg.leg)] || '';
      const isPic = PIC_DUTIES.includes(myDuty);
      const blockVal = normalizeTime(leg.block_bt || '');
      const picVal = isPic ? blockVal : '';
      const copVal = !isPic && myDuty !== 'A' ? blockVal : '';

      const otherCrew = ocrData.crew
        .filter((_, ci) => ci !== selectedCrewIdx)
        .map((c) => {
          const dc = c.duty_codes?.[String(leg.leg)] || '';
          if (!dc) return null;
          return `${c.name || '?'}/${dc}`;
        })
        .filter(Boolean)
        .join(', ');

      return {
        id: crypto.randomUUID(),
        date: dateStr,
        ac_type: acType,
        ac_ident: acNo,
        from_apt: leg.from || '',
        to_apt: leg.to || '',
        flt_no: (leg.flt_no || '').replace(/^ZE\s*/i, ''),
        pic: picVal,
        picus: '',
        cop: copVal,
        ip: '',
        tr: '',
        block: blockVal,
        night: normalizeTime(leg.night_time || ''),
        inst: normalizeTime(leg.inst_time || ''),
        app_type: appFull,
        to_d: posMatch(leg.crew_to_day),
        to_n: posMatch(leg.crew_to_night),
        ld_d: posMatch(leg.crew_ld_day),
        ld_n: posMatch(leg.crew_ld_night),
        remarks: otherCrew,
        created_at: new Date().toISOString(),
      };
    });

    try {
      const updated = await Promise.all(newEntries.map((e) => saveEntry(e)));
      const finalList = updated[updated.length - 1] ?? [];
      // Merge with initial data
      const supaIds = new Set(finalList.map((e) => e.id));
      const merged = [...finalList, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))];
      setEntries(merged);
      setStats(computeStats(merged));
      driveRef.current?.sync(merged);
      setStatus(4, `${newEntries.length}개 레그가 로그북에 추가되었습니다.`, 'ok');
      resetOcr();
    } catch (err) {
      setStatus(4, `저장 실패: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  };

  // ── Reset OCR ─────────────────────────────────────────────────────────────

  const resetOcr = () => {
    setImageFile(null);
    setImageDataUrl(null);
    setOcrData(null);
    setSelectedCrewIdx(-1);
    setSelectedLegs([]);
    setAppType('');
    setAppSuffix('');
    setAppRwy('');
    setActiveSteps(new Set([1]));
    setDoneSteps(new Set());
    setStatuses({
      1: { msg: '이미지를 업로드한 후 [AI 인식 실행]을 누르세요.', cls: 'info' },
      2: { msg: '크루를 선택하면 내 레그가 필터링됩니다.', cls: 'info' },
      3: { msg: '레그를 선택하세요. 복수 선택 가능합니다.', cls: 'info' },
      4: { msg: 'APP 정보를 입력하고 [로그북에 추가]를 누르세요.', cls: 'info' },
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Delete entry ──────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    // Check if it's an initial entry (not in Supabase)
    const isInitial = INITIAL_ENTRIES.some((e) => e.id === id);
    if (isInitial) {
      const updated = entries.filter((e) => e.id !== id);
      setEntries(updated);
      setStats(computeStats(updated));
      return;
    }
    try {
      const updated = await deleteEntry(id);
      const supaIds = new Set(updated.map((e) => e.id));
      const merged = [...updated, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))];
      setEntries(merged);
      setStats(computeStats(merged));
    } catch (err) {
      alert('삭제 실패: ' + (err instanceof Error ? err.message : ''));
    }
  };

  // ── CSV import ────────────────────────────────────────────────────────────

  const handleCSVImport = async (file: File) => {
    const text = await file.text();
    const imported = csvToEntries(text);
    if (!imported.length) return;
    try {
      const updated = await bulkSaveEntries(imported);
      const supaIds = new Set(updated.map((e) => e.id));
      const merged = [...updated, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))];
      setEntries(merged);
      setStats(computeStats(merged));
    } catch (err) {
      alert('CSV 가져오기 실패: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleDriveImport = async (imported: EastarEntry[]) => {
    try {
      const updated = await bulkSaveEntries(imported);
      const supaIds = new Set(updated.map((e) => e.id));
      const merged = [...updated, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))];
      setEntries(merged);
      setStats(computeStats(merged));
    } catch (err) {
      alert('Drive 가져오기 실패: ' + (err instanceof Error ? err.message : ''));
    }
  };

  // ── Status style ──────────────────────────────────────────────────────────

  const statusStyle = (cls: string): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      loading: { color: '#1a56db', background: '#eff6ff' },
      error:   { color: '#c81e1e', background: '#fef2f2' },
      ok:      { color: '#15803d', background: '#f0fdf4' },
      info:    { color: '#555',    background: '#f8f8f4' },
    };
    return { fontSize: 12, marginTop: 8, padding: '5px 8px', borderRadius: 4, ...(styles[cls] || styles.info) };
  };

  // ── TO/LD hint for step 4 ─────────────────────────────────────────────────

  const renderToldHint = () => {
    if (!ocrData || !selectedLegs.length || selectedCrewIdx < 0) return null;
    const myCrew = ocrData.crew[selectedCrewIdx];
    const myPos = String(myCrew.position);
    const lines = selectedLegs.map((li) => {
      const leg = ocrData.legs[li];
      if (!leg) return null;
      const fmt = (val: string, label: string) => {
        if (!val || val === '') return `${label}: —`;
        return `${label}: ${val}번${String(val) === myPos ? ' (나✓)' : ' (상대)'}`;
      };
      return `LEG${leg.leg} | ${fmt(leg.crew_to_day,'T/O Day')} · ${fmt(leg.crew_to_night,'T/O Night')} · ${fmt(leg.crew_ld_day,'L/D Day')} · ${fmt(leg.crew_ld_night,'L/D Night')}`;
    }).filter(Boolean);

    if (!lines.length) return null;
    return (
      <div style={{ marginTop: 8, padding: '7px 10px', background: '#fef9ec', border: '1px solid #fcd34d', borderRadius: 5, fontSize: 11, color: '#78350f', lineHeight: 1.6 }}>
        <strong>OCR 인식 TO/LD 참고값</strong> — 로그북 추가 후 직접 확인하세요<br />
        {lines.map((l, i) => <span key={i}>{l}<br /></span>)}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid #ddd', borderRadius: 5,
    fontSize: 12, fontFamily: 'inherit', background: '#fff', color: '#1a1a1a',
    outline: 'none',
  };

  const btnStyle = (variant: 'primary' | 'default' | 'danger' = 'default'): React.CSSProperties => {
    const variants: Record<string, React.CSSProperties> = {
      primary: { background: '#1a56db', color: '#fff', borderColor: '#1a56db', fontWeight: 600 },
      danger:  { color: '#c81e1e', borderColor: '#fca5a5' },
      default: { background: '#fff', color: '#1a1a1a', borderColor: '#ccc' },
    };
    return {
      padding: '7px 14px', fontSize: 12, borderRadius: 5, border: '1px solid #ccc',
      background: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      ...variants[variant],
    };
  };

  return (
    <main style={{ minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, color: '#1a1a1a', background: '#f0f0ea' }}>

      {/* ── JUVIS JARVIS Header (dark) ───────────────────────────────────── */}
      <header className="grid-bg relative" style={{ background: '#020c14', borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-xs font-mono text-cyan-600 hover:text-cyan-400 transition-colors">
              ← JUVIS
            </Link>
            <div className="w-px h-4 bg-cyan-500/30" />
            <div>
              <h1 className="text-lg font-bold text-cyan-300 font-mono tracking-widest glow-text">LOGBOOK</h1>
              <p className="text-[10px] text-cyan-600 font-mono">EASTAR JET — Electronic Flight Log</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {supabaseError && (
              <span className="text-[10px] font-mono text-yellow-400">⚠ Supabase 오프라인</span>
            )}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
              <span className={`text-[10px] font-mono ${isOnline ? 'text-emerald-500' : 'text-red-400'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="w-px h-3 bg-cyan-500/20" />
            <div className="status-dot" />
            <span className="text-xs font-mono text-cyan-400">ACTIVE</span>
          </div>
        </div>

        {/* Sync toolbar */}
        <div className="max-w-screen-2xl mx-auto px-4 pb-2 flex flex-wrap items-center justify-between gap-3">
          <GoogleDriveSync ref={driveRef} onImport={handleDriveImport} />
          <div className="flex items-center gap-2">
            <input ref={csvImportRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVImport(f); e.target.value = ''; }} />
            <button onClick={() => entries.length > 0 && downloadCSVLocally(entries)} disabled={entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-500/20 text-[10px] font-mono text-cyan-600 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              ↓ EXPORT CSV
            </button>
            <button onClick={() => csvImportRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-500/20 text-[10px] font-mono text-cyan-600 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors">
              ↑ IMPORT CSV
            </button>
          </div>
        </div>
      </header>

      {/* ── OCR Panel (white/light) ──────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '2px solid #e8e8e0' }}>
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a1a1a' }}>
            Flight &amp; Maintenance Log 스캔 입력
            <span style={{ fontSize: 11, fontWeight: 400, color: '#888', marginLeft: 6 }}>
              사진 → 크루 선택 → 레그 선택 → APP 입력 → 추가
            </span>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${isDragging ? '#1a56db' : imageDataUrl ? '#86efac' : '#ccc'}`,
              borderRadius: 8, padding: '22px 16px', textAlign: 'center', cursor: 'pointer',
              background: isDragging ? '#eff4ff' : imageDataUrl ? '#f0fdf4' : '#fafaf8',
              transition: 'border-color .2s, background .2s',
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ fontSize: 26, marginBottom: 5 }}>📄</div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 2 }}>
              Flight &amp; Maintenance Log 사진을 드래그하거나 클릭하여 업로드
            </div>
            <div style={{ fontSize: 11, color: '#aaa' }}>JPG · PNG 지원</div>
          </div>

          {/* STEP 1 — AI 인식 */}
          <div style={{ border: '1px solid #e8e8e0', borderRadius: 8, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#f8f8f4', borderBottom: '1px solid #e8e8e0' }}>
              <StepNum n={1} active={activeSteps.has(1)} done={doneSteps.has(1)} />
              <span style={{ fontSize: 12, fontWeight: 600, color: activeSteps.has(1) ? '#1a1a1a' : '#555' }}>AI 인식</span>
              <button onClick={runOCR} disabled={!imageFile || ocrRunning}
                style={{ ...btnStyle('primary'), marginLeft: 'auto', opacity: (!imageFile || ocrRunning) ? 0.45 : 1 }}>
                {ocrRunning ? '분석 중…' : '🤖 AI 인식 실행'}
              </button>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* Image preview */}
                <div style={{ flex: '0 0 200px', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', background: '#f5f5f2', minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imageDataUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={imageDataUrl} alt="preview" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }} />
                    : <span style={{ color: '#ccc', fontSize: 11, padding: 20 }}>이미지 대기 중</span>}
                </div>
                {/* OCR result summary */}
                {ocrData && (
                  <div style={{ background: '#f8f8f4', border: '1px solid #e0e0d8', borderRadius: 6, padding: '10px 12px', fontSize: 12, flex: 1 }}>
                    {[
                      { label: '날짜 (UTC)', value: ocrData.date_utc, hi: true },
                      { label: '항공기', value: `HL${ocrData.ac_no} · ${ocrData.ac_type}`, hi: false },
                      { label: 'LOG PAGE', value: ocrData.log_page, hi: false },
                      { label: '인식 레그 수', value: `${ocrData.legs?.length ?? 0}개`, hi: false },
                    ].map((r) => (
                      <div key={r.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
                        <span style={{ color: '#888', fontSize: 11, minWidth: 72 }}>{r.label}</span>
                        <span style={{ fontWeight: 600, color: r.hi ? '#15803d' : '#1a1a1a' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={statusStyle(statuses[1].cls)}>{statuses[1].msg}</div>
            </div>
          </div>

          {/* STEP 2 — 크루 선택 */}
          {activeSteps.has(2) && (
            <div style={{ border: '1px solid #e8e8e0', borderRadius: 8, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#f8f8f4', borderBottom: '1px solid #e8e8e0' }}>
                <StepNum n={2} active={activeSteps.has(2)} done={doneSteps.has(2)} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>크루 선택 — 나는 누구인가?</span>
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(ocrData?.crew ?? []).map((crew: OcrCrew, i: number) => {
                    const isSelected = selectedCrewIdx === i;
                    return (
                      <div key={i} onClick={() => selectCrew(i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                          border: `1.5px solid ${isSelected ? '#1a56db' : '#e0e0d8'}`,
                          borderRadius: 7, cursor: 'pointer', background: isSelected ? '#eff6ff' : '#fff',
                          transition: 'border-color .15s, background .15s',
                        }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          background: isSelected ? '#1a56db' : '#f0f0ea', color: isSelected ? '#fff' : '#666',
                        }}>{i + 1}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{crew.name || '(이름 불명)'}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{crew.emp_no ? `사번 ${crew.emp_no}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
                          {[1,2,3,4].map((n) => {
                            const dc = crew.duty_codes?.[String(n)] || '';
                            if (!dc) return null;
                            return (
                              <span key={n} style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                                background: isSelected ? '#dbeafe' : '#f0f0ea',
                                color: isSelected ? '#1e40af' : '#555',
                              }}>L{n}:{dc}</span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={statusStyle(statuses[2].cls)}>{statuses[2].msg}</div>
              </div>
            </div>
          )}

          {/* STEP 3 — 레그 선택 */}
          {activeSteps.has(3) && (
            <div ref={step3Ref} style={{ border: '1px solid #e8e8e0', borderRadius: 8, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#f8f8f4', borderBottom: '1px solid #e8e8e0' }}>
                <StepNum n={3} active={activeSteps.has(3)} done={doneSteps.has(3)} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>레그 선택 — 내 비행 레그</span>
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                  {(ocrData?.legs ?? []).map((leg: OcrLeg, i: number) => {
                    const myCrew = selectedCrewIdx >= 0 ? ocrData?.crew[selectedCrewIdx] : null;
                    const myDuty = myCrew?.duty_codes?.[String(leg.leg)] || '';
                    const isMine = !!myDuty;
                    const isSelected = selectedLegs.includes(i);
                    return (
                      <div key={i} onClick={() => isMine && toggleLeg(i)}
                        style={{
                          border: `1.5px solid ${isSelected ? '#1a56db' : '#e0e0d8'}`,
                          borderRadius: 7, padding: '9px 12px',
                          cursor: isMine ? 'pointer' : 'default',
                          background: isSelected ? '#eff6ff' : '#fff',
                          opacity: isMine ? 1 : 0.38,
                          transition: 'border-color .15s, background .15s',
                        }}>
                        {myDuty && (
                          <div style={{ display: 'inline-block', padding: '1px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 3, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                            DUTY: {myDuty}
                          </div>
                        )}
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                          {leg.from || '?'} → {leg.to || '?'}
                        </div>
                        <div style={{ fontSize: 11, color: '#666', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {leg.flt_no && <span>ZE {leg.flt_no}</span>}
                          {leg.block_bt && <span>Block: {leg.block_bt}</span>}
                          {leg.night_time && <span>Night: {leg.night_time}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={statusStyle(statuses[3].cls)}>{statuses[3].msg}</div>
              </div>
            </div>
          )}

          {/* STEP 4 — Approach 입력 */}
          {activeSteps.has(4) && (
            <div ref={step4Ref} style={{ border: '1px solid #e8e8e0', borderRadius: 8, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#f8f8f4', borderBottom: '1px solid #e8e8e0' }}>
                <StepNum n={4} active={activeSteps.has(4)} done={doneSteps.has(4)} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>Approach 정보 입력</span>
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>APP TYPE</label>
                    <select value={appType} onChange={(e) => setAppType(e.target.value)} style={inputStyle}>
                      {APP_TYPES.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>
                      SUFFIX <span style={{ fontWeight: 400, color: '#aaa' }}>(APP TYPE에 병기)</span>
                    </label>
                    <select value={appSuffix} onChange={(e) => setAppSuffix(e.target.value)} style={inputStyle}>
                      {APP_SUFFIXES.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>
                      RWY <span style={{ fontWeight: 400, color: '#aaa' }}>(APP TYPE에 병기)</span>
                    </label>
                    <input type="text" placeholder="예: 34L" value={appRwy}
                      onChange={(e) => setAppRwy(e.target.value.toUpperCase())} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={addSelectedLegs} style={btnStyle('primary')}>
                    ✅ 선택 레그 로그북에 추가
                  </button>
                  <button onClick={resetOcr} style={btnStyle()}>↺ 처음부터</button>
                </div>

                {renderToldHint()}
                <div style={statusStyle(statuses[4].cls)}>{statuses[4].msg}</div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee', flexWrap: 'wrap' }}>
        <StatCard label="Block time" value={fmtTime(stats.totalBlockMinutes)} />
        <StatCard label="Night time" value={fmtTime(stats.totalNightMinutes)} />
        <StatCard label="PIC" value={fmtTime(stats.totalPicMinutes)} />
        <StatCard label="Co-pilot" value={fmtTime(stats.totalCopMinutes)} />
        <StatCard label="Sectors" value={stats.flightCount} />
        <StatCard label="T/O (Day)" value={stats.toDay} />
        <StatCard label="T/O (Night)" value={stats.toNight} />
        <StatCard label="L/D (Day)" value={stats.ldDay} />
        <StatCard label="L/D (Night)" value={stats.ldNight} />
        {!supabaseLoaded && (
          <div style={{ alignSelf: 'center', fontSize: 11, color: '#888' }}>
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-1" />
            Supabase 로딩 중…
          </div>
        )}
      </div>

      {/* ── Logbook Table ─────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', background: '#fff' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1200, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 24 }} />  {/* # */}
            <col style={{ width: 50 }} />  {/* DATE */}
            <col style={{ width: 62 }} />  {/* A/C TYPE */}
            <col style={{ width: 50 }} />  {/* A/C NO. */}
            <col style={{ width: 38 }} />  {/* FROM */}
            <col style={{ width: 38 }} />  {/* TO */}
            <col style={{ width: 42 }} />  {/* FLT NO. */}
            <col style={{ width: 42 }} />  {/* PIC */}
            <col style={{ width: 44 }} />  {/* PICUS */}
            <col style={{ width: 42 }} />  {/* COP */}
            <col style={{ width: 30 }} />  {/* IP */}
            <col style={{ width: 30 }} />  {/* TR */}
            <col style={{ width: 46 }} />  {/* BLOCK */}
            <col style={{ width: 40 }} />  {/* NIGHT */}
            <col style={{ width: 40 }} />  {/* INST */}
            <col style={{ width: 110 }} /> {/* APP TYPE */}
            <col style={{ width: 28 }} />  {/* TO D */}
            <col style={{ width: 28 }} />  {/* TO N */}
            <col style={{ width: 28 }} />  {/* LD D */}
            <col style={{ width: 28 }} />  {/* LD N */}
            <col style={{ width: 100 }} /> {/* REMARKS */}
            <col style={{ width: 26 }} />  {/* DEL */}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={thStyle({ width: 24, fontSize: 10, color: '#bbb' })}>#</th>
              <th rowSpan={2} style={thStyle({ width: 50 })}>DATE<br />(UTC)</th>
              <th colSpan={2} style={thStyle({ background: '#e2e2da', color: '#444' })}>AIRCRAFT</th>
              <th colSpan={2} style={thStyle({ background: '#e2e2da', color: '#444' })}>ROUTE OF FLIGHT</th>
              <th rowSpan={2} style={thStyle({ width: 42 })}>FLT<br />NO.</th>
              <th colSpan={6} style={thStyle({ background: '#e2e2da', color: '#444' })}>TYPE OF PILOTING TIME</th>
              <th colSpan={2} style={thStyle({ background: '#e2e2da', color: '#444' })}>CONDITIONS</th>
              <th rowSpan={2} style={thStyle({ width: 110 })}>APP<br />TYPE</th>
              <th colSpan={2} style={thStyle({ background: '#e2e2da', color: '#444' })}>TO</th>
              <th colSpan={2} style={thStyle({ background: '#e2e2da', color: '#444' })}>LD</th>
              <th rowSpan={2} style={thStyle({ width: 100 })}>REMARKS</th>
              <th rowSpan={2} style={thStyle({ width: 26 })} />
            </tr>
            <tr>
              <th style={thStyle({ width: 62 })}>A/C TYPE</th>
              <th style={thStyle({ width: 50 })}>A/C NO.</th>
              <th style={thStyle({ width: 38 })}>FROM</th>
              <th style={thStyle({ width: 38 })}>TO</th>
              <th style={thStyle({ width: 42 })}>PIC</th>
              <th style={thStyle({ width: 44 })}>PIC<br />UNDER<br />SUPVSN</th>
              <th style={thStyle({ width: 42 })}>CO-<br />PILOT</th>
              <th style={thStyle({ width: 30 })}>IP</th>
              <th style={thStyle({ width: 30 })}>TR</th>
              <th style={thStyle({ width: 46 })}>BLOCK<br />TIME</th>
              <th style={thStyle({ width: 40 })}>NIGHT</th>
              <th style={thStyle({ width: 40 })}>INST</th>
              <th style={thStyle({ width: 28 })}>D</th>
              <th style={thStyle({ width: 28 })}>N</th>
              <th style={thStyle({ width: 28 })}>D</th>
              <th style={thStyle({ width: 28 })}>N</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafaf8' }}>
                <td style={tdStyle({ fontSize: 10, color: '#bbb' })}>{i + 1}</td>
                <td style={tdStyle()}>{e.date}</td>
                <td style={tdStyle()}>{e.ac_type}</td>
                <td style={tdStyle()}>{e.ac_ident}</td>
                <td style={tdStyle()}>{e.from_apt}</td>
                <td style={tdStyle()}>{e.to_apt}</td>
                <td style={tdStyle()}>{e.flt_no}</td>
                <td style={tdStyle()}>{e.pic}</td>
                <td style={tdStyle()}>{e.picus}</td>
                <td style={tdStyle()}>{e.cop}</td>
                <td style={tdStyle()}>{e.ip}</td>
                <td style={tdStyle()}>{e.tr}</td>
                <td style={tdStyle({ fontWeight: 600 })}>{e.block}</td>
                <td style={tdStyle()}>{e.night}</td>
                <td style={tdStyle()}>{e.inst}</td>
                <td style={{ ...tdStyle(), textAlign: 'left', paddingLeft: 4, fontSize: 11 }}>{e.app_type}</td>
                <td style={tdStyle()}><ChkCell checked={e.to_d} /></td>
                <td style={tdStyle()}><ChkCell checked={e.to_n} /></td>
                <td style={tdStyle()}><ChkCell checked={e.ld_d} /></td>
                <td style={tdStyle()}><ChkCell checked={e.ld_n} /></td>
                <td style={{ ...tdStyle(), textAlign: 'left', paddingLeft: 4, fontSize: 11 }}>{e.remarks}</td>
                <td style={tdStyle()}>
                  <button onClick={() => handleDelete(e.id)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc', padding: '2px 5px', fontSize: 15 }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.color = '#e53e3e')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.color = '#ccc')}
                    title="삭제">×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ ...tdStyle(), textAlign: 'left', paddingLeft: 8, fontSize: 10, color: '#666', background: '#ebebе4', fontWeight: 600 }}>
                PAGE TOTALS
              </td>
              <td style={tfootTd()}>{stats.totalPicMinutes > 0 ? fmtTime(stats.totalPicMinutes) : ''}</td>
              <td style={tfootTd()} />
              <td style={tfootTd()}>{stats.totalCopMinutes > 0 ? fmtTime(stats.totalCopMinutes) : ''}</td>
              <td style={tfootTd()} />
              <td style={tfootTd()} />
              <td style={tfootTd()}>{stats.totalBlockMinutes > 0 ? fmtTime(stats.totalBlockMinutes) : ''}</td>
              <td style={tfootTd()}>{stats.totalNightMinutes > 0 ? fmtTime(stats.totalNightMinutes) : ''}</td>
              <td style={tfootTd()} />
              <td style={tfootTd()} />
              <td style={tfootTd()}>{stats.toDay || ''}</td>
              <td style={tfootTd()}>{stats.toNight || ''}</td>
              <td style={tfootTd()}>{stats.ldDay || ''}</td>
              <td style={tfootTd()}>{stats.ldNight || ''}</td>
              <td colSpan={2} style={tfootTd()} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Bottom button bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>
          {entries.length}개 기록
          {supabaseError ? ' · Supabase 오프라인 (로컬 표시)' : supabaseLoaded ? ' · Supabase 연동됨' : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => entries.length > 0 && downloadCSVLocally(entries)} style={btnStyle()}>
            📥 CSV 내보내기
          </button>
        </div>
      </div>

    </main>
  );
}

// ─── Table cell style helpers ─────────────────────────────────────────────────

function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #ccc', padding: '4px 2px', textAlign: 'center', verticalAlign: 'middle',
    background: '#edede6', fontSize: 10, fontWeight: 600, color: '#555', lineHeight: 1.3, whiteSpace: 'nowrap',
    ...extra,
  };
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #ccc', padding: '3px 2px', textAlign: 'center', verticalAlign: 'middle',
    fontSize: 11, ...extra,
  };
}

function tfootTd(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #ccc', padding: '5px 2px', textAlign: 'center', verticalAlign: 'middle',
    background: '#ebebе4', fontSize: 11, fontWeight: 600, ...extra,
  };
}
