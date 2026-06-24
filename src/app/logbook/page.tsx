'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import {
  EastarEntry, OcrResult, OcrCrew, OcrLeg,
  APP_TYPES, APP_SUFFIXES, AC_TYPE_MAP, PIC_DUTIES,
} from '@/types/logbook';
import {
  loadEntries, saveEntry, bulkSaveEntries, deleteEntry, deleteAllEntries,
  computeStats, fmtTime, normalizeTime,
} from '@/lib/logbook-storage';
import { downloadCSVLocally, csvToEntries } from '@/lib/google-drive';
import GoogleDriveSync, { GoogleDriveSyncHandle } from '@/components/logbook/GoogleDriveSync';
import CameraScanner from '@/components/logbook/CameraScanner';
import { INITIAL_ENTRIES } from '@/data/logbook-initial';
import { AIRPORT_TZ } from '@/lib/pay-calculator/calculator';

// ─── Helper: parse log date "15-MAY-26" → { date: "5/15", year: 2026 } ────────

const MONTH_MAP: Record<string, string> = {
  JAN:'1',FEB:'2',MAR:'3',APR:'4',MAY:'5',JUN:'6',
  JUL:'7',AUG:'8',SEP:'9',OCT:'10',NOV:'11',DEC:'12',
};

function parseLogDate(s: string): string {
  if (!s) return '';
  const m = s.match(/(\d{1,2})-([A-Z]{3})-(\d{2})/i);
  if (m) return `${MONTH_MAP[m[2].toUpperCase()]}/${parseInt(m[1])}`;
  return s;
}

function parseLogYear(s: string): number {
  const m = s.match(/(\d{1,2})-([A-Z]{3})-(\d{2})/i);
  if (m) return 2000 + parseInt(m[3]);
  return new Date().getFullYear();
}

// ─── UTC → LCL date display ───────────────────────────────────────────────────

function getDisplayDate(entry: EastarEntry, mode: 'UTC' | 'LCL'): string {
  if (mode === 'UTC') return entry.date;
  // LCL mode: date_lcl 우선
  if (entry.date_lcl) return entry.date_lcl;
  if (!entry.date) return '';
  const iso = entry.created_at;
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return entry.date;
  // ramp_out(HH:MM UTC)이 있으면 그걸로 정확한 LCL 날짜 계산
  let utcDate: Date;
  if (entry.ramp_out && /^\d{2}:\d{2}$/.test(entry.ramp_out)) {
    utcDate = new Date(`${iso.substring(0, 10)}T${entry.ramp_out}:00Z`);
  } else {
    utcDate = new Date(iso);
  }
  if (isNaN(utcDate.getTime())) return entry.date;
  const tz = AIRPORT_TZ[entry.from_apt?.toUpperCase() ?? ''] ?? 9;
  const lclMs = utcDate.getTime() + tz * 3600 * 1000;
  const lclDate = new Date(lclMs);
  return `${lclDate.getUTCMonth() + 1}/${lclDate.getUTCDate()}`;
}

// ─── Year from entry ──────────────────────────────────────────────────────────

function entryYear(e: EastarEntry): number {
  const caYear = parseInt(e.created_at?.substring(0, 4) || '0');
  if (caYear > 2000) return caYear;

  // Fallback: infer from date (M/D format) month
  const month = parseInt(e.date?.split('/')[0] || '0');
  if (!month) return 0;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  // Months past current month → likely previous year
  return month > curMonth ? curYear - 1 : curYear;
}

// ─── LCL 모드 연도 추론 (UTC→LCL 날짜 변경시 연도 보정) ─────────────────────

function entryYearLCL(e: EastarEntry): number {
  if (!e.date_lcl) return entryYear(e);
  const lclMon = parseInt(e.date_lcl.split('/')[0] || '0');
  if (!lclMon) return entryYear(e);
  const utcYear = parseInt(e.created_at?.substring(0, 4) || '0');
  if (!utcYear) return entryYear(e);
  const utcMon = parseInt(e.created_at?.substring(5, 7) || '0');
  // UTC Dec 31 → LCL Jan 1: 연도 +1
  if (lclMon === 1 && utcMon === 12) return utcYear + 1;
  return utcYear;
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepNum({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  const base = 'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white';
  const color = done ? 'bg-green-600' : active ? 'bg-blue-600' : 'bg-gray-300';
  return <div className={`${base} ${color}`}>{done ? '✓' : n}</div>;
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

// ─── Time fields set ─────────────────────────────────────────────────────────

const TIME_FIELDS = new Set(['pic', 'picus', 'cop', 'ip', 'tr', 'block', 'night', 'inst']);

// ─── Sortable table row ───────────────────────────────────────────────────────

function SortableRow({ id, index, children }: { id: string; index: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        background: index % 2 === 0 ? '#fff' : '#fafaf8',
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
      }}
      {...attributes}
    >
      <td
        style={{ border: '1px solid #ccc', padding: '3px 2px', textAlign: 'center', verticalAlign: 'middle', color: '#ccc', fontSize: 14, cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
        {...listeners}
      >
        ⠿
      </td>
      {children}
    </tr>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LogbookPage() {
  // Online/Offline
  const [isOnline, setIsOnline] = useState(true);

  // Entries state
  const [entries, setEntries] = useState<EastarEntry[]>(INITIAL_ENTRIES);
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // Year + Month filter
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // UTC/LCL toggle
  const [dateMode, setDateMode] = useState<'UTC' | 'LCL'>('UTC');

  // Cell editing (post-save table)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // OCR state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [compressedImage, setCompressedImage] = useState<{base64: string, mime: string} | null>(null);
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

  // Crew inline editing (STEP 2)
  const [editingCrewField, setEditingCrewField] = useState<{ idx: number; field: 'name' | 'emp_no' } | null>(null);
  const [editingCrewValue, setEditingCrewValue] = useState('');

  // OCR A/C No / Type editing (STEP 1 summary)
  const [editingOcrAc, setEditingOcrAc] = useState<'no' | 'type' | null>(null);
  const [editingOcrAcValue, setEditingOcrAcValue] = useState('');

  // Leg field inline editing (STEP 3)
  const [editingLeg, setEditingLeg] = useState<{ idx: number; field: keyof OcrLeg } | null>(null);
  const [editingLegValue, setEditingLegValue] = useState('');

  // Camera scanner
  const [showScanner, setShowScanner] = useState(false);

  const handleCameraCapture = useCallback((base64: string, mimeType: string) => {
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: mimeType });
    const file = new File([blob], 'camera-scan.jpg', { type: mimeType });
    setImageFile(file);
    setCompressedImage({ base64, mime: mimeType });
    setImageDataUrl(`data:${mimeType};base64,${base64}`);
    setStatus(1, '카메라 스캔 완료. [AI 인식 실행]을 누르세요.', 'info');
    setShowScanner(false);
  }, []);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const csvImportRef = useRef<HTMLInputElement>(null);
  const driveRef = useRef<GoogleDriveSyncHandle>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);

  // ── Derived state ──────────────────────────────────────────────────────────

  const stats = useMemo(() => computeStats(entries), [entries]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    entries.forEach((e) => {
      const y = entryYearLCL(e);
      if (y > 2000) years.add(y);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [entries]);

  // Auto-select latest year once data loads
  useEffect(() => {
    if (availableYears.length > 0 && selectedYear === null) {
      setSelectedYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, selectedYear]);

  const availableMonths = useMemo(() => {
    const getLclMonth = (e: EastarEntry) =>
      parseInt((e.date_lcl || e.date)?.split('/')[0] || '0');
    const source = selectedYear !== null
      ? entries.filter((e) => entryYearLCL(e) === selectedYear)
      : entries;
    const months = new Set<number>();
    source.forEach((e) => {
      const m = getLclMonth(e);
      if (m > 0) months.add(m);
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [entries, selectedYear]);

  const filteredEntries = useMemo(() => {
    const getLclMonth = (e: EastarEntry) =>
      parseInt((e.date_lcl || e.date)?.split('/')[0] || '0');
    let result = entries;
    if (selectedYear !== null) {
      result = result.filter((e) => entryYearLCL(e) === selectedYear);
    }
    if (selectedMonth !== null) {
      result = result.filter((e) => getLclMonth(e) === selectedMonth);
    }
    return result;
  }, [entries, selectedYear, selectedMonth]);

  const filteredStats = useMemo(() => computeStats(filteredEntries), [filteredEntries]);

  // Reset month when year changes if that month isn't in new year
  useEffect(() => {
    if (selectedMonth !== null && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(null);
    }
  }, [availableMonths, selectedMonth]);

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
        const supabaseIds = new Set(loaded.map((e) => e.id));
        const filtered = INITIAL_ENTRIES.filter((e) => !supabaseIds.has(e.id));
        const merged = [...loaded, ...filtered];
        setEntries(merged);
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

  const markDone = (n: number) => setDoneSteps((prev) => new Set(Array.from(prev).concat(n)));
  const showStep = (n: number) => setActiveSteps((prev) => new Set(Array.from(prev).concat(n)));

  // ── File handling ──────────────────────────────────────────────────────────

  const compressImage = (file: File): Promise<{base64: string, mime: string}> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1920;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);
        resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg' });
      };
      img.src = url;
    });
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const compressed = await compressImage(file);
    setCompressedImage(compressed);
    setImageDataUrl(`data:${compressed.mime};base64,${compressed.base64}`);
    setStatus(1, '이미지 로드 완료. [AI 인식 실행]을 누르세요.', 'info');
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (compressedImage) {
      const byteChars = atob(compressedImage.base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: compressedImage.mime });
      formData.append('image', blob, 'image.jpg');
    } else {
      formData.append('image', imageFile);
    }

    try {
      const res = await fetch('/api/parse-logbook', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setStatus(1, `오류: ${data.error || '파싱 실패'}`, 'error');
        setOcrRunning(false);
        return;
      }
      setOcrData(data as OcrResult);
      setStatus(1, '인식 완료! 아래에서 크루를 선택하세요.', 'ok');
      markDone(1);
      showStep(2);
    } catch (err) {
      setStatus(1, `네트워크 오류: ${err instanceof Error ? err.message : ''}`, 'error');
    }
    setOcrRunning(false);
  };

  // ── OCR A/C editing ───────────────────────────────────────────────────────

  const handleOcrAcSave = (field: 'no' | 'type', value: string) => {
    if (!ocrData) return;
    if (field === 'no') {
      const acType = AC_TYPE_MAP[value] || ocrData.ac_type;
      setOcrData({ ...ocrData, ac_no: value, ac_type: acType });
    } else {
      setOcrData({ ...ocrData, ac_type: value });
    }
    setEditingOcrAc(null);
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

  // ── Crew inline edit ──────────────────────────────────────────────────────

  const handleCrewEdit = (idx: number, field: 'name' | 'emp_no', value: string) => {
    if (!ocrData) return;
    const newCrew = ocrData.crew.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    setOcrData({ ...ocrData, crew: newCrew });
    setEditingCrewField(null);
  };

  // ── Step 3: Leg toggle + inline edit ──────────────────────────────────────

  const toggleLeg = (legIdx: number) => {
    setSelectedLegs((prev) => {
      const next = prev.includes(legIdx) ? prev.filter((x) => x !== legIdx) : [...prev, legIdx];
      setStatus(3, `${next.length}개 레그 선택됨.`, next.length > 0 ? 'ok' : 'info');
      return next;
    });
  };

  const handleLegEdit = (idx: number, field: keyof OcrLeg, value: string) => {
    if (!ocrData) return;
    const newLegs = ocrData.legs.map((l, i) => i === idx ? { ...l, [field]: value } : l);
    setOcrData({ ...ocrData, legs: newLegs });
    setEditingLeg(null);
  };

  // ── Step 4: Add legs to logbook ───────────────────────────────────────────

  const addSelectedLegs = async () => {
    if (!ocrData || selectedCrewIdx < 0) { setStatus(4, '크루를 먼저 선택하세요.', 'error'); return; }
    if (!selectedLegs.length) { setStatus(4, '레그를 최소 1개 선택하세요.', 'error'); return; }

    const myCrew: OcrCrew = ocrData.crew[selectedCrewIdx];
    const myPosition = myCrew.position;
    const appFull = [appType, appSuffix].filter(Boolean).join(' ') + (appRwy ? ' RWY' + appRwy.toUpperCase() : '');
    const dateStr = parseLogDate(ocrData.date_utc);

    // Use flight date year for created_at so year filter works correctly
    const flightYear = parseLogYear(ocrData.date_utc);
    const [fMon, fDay] = dateStr.split('/');
    const flightCreatedAt = `${flightYear}-${String(fMon).padStart(2,'0')}-${String(fDay).padStart(2,'0')}T00:00:00Z`;

    const acNoRaw = ocrData.ac_no || '';
    const acType = AC_TYPE_MAP[acNoRaw] || ((ocrData.ac_type || '').toLowerCase().includes('max') ? 'B38M' : 'B738');
    const acNo = acNoRaw ? 'HL' + acNoRaw : '';

    const posMatch = (val: string) => !!val && String(val).trim() === String(myPosition).trim();

    // Compute base sort_order for new entries
    const flightDatePrefix = flightCreatedAt.substring(0, 10);
    const sameDateEntries = entries.filter((e) => e.created_at?.substring(0, 10) === flightDatePrefix);
    const baseSortOrder = sameDateEntries.length > 0
      ? Math.max(...sameDateEntries.map((e) => e.sort_order ?? 0))
      : Math.max(0, ...entries.map((e) => e.sort_order ?? 0));

    const newEntries: EastarEntry[] = selectedLegs.map((legIdx, si) => {
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
        created_at: flightCreatedAt,
        sort_order: baseSortOrder + si + 1,
        ramp_out: leg.block_ro || '',
        ramp_in: leg.block_ri || '',
        take_off: leg.block_to || '',
        landing: leg.block_ld || '',
      };
    });

    try {
      const updated = await Promise.all(newEntries.map((e) => saveEntry(e)));
      const finalList = updated[updated.length - 1] ?? [];
      const supaIds = new Set(finalList.map((e) => e.id));
      const merged = [...finalList, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))];
      setEntries(merged);
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
    setCompressedImage(null);
    setOcrData(null);
    setSelectedCrewIdx(-1);
    setSelectedLegs([]);
    setAppType('');
    setAppSuffix('');
    setAppRwy('');
    setActiveSteps(new Set([1]));
    setDoneSteps(new Set());
    setEditingCrewField(null);
    setEditingLeg(null);
    setEditingOcrAc(null);
    setStatuses({
      1: { msg: '이미지를 업로드한 후 [AI 인식 실행]을 누르세요.', cls: 'info' },
      2: { msg: '크루를 선택하면 내 레그가 필터링됩니다.', cls: 'info' },
      3: { msg: '레그를 선택하세요. 복수 선택 가능합니다.', cls: 'info' },
      4: { msg: 'APP 정보를 입력하고 [로그북에 추가]를 누르세요.', cls: 'info' },
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // ── Drag-and-drop reorder ─────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = entries.findIndex((e) => e.id === active.id);
    const newIdx = entries.findIndex((e) => e.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(entries, oldIdx, newIdx).map((e, i) => ({
      ...e,
      sort_order: i + 1,
    }));
    setEntries(reordered);

    try {
      await bulkSaveEntries(reordered);
    } catch (err) {
      console.error('sort_order 저장 실패:', err);
    }
  };

  // ── Delete entry ──────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const isInitial = INITIAL_ENTRIES.some((e) => e.id === id);
    if (isInitial) { setEntries((prev) => prev.filter((e) => e.id !== id)); return; }
    try {
      const updated = await deleteEntry(id);
      const supaIds = new Set(updated.map((e) => e.id));
      const merged = [...updated, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))];
      setEntries(merged);
    } catch (err) {
      alert('삭제 실패: ' + (err instanceof Error ? err.message : ''));
    }
  };

  // ── Cell editing (table) ──────────────────────────────────────────────────

  const startCellEdit = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditingValue(currentValue || '');
  };

  const handleCellSave = (id: string, field: string) => {
    const val = TIME_FIELDS.has(field) ? normalizeTime(editingValue) : editingValue;
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: val } : e));
    setEditingCell(null);
  };

  const handleBoolToggle = (id: string, field: 'to_d' | 'to_n' | 'ld_d' | 'ld_n') => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: !e[field] } : e));
  };

  // ── CSV import ────────────────────────────────────────────────────────────

  const handleCSVImport = async (file: File) => {
    const text = await file.text();
    const imported = csvToEntries(text);
    if (!imported.length) return;
    const confirmed = window.confirm(
      `기존 데이터가 모두 삭제되고 새 파일(${imported.length}개)로 교체됩니다. 계속할까요?`
    );
    if (!confirmed) return;
    try {
      await deleteAllEntries();
      const updated = await bulkSaveEntries(imported);
      const supaIds = new Set(updated.map((e) => e.id));
      setEntries([...updated, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))]);
    } catch (err) {
      alert('CSV 가져오기 실패: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const handleDriveImport = async (imported: EastarEntry[]) => {
    try {
      const updated = await bulkSaveEntries(imported);
      const supaIds = new Set(updated.map((e) => e.id));
      setEntries([...updated, ...INITIAL_ENTRIES.filter((e) => !supaIds.has(e.id))]);
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
        if (!val) return `${label}: —`;
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

  // ─── Render helpers ───────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid #ddd', borderRadius: 5,
    fontSize: 12, fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', outline: 'none',
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

  // ── Editable cell renderer (table) ────────────────────────────────────────

  const ec = (entry: EastarEntry, field: string, extra: React.CSSProperties = {}) => {
    const isEditing = editingCell?.id === entry.id && editingCell?.field === field;
    const rawVal = (entry as unknown as Record<string, unknown>)[field];
    const displayVal = typeof rawVal === 'string' ? rawVal : '';
    const cellStyle: React.CSSProperties = { ...tdStyle(extra), cursor: 'text' };

    // DATE cell: show UTC or LCL
    if (field === 'date') {
      const shown = getDisplayDate(entry, dateMode);
      const datesDiffer = !!(entry.date_lcl && entry.date !== entry.date_lcl);
      const dateCellStyle: React.CSSProperties = {
        ...cellStyle,
        ...(datesDiffer ? { background: '#EFF6FF' } : {}),
      };
      if (isEditing) {
        return (
          <td key={field} style={dateCellStyle}>
            <input autoFocus value={editingValue}
              onChange={(ev) => setEditingValue(ev.target.value)}
              onBlur={() => handleCellSave(entry.id, field)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') handleCellSave(entry.id, field); if (ev.key === 'Escape') setEditingCell(null); }}
              style={{ width: '100%', border: 'none', outline: '2px solid #1a56db', borderRadius: 2, padding: '1px 2px', fontSize: 11, fontFamily: 'inherit', background: '#eff6ff', textAlign: 'center' }}
            />
          </td>
        );
      }
      return (
        <td key={field} style={dateCellStyle} onClick={() => startCellEdit(entry.id, field, displayVal)}>
          {shown}
        </td>
      );
    }

    // AC_TYPE: dropdown
    if (field === 'ac_type') {
      if (isEditing) {
        return (
          <td key={field} style={cellStyle}>
            <select autoFocus value={editingValue}
              onChange={(ev) => { setEditingValue(ev.target.value); handleCellSave(entry.id, field); /* handled on change */ }}
              onBlur={() => handleCellSave(entry.id, field)}
              onKeyDown={(ev) => { if (ev.key === 'Escape') setEditingCell(null); }}
              style={{ width: '100%', border: 'none', outline: '2px solid #1a56db', borderRadius: 2, fontSize: 11, fontFamily: 'inherit', background: '#eff6ff' }}
            >
              <option value="B738">B738</option>
              <option value="B38M">B38M</option>
            </select>
          </td>
        );
      }
      return (
        <td key={field} style={{ ...cellStyle, cursor: 'pointer' }} onClick={() => startCellEdit(entry.id, field, displayVal)}>
          {displayVal}
        </td>
      );
    }

    if (isEditing) {
      return (
        <td key={field} style={cellStyle}>
          <input autoFocus value={editingValue}
            onChange={(ev) => setEditingValue(ev.target.value)}
            onBlur={() => handleCellSave(entry.id, field)}
            onKeyDown={(ev) => { if (ev.key === 'Enter') handleCellSave(entry.id, field); if (ev.key === 'Escape') setEditingCell(null); }}
            style={{
              width: '100%', border: 'none', outline: '2px solid #1a56db', borderRadius: 2,
              padding: '1px 2px', fontSize: 11, fontFamily: 'inherit', background: '#eff6ff',
              textAlign: (extra.textAlign as React.CSSProperties['textAlign']) || 'center',
            }}
          />
        </td>
      );
    }

    return (
      <td key={field} style={cellStyle} onClick={() => startCellEdit(entry.id, field, displayVal)}>
        {displayVal}
      </td>
    );
  };

  const bc = (entry: EastarEntry, field: 'to_d' | 'to_n' | 'ld_d' | 'ld_n') => (
    <td key={field} style={{ ...tdStyle(), cursor: 'pointer' }} onClick={() => handleBoolToggle(entry.id, field)}>
      <ChkCell checked={entry[field]} />
    </td>
  );

  // ── Leg field inline input (STEP 3) ───────────────────────────────────────

  const legField = (
    legIdx: number,
    field: keyof OcrLeg,
    value: string,
    label: string,
    isMine: boolean,
  ) => {
    const isEditing = editingLeg?.idx === legIdx && editingLeg?.field === field;
    if (!isMine) {
      return (
        <span key={field} style={{ fontSize: 11, color: '#666' }}>
          {label}: {value || '—'}
        </span>
      );
    }
    if (isEditing) {
      return (
        <span key={field} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#888' }}>{label}:</span>
          <input
            autoFocus
            value={editingLegValue}
            onChange={(e) => setEditingLegValue(e.target.value)}
            onBlur={() => handleLegEdit(legIdx, field, editingLegValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLegEdit(legIdx, field, editingLegValue);
              if (e.key === 'Escape') setEditingLeg(null);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 11, border: '1.5px solid #1a56db', borderRadius: 3, padding: '1px 4px', outline: 'none', width: 60, background: '#eff6ff' }}
          />
        </span>
      );
    }
    return (
      <span
        key={field}
        style={{ fontSize: 11, color: '#444', cursor: 'text', borderBottom: '1px dashed #bbb', display: 'inline-flex', alignItems: 'center', gap: 2 }}
        onClick={(e) => { e.stopPropagation(); setEditingLeg({ idx: legIdx, field }); setEditingLegValue(value || ''); }}
      >
        <span style={{ color: '#888', fontSize: 10 }}>{label}:</span>
        <span>{value || <span style={{ color: '#ccc' }}>—</span>}</span>
      </span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, color: '#1a1a1a', background: '#f0f0ea' }}>

      {/* Camera scanner modal (mobile) */}
      {showScanner && (
        <CameraScanner
          onCapture={handleCameraCapture}
          onClose={() => setShowScanner(false)}
        />
      )}

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

      {/* ── OCR Panel ────────────────────────────────────────────────────── */}
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
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${isDragging ? '#1a56db' : imageDataUrl ? '#86efac' : '#ccc'}`,
              borderRadius: 8, padding: '18px 16px', textAlign: 'center',
              background: isDragging ? '#eff4ff' : imageDataUrl ? '#f0fdf4' : '#fafaf8',
              transition: 'border-color .2s, background .2s',
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>
              드래그하거나 아래 버튼으로 업로드 · JPG · PNG
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '1.5px solid #1a56db', background: '#1a56db', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
              >
                📷 카메라로 촬영
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '1.5px solid #ccc', background: '#fff', color: '#444', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                🖼 파일에서 선택
              </button>
              {/* 문서 경계 감지 카메라 스캐너 */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '1.5px solid #15803d', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  🔍 카메라 스캔
                </button>
              </div>
            </div>
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
                {/* OCR result summary with inline A/C editing */}
                {ocrData && (
                  <div style={{ background: '#f8f8f4', border: '1px solid #e0e0d8', borderRadius: 6, padding: '10px 12px', fontSize: 12, flex: 1 }}>
                    {/* 날짜 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ color: '#888', fontSize: 11, minWidth: 72 }}>날짜 (UTC)</span>
                      <span style={{ fontWeight: 600, color: '#15803d' }}>{ocrData.date_utc}</span>
                    </div>
                    {/* A/C No. — inline editable */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ color: '#888', fontSize: 11, minWidth: 72 }}>A/C No.</span>
                      {editingOcrAc === 'no' ? (
                        <input
                          autoFocus
                          value={editingOcrAcValue}
                          onChange={(e) => setEditingOcrAcValue(e.target.value)}
                          onBlur={() => handleOcrAcSave('no', editingOcrAcValue)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleOcrAcSave('no', editingOcrAcValue); if (e.key === 'Escape') setEditingOcrAc(null); }}
                          style={{ fontSize: 12, fontWeight: 600, border: '1.5px solid #1a56db', borderRadius: 4, padding: '2px 6px', outline: 'none', width: 90 }}
                          placeholder="예: 8507"
                        />
                      ) : (
                        <span
                          style={{ fontWeight: 600, cursor: 'text', borderBottom: '1px dashed #bbb', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => { setEditingOcrAc('no'); setEditingOcrAcValue(ocrData.ac_no || ''); }}
                        >
                          HL{ocrData.ac_no || '????'}
                          <span style={{ fontSize: 10, color: '#bbb' }}>✏</span>
                        </span>
                      )}
                    </div>
                    {/* A/C Type — dropdown */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ color: '#888', fontSize: 11, minWidth: 72 }}>A/C TYPE</span>
                      {editingOcrAc === 'type' ? (
                        <select
                          autoFocus
                          value={editingOcrAcValue}
                          onChange={(e) => { setEditingOcrAcValue(e.target.value); handleOcrAcSave('type', e.target.value); }}
                          onBlur={() => setEditingOcrAc(null)}
                          style={{ fontSize: 12, fontWeight: 600, border: '1.5px solid #1a56db', borderRadius: 4, padding: '2px 6px', outline: 'none' }}
                        >
                          <option value="B738">B738</option>
                          <option value="B38M">B38M</option>
                        </select>
                      ) : (
                        <span
                          style={{ fontWeight: 600, cursor: 'pointer', borderBottom: '1px dashed #bbb', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => { setEditingOcrAc('type'); setEditingOcrAcValue(AC_TYPE_MAP[ocrData.ac_no] || ((ocrData.ac_type||'').toLowerCase().includes('max') ? 'B38M' : 'B738')); }}
                        >
                          {AC_TYPE_MAP[ocrData.ac_no] || ((ocrData.ac_type||'').toLowerCase().includes('max') ? 'B38M' : 'B738')}
                          <span style={{ fontSize: 10, color: '#bbb' }}>▾</span>
                        </span>
                      )}
                    </div>
                    {/* LOG PAGE */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 0 }}>
                      <span style={{ color: '#888', fontSize: 11, minWidth: 72 }}>LOG PAGE</span>
                      <span style={{ fontWeight: 600 }}>{ocrData.log_page}</span>
                      <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>인식 레그</span>
                      <span style={{ fontWeight: 600 }}>{ocrData.legs?.length ?? 0}개</span>
                    </div>
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
                    const isEditingName = editingCrewField?.idx === i && editingCrewField.field === 'name';
                    const isEditingEmpNo = editingCrewField?.idx === i && editingCrewField.field === 'emp_no';
                    return (
                      <div key={i}
                        onClick={() => !editingCrewField && selectCrew(i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                          border: `1.5px solid ${isSelected ? '#1a56db' : '#e0e0d8'}`,
                          borderRadius: 7, cursor: editingCrewField ? 'default' : 'pointer',
                          background: isSelected ? '#eff6ff' : '#fff',
                          transition: 'border-color .15s, background .15s',
                        }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          background: isSelected ? '#1a56db' : '#f0f0ea', color: isSelected ? '#fff' : '#666',
                        }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isEditingName ? (
                            <input autoFocus value={editingCrewValue}
                              onChange={(e) => setEditingCrewValue(e.target.value)}
                              onBlur={() => handleCrewEdit(i, 'name', editingCrewValue)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleCrewEdit(i, 'name', editingCrewValue); if (e.key === 'Escape') setEditingCrewField(null); }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 13, fontWeight: 600, border: '1.5px solid #1a56db', borderRadius: 4, padding: '2px 6px', outline: 'none', width: '100%', maxWidth: 160 }}
                            />
                          ) : (
                            <div
                              style={{ fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'text' }}
                              onClick={(e) => { e.stopPropagation(); setEditingCrewField({ idx: i, field: 'name' }); setEditingCrewValue(crew.name || ''); }}
                            >
                              {crew.name || '(이름 불명)'}
                              <span style={{ fontSize: 10, color: '#bbb', lineHeight: 1 }}>✏</span>
                            </div>
                          )}
                          {isEditingEmpNo ? (
                            <input autoFocus value={editingCrewValue}
                              onChange={(e) => setEditingCrewValue(e.target.value)}
                              onBlur={() => handleCrewEdit(i, 'emp_no', editingCrewValue)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleCrewEdit(i, 'emp_no', editingCrewValue); if (e.key === 'Escape') setEditingCrewField(null); }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 11, border: '1.5px solid #1a56db', borderRadius: 4, padding: '1px 5px', outline: 'none', marginTop: 2, color: '#444', width: '100%', maxWidth: 120 }}
                            />
                          ) : (
                            <div
                              style={{ fontSize: 11, color: '#888', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'text', marginTop: 1 }}
                              onClick={(e) => { e.stopPropagation(); setEditingCrewField({ idx: i, field: 'emp_no' }); setEditingCrewValue(crew.emp_no || ''); }}
                            >
                              {crew.emp_no ? `사번 ${crew.emp_no}` : '(사번 없음)'}
                              <span style={{ fontSize: 10, color: '#bbb', lineHeight: 1 }}>✏</span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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

          {/* STEP 3 — 레그 선택 + 인라인 편집 */}
          {activeSteps.has(3) && (
            <div ref={step3Ref} style={{ border: '1px solid #e8e8e0', borderRadius: 8, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#f8f8f4', borderBottom: '1px solid #e8e8e0' }}>
                <StepNum n={3} active={activeSteps.has(3)} done={doneSteps.has(3)} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>레그 선택 — 내 비행 레그</span>
                <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4 }}>값을 클릭하면 편집 가능</span>
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {(ocrData?.legs ?? []).map((leg: OcrLeg, i: number) => {
                    const myCrew = selectedCrewIdx >= 0 ? ocrData?.crew[selectedCrewIdx] : null;
                    const myDuty = myCrew?.duty_codes?.[String(leg.leg)] || '';
                    const isMine = !!myDuty;
                    const isSelected = selectedLegs.includes(i);
                    return (
                      <div key={i}
                        onClick={() => isMine && !editingLeg && toggleLeg(i)}
                        style={{
                          border: `1.5px solid ${isSelected ? '#1a56db' : '#e0e0d8'}`,
                          borderRadius: 7, padding: '9px 12px',
                          cursor: isMine && !editingLeg ? 'pointer' : 'default',
                          background: isSelected ? '#eff6ff' : '#fff',
                          opacity: isMine ? 1 : 0.38,
                          transition: 'border-color .15s, background .15s',
                        }}>
                        {myDuty && (
                          <div style={{ display: 'inline-block', padding: '1px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 3, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>
                            DUTY: {myDuty}
                          </div>
                        )}
                        {/* FROM → TO editable */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          {legField(i, 'from', leg.from || '', 'FROM', isMine)}
                          <span style={{ color: '#999', fontSize: 12 }}>→</span>
                          {legField(i, 'to', leg.to || '', 'TO', isMine)}
                        </div>
                        {/* FLT NO */}
                        <div style={{ marginBottom: 3 }}>
                          {legField(i, 'flt_no', leg.flt_no ? `ZE ${leg.flt_no}` : '', 'FLT', isMine)}
                        </div>
                        {/* Times */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {legField(i, 'block_bt', leg.block_bt || '', 'Block', isMine)}
                          {legField(i, 'night_time', leg.night_time || '', 'Night', isMine)}
                          {legField(i, 'inst_time', leg.inst_time || '', 'Inst', isMine)}
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
                    선택 레그 로그북에 추가
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

      {/* ── Stats bar (전체) ───────────────────────────────────────────────── */}
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

      {/* ── Year + Month selector ─────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px', background: '#fafaf8', borderTop: '1px solid #e8e8e0', borderBottom: '1px solid #e8e8e0' }}>
        {/* Year row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600, marginRight: 2 }}>연도</span>
          <select
            value={selectedYear ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedYear(v === '' ? null : parseInt(v));
              setSelectedMonth(null);
            }}
            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, border: '1.5px solid #1a56db', cursor: 'pointer', background: '#fff', color: '#1a56db', fontWeight: 600 }}
          >
            <option value="">전체</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
        {/* Month row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#888', fontWeight: 600, marginRight: 2 }}>월</span>
          {[null, ...availableMonths].map((m) => (
            <button
              key={m ?? 'all'}
              onClick={() => setSelectedMonth(m)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: `1.5px solid ${selectedMonth === m ? '#1a56db' : '#ddd'}`,
                background: selectedMonth === m ? '#1a56db' : '#fff',
                color: selectedMonth === m ? '#fff' : '#555',
                fontWeight: selectedMonth === m ? 600 : 400,
                transition: 'all .12s',
              }}
            >
              {m === null ? '전체' : `${m}월`}
            </button>
          ))}
          {(selectedYear !== null || selectedMonth !== null) && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#1a56db', fontWeight: 600 }}>
                {selectedYear ?? '전체'}
                {selectedMonth !== null ? `년 ${selectedMonth}월` : '년'} 합계
              </span>
              <StatCard label="Block" value={fmtTime(filteredStats.totalBlockMinutes)} />
              <StatCard label="Night" value={fmtTime(filteredStats.totalNightMinutes)} />
              <StatCard label="PIC" value={fmtTime(filteredStats.totalPicMinutes)} />
              <StatCard label="INST" value={fmtTime(filteredStats.totalInstMinutes)} />
              <StatCard label="T/O(Day)" value={filteredStats.toDay} />
              <StatCard label="T/O(Night)" value={filteredStats.toNight} />
              <StatCard label="L/D(Day)" value={filteredStats.ldDay} />
              <StatCard label="L/D(Night)" value={filteredStats.ldNight} />
            </div>
          )}
        </div>
      </div>

      {/* ── Logbook Table ─────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div style={{ overflowX: 'auto', background: '#fff' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1220, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 22 }} />
            <col style={{ width: 24 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 62 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 38 }} />
            <col style={{ width: 38 }} />
            <col style={{ width: 42 }} />
            <col style={{ width: 42 }} />
            <col style={{ width: 44 }} />
            <col style={{ width: 42 }} />
            <col style={{ width: 30 }} />
            <col style={{ width: 30 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 28 }} />
            <col style={{ width: 28 }} />
            <col style={{ width: 28 }} />
            <col style={{ width: 28 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 26 }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={thStyle({ width: 22, fontSize: 10, color: '#bbb' })} />
              <th rowSpan={2} style={thStyle({ width: 24, fontSize: 10, color: '#bbb' })}>#</th>
              <th rowSpan={2} style={thStyle({ width: 50, cursor: 'pointer', userSelect: 'none' })}
                onClick={() => setDateMode((m) => m === 'UTC' ? 'LCL' : 'UTC')}>
                <span style={{ color: dateMode === 'LCL' ? '#1a56db' : undefined }}>DATE</span>
                <br />
                <span style={{ fontSize: 9, fontWeight: 400, color: dateMode === 'LCL' ? '#1a56db' : '#aaa' }}>
                  {dateMode}
                </span>
              </th>
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
            <SortableContext items={filteredEntries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              {filteredEntries.map((e, i) => (
                <SortableRow key={e.id} id={e.id} index={i}>
                  <td style={tdStyle({ fontSize: 10, color: '#bbb' })}>{i + 1}</td>
                  {ec(e, 'date')}
                  {ec(e, 'ac_type')}
                  {ec(e, 'ac_ident')}
                  {ec(e, 'from_apt')}
                  {ec(e, 'to_apt')}
                  {ec(e, 'flt_no')}
                  {ec(e, 'pic')}
                  {ec(e, 'picus')}
                  {ec(e, 'cop')}
                  {ec(e, 'ip')}
                  {ec(e, 'tr')}
                  {ec(e, 'block', { fontWeight: 600 })}
                  {ec(e, 'night')}
                  {ec(e, 'inst')}
                  {ec(e, 'app_type', { textAlign: 'left', paddingLeft: 4, fontSize: 11 })}
                  {bc(e, 'to_d')}
                  {bc(e, 'to_n')}
                  {bc(e, 'ld_d')}
                  {bc(e, 'ld_n')}
                  {ec(e, 'remarks', { textAlign: 'left', paddingLeft: 4, fontSize: 11 })}
                  <td style={tdStyle()}>
                    <button onClick={() => handleDelete(e.id)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc', padding: '2px 5px', fontSize: 15 }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.color = '#e53e3e')}
                      onMouseLeave={(ev) => (ev.currentTarget.style.color = '#ccc')}
                      title="삭제">×</button>
                  </td>
                </SortableRow>
              ))}
            </SortableContext>
          </tbody>
          <tfoot>
            <tr>
              <td style={tfootTd()} />
              <td colSpan={7} style={{ ...tdStyle(), textAlign: 'left', paddingLeft: 8, fontSize: 10, color: '#666', background: '#ebebе4', fontWeight: 600 }}>
                {selectedYear !== null || selectedMonth !== null
                  ? `${selectedYear ?? '전체'}${selectedMonth !== null ? `년 ${selectedMonth}월` : '년'} 합계`
                  : 'PAGE TOTALS'}
              </td>
              <td style={tfootTd()}>{filteredStats.totalPicMinutes > 0 ? fmtTime(filteredStats.totalPicMinutes) : ''}</td>
              <td style={tfootTd()} />
              <td style={tfootTd()}>{filteredStats.totalCopMinutes > 0 ? fmtTime(filteredStats.totalCopMinutes) : ''}</td>
              <td style={tfootTd()} />
              <td style={tfootTd()} />
              <td style={tfootTd()}>{filteredStats.totalBlockMinutes > 0 ? fmtTime(filteredStats.totalBlockMinutes) : ''}</td>
              <td style={tfootTd()}>{filteredStats.totalNightMinutes > 0 ? fmtTime(filteredStats.totalNightMinutes) : ''}</td>
              <td style={tfootTd()}>{filteredStats.totalInstMinutes > 0 ? fmtTime(filteredStats.totalInstMinutes) : ''}</td>
              <td style={tfootTd()} />
              <td style={tfootTd()}>{filteredStats.toDay || ''}</td>
              <td style={tfootTd()}>{filteredStats.toNight || ''}</td>
              <td style={tfootTd()}>{filteredStats.ldDay || ''}</td>
              <td style={tfootTd()}>{filteredStats.ldNight || ''}</td>
              <td colSpan={2} style={tfootTd()} />
            </tr>
          </tfoot>
        </table>
      </div>
      </DndContext>

      {/* ── Bottom button bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>
          {filteredEntries.length}개 기록
          {(selectedYear !== null || selectedMonth !== null)
            ? ` (${selectedYear ?? '전체'}${selectedMonth !== null ? `년 ${selectedMonth}월` : '년'}) / 전체 ${entries.length}개`
            : ` (전체)`}
          {supabaseError ? ' · Supabase 오프라인 (로컬 표시)' : supabaseLoaded ? ' · Supabase 연동됨' : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => entries.length > 0 && downloadCSVLocally(entries)} style={btnStyle()}>
            CSV 내보내기
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
    background: '#dde4f0', fontSize: 11, fontWeight: 700, color: '#1a1a1a', ...extra,
  };
}
