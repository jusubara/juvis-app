'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LogbookEntry, DutyCode, ApproachType, DUTY_CODE_LABELS, APPROACH_TYPE_LABELS } from '@/types/logbook';
import {
  loadEntries,
  saveEntry,
  deleteEntry,
  computeStats,
  formatMinutesToTime,
  LogbookStats,
} from '@/lib/logbook-storage';

type Step = 'upload' | 'parsing' | 'review' | 'saving';

const emptyEntry = (): Partial<LogbookEntry> => ({
  date: '',
  flight_number: '',
  departure: '',
  arrival: '',
  block_time: '',
  night_time: '00:00',
  aircraft_type: '',
  aircraft_reg: '',
  duty_code: '' as DutyCode,
  approach_type: '' as ApproachType,
  remarks: '',
});

export default function LogbookPage() {
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [entry, setEntry] = useState<Partial<LogbookEntry>>(emptyEntry());
  const [parseError, setParseError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [stats, setStats] = useState<LogbookStats | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = loadEntries();
    setEntries(loaded);
    setStats(computeStats(loaded));
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    handleParse(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleParse = async (file: File) => {
    setStep('parsing');
    setParseError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/parse-logbook', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setParseError(data.error || '파싱 중 오류가 발생했습니다.');
        setStep('review');
        setEntry(emptyEntry());
        return;
      }

      setEntry({
        date: data.date || '',
        flight_number: data.flight_number || '',
        departure: (data.departure || '').toUpperCase(),
        arrival: (data.arrival || '').toUpperCase(),
        block_time: data.block_time || '',
        night_time: data.night_time || '00:00',
        aircraft_type: data.aircraft_type || '',
        aircraft_reg: data.aircraft_reg || '',
        duty_code: '' as DutyCode,
        approach_type: '' as ApproachType,
        remarks: '',
      });
      setStep('review');
    } catch {
      setParseError('네트워크 오류가 발생했습니다.');
      setStep('review');
    }
  };

  const handleSave = async () => {
    if (!entry.date || !entry.block_time) return;
    setStep('saving');

    const newEntry: LogbookEntry = {
      id: crypto.randomUUID(),
      date: entry.date!,
      flight_number: entry.flight_number || '',
      departure: entry.departure || '',
      arrival: entry.arrival || '',
      block_time: entry.block_time!,
      night_time: entry.night_time || '00:00',
      aircraft_type: entry.aircraft_type || '',
      aircraft_reg: entry.aircraft_reg || '',
      duty_code: entry.duty_code as DutyCode,
      approach_type: entry.approach_type as ApproachType,
      remarks: entry.remarks || '',
      created_at: new Date().toISOString(),
    };

    const updated = saveEntry(newEntry);
    setEntries(updated);
    setStats(computeStats(updated));
    setSaveSuccess(true);

    setTimeout(() => {
      setSaveSuccess(false);
      setStep('upload');
      setEntry(emptyEntry());
      setImagePreview(null);
    }, 1500);
  };

  const handleDelete = (id: string) => {
    const updated = deleteEntry(id);
    setEntries(updated);
    setStats(computeStats(updated));
  };

  const field = (key: keyof LogbookEntry, value: string) =>
    setEntry((prev) => ({ ...prev, [key]: value }));

  // Drag & drop
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const maxMonthMinutes = stats ? Math.max(...stats.monthlyData.map((m) => m.minutes), 1) : 1;

  return (
    <main className="min-h-screen grid-bg relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-mono text-cyan-600 hover:text-cyan-400 transition-colors"
            >
              ← JUVIS
            </Link>
            <div className="w-px h-4 bg-cyan-500/30" />
            <div>
              <h1 className="text-xl font-bold text-cyan-300 font-mono tracking-widest glow-text">
                LOGBOOK
              </h1>
              <p className="text-[10px] text-cyan-600 font-mono">Electronic Flight Log System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-dot" />
            <span className="text-xs font-mono text-cyan-400">ACTIVE</span>
          </div>
        </header>

        {/* Stats */}
        {stats && (
          <section className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total Block', value: formatMinutesToTime(stats.totalBlockMinutes), unit: 'HRS' },
                { label: 'Night Time', value: formatMinutesToTime(stats.totalNightMinutes), unit: 'HRS' },
                { label: 'This Month', value: formatMinutesToTime(stats.thisMonthMinutes), unit: 'HRS' },
                { label: 'Flights', value: String(stats.flightCount), unit: 'LEGS' },
              ].map((s) => (
                <div key={s.label} className="juvis-card py-4 text-center">
                  <p className="text-[10px] font-mono text-cyan-600 tracking-widest mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-cyan-300 font-mono glow-text">{s.value}</p>
                  <p className="text-[10px] font-mono text-cyan-700">{s.unit}</p>
                </div>
              ))}
            </div>

            {/* Monthly chart */}
            <div className="juvis-card py-4">
              <p className="text-[10px] font-mono text-cyan-600 tracking-widest mb-3">
                MONTHLY BLOCK HOURS (최근 6개월)
              </p>
              <div className="flex items-end justify-between gap-2 h-16">
                {stats.monthlyData.map((m) => {
                  const pct = Math.round((m.minutes / maxMonthMinutes) * 100);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-cyan-600">
                        {m.minutes > 0 ? formatMinutesToTime(m.minutes) : ''}
                      </span>
                      <div className="w-full flex flex-col justify-end" style={{ height: 40 }}>
                        <div
                          className="w-full rounded-t bg-cyan-500/40 border-t border-cyan-400/60 transition-all duration-500"
                          style={{ height: `${Math.max(pct, m.minutes > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-cyan-700">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Upload / Review */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-mono text-cyan-600 tracking-widest uppercase">
              {step === 'upload' ? 'New Entry' : step === 'parsing' ? 'Parsing...' : step === 'review' ? 'Review & Confirm' : 'Saving...'}
            </span>
            <div className="flex-1 h-px bg-cyan-500/15" />
          </div>

          {(step === 'upload') && (
            <div
              className={`juvis-card flex flex-col items-center justify-center min-h-48 cursor-pointer transition-all ${
                isDragging ? 'border-cyan-400/80 bg-cyan-500/10' : ''
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="text-4xl mb-3">📷</div>
              <p className="text-sm text-cyan-300 font-mono mb-1">
                운항기록부 사진을 드래그하거나 클릭해서 업로드
              </p>
              <p className="text-xs text-cyan-600 font-mono">
                JPG / PNG / WEBP — Claude Vision으로 자동 파싱
              </p>
            </div>
          )}

          {step === 'parsing' && (
            <div className="juvis-card flex flex-col items-center justify-center min-h-48">
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="preview" className="max-h-32 rounded opacity-40 mb-4" />
              )}
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-cyan-400 font-mono">Claude Vision 분석 중...</p>
              </div>
            </div>
          )}

          {(step === 'review' || step === 'saving') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Image preview */}
              <div className="juvis-card flex items-center justify-center">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="logbook" className="max-w-full max-h-80 rounded object-contain" />
                ) : (
                  <p className="text-xs text-cyan-700 font-mono">미리보기 없음</p>
                )}
              </div>

              {/* Form */}
              <div className="juvis-card">
                {parseError && (
                  <div className="mb-4 px-3 py-2 rounded bg-red-500/10 border border-red-500/30">
                    <p className="text-xs text-red-400 font-mono">{parseError}</p>
                    <p className="text-[10px] text-red-600 font-mono mt-1">아래 필드를 직접 입력해 주세요.</p>
                  </div>
                )}
                {saveSuccess && (
                  <div className="mb-4 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs text-emerald-400 font-mono">저장되었습니다.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Auto-parsed fields */}
                  {[
                    { key: 'date', label: 'DATE', type: 'date' },
                    { key: 'flight_number', label: 'FLIGHT NO', type: 'text' },
                    { key: 'departure', label: 'DEP (ICAO)', type: 'text' },
                    { key: 'arrival', label: 'ARR (ICAO)', type: 'text' },
                    { key: 'block_time', label: 'BLOCK TIME', type: 'text' },
                    { key: 'night_time', label: 'NIGHT TIME', type: 'text' },
                    { key: 'aircraft_type', label: 'A/C TYPE', type: 'text' },
                    { key: 'aircraft_reg', label: 'REG', type: 'text' },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-mono text-cyan-600 mb-1 tracking-widest">
                        {label}
                      </label>
                      <input
                        type={type}
                        value={(entry[key as keyof LogbookEntry] as string) || ''}
                        onChange={(e) => field(key as keyof LogbookEntry, e.target.value)}
                        className="w-full bg-[#020c14] border border-cyan-500/30 rounded px-2 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400/60"
                        placeholder={label}
                      />
                    </div>
                  ))}

                  {/* User-selected fields */}
                  <div>
                    <label className="block text-[10px] font-mono text-cyan-600 mb-1 tracking-widest">
                      DUTY CODE
                    </label>
                    <select
                      value={entry.duty_code || ''}
                      onChange={(e) => field('duty_code', e.target.value)}
                      className="w-full bg-[#020c14] border border-cyan-500/30 rounded px-2 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400/60"
                    >
                      <option value="">선택...</option>
                      {Object.entries(DUTY_CODE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-cyan-600 mb-1 tracking-widest">
                      APPROACH
                    </label>
                    <select
                      value={entry.approach_type || ''}
                      onChange={(e) => field('approach_type', e.target.value)}
                      className="w-full bg-[#020c14] border border-cyan-500/30 rounded px-2 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400/60"
                    >
                      <option value="">선택...</option>
                      {Object.entries(APPROACH_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono text-cyan-600 mb-1 tracking-widest">
                      REMARKS
                    </label>
                    <textarea
                      value={entry.remarks || ''}
                      onChange={(e) => field('remarks', e.target.value)}
                      rows={2}
                      className="w-full bg-[#020c14] border border-cyan-500/30 rounded px-2 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400/60 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={step === 'saving' || !entry.date || !entry.block_time}
                    className="flex-1 py-2 rounded border border-cyan-400/60 bg-cyan-500/10 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {step === 'saving' ? '저장 중...' : 'SAVE ENTRY'}
                  </button>
                  <button
                    onClick={() => {
                      setStep('upload');
                      setEntry(emptyEntry());
                      setImagePreview(null);
                      setParseError(null);
                    }}
                    className="px-4 py-2 rounded border border-cyan-500/20 text-xs font-mono text-cyan-600 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Entries table */}
        {entries.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-mono text-cyan-600 tracking-widest uppercase">Flight Records</span>
              <div className="flex-1 h-px bg-cyan-500/15" />
              <span className="text-xs font-mono text-cyan-700">{entries.length} entries</span>
            </div>

            <div className="juvis-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-cyan-500/20">
                      {['DATE', 'FLIGHT', 'ROUTE', 'BLOCK', 'NIGHT', 'A/C', 'DUTY', 'APCH', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] text-cyan-600 tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr
                        key={e.id}
                        className={`border-b border-cyan-500/10 hover:bg-cyan-500/5 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-cyan-500/[0.02]'
                        }`}
                      >
                        <td className="px-3 py-2 text-cyan-400 whitespace-nowrap">{e.date}</td>
                        <td className="px-3 py-2 text-cyan-200 whitespace-nowrap">{e.flight_number || '—'}</td>
                        <td className="px-3 py-2 text-cyan-300 whitespace-nowrap">
                          {e.departure && e.arrival ? `${e.departure}→${e.arrival}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-cyan-200 whitespace-nowrap">{e.block_time || '—'}</td>
                        <td className="px-3 py-2 text-cyan-600 whitespace-nowrap">{e.night_time || '—'}</td>
                        <td className="px-3 py-2 text-cyan-600 whitespace-nowrap">{e.aircraft_type || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">{e.duty_code || '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-cyan-600 whitespace-nowrap">{e.approach_type || '—'}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="text-red-600 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-8 pt-4 border-t border-cyan-500/10 text-center">
          <p className="text-[10px] font-mono text-cyan-700">
            DATA STORED LOCALLY — Supabase 연동 시 클라우드 동기화 예정
          </p>
        </footer>
      </div>
    </main>
  );
}
