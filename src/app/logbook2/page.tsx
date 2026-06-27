'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  loadEntries, deleteEntry, updateEntry, computeStats, fmtTime, updateSortOrders,
  Logbook2Entry, Logbook2Stats,
} from '@/lib/logbook2-storage';
import LogbookTable from '@/components/logbook2/LogbookTable';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#f5f5f0', borderRadius: 6, padding: '7px 12px', minWidth: 90 }}>
      <div style={{ fontSize: 9, color: '#888', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{value || '—'}</div>
    </div>
  );
}

function getYear(e: Logbook2Entry): number {
  return parseInt(e.date?.substring(0, 4) || '0');
}

function getMonth(e: Logbook2Entry): number {
  return parseInt(e.date?.substring(5, 7) || '0');
}

export default function Logbook2Page() {
  const [entries, setEntries] = useState<Logbook2Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    loadEntries()
      .then(data => {
        setEntries(data);
        if (data.length > 0) {
          const years = Array.from(new Set(data.map(getYear))).filter(y => y > 2000);
          if (years.length > 0) setSelectedYear(Math.max(...years));
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : '로딩 실패'))
      .finally(() => setLoading(false));
  }, []);

  const availableYears = useMemo(() => {
    const s = new Set(entries.map(getYear).filter(y => y > 2000));
    return Array.from(s).sort((a, b) => a - b);
  }, [entries]);

  const availableMonths = useMemo(() => {
    const src = selectedYear !== null ? entries.filter(e => getYear(e) === selectedYear) : entries;
    const s = new Set(src.map(getMonth).filter(m => m > 0));
    return Array.from(s).sort((a, b) => a - b);
  }, [entries, selectedYear]);

  useEffect(() => {
    if (selectedMonth !== null && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(null);
    }
  }, [availableMonths, selectedMonth]);

  const filteredEntries = useMemo(() => {
    let r = entries;
    if (selectedYear !== null) r = r.filter(e => getYear(e) === selectedYear);
    if (selectedMonth !== null) r = r.filter(e => getMonth(e) === selectedMonth);
    return r;
  }, [entries, selectedYear, selectedMonth]);

  const filteredStats: Logbook2Stats = useMemo(() => computeStats(filteredEntries), [filteredEntries]);
  const totalStats: Logbook2Stats = useMemo(() => computeStats(entries), [entries]);

  async function handleDelete(id: string) {
    try {
      await deleteEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      alert('삭제 실패: ' + (e instanceof Error ? e.message : ''));
    }
  }

  async function handleUpdate(id: string, changes: Partial<Logbook2Entry>) {
    try {
      const updated = await updateEntry(id, changes);
      setEntries(prev => prev.map(e => e.id === id ? updated : e));
    } catch (e) {
      alert('업데이트 실패: ' + (e instanceof Error ? e.message : ''));
    }
  }

  async function handleReorder(newFiltered: Logbook2Entry[]) {
    const filteredIds = new Set(newFiltered.map(e => e.id));
    setEntries(prev => {
      let fi = 0;
      return prev.map(entry => filteredIds.has(entry.id) ? newFiltered[fi++] : entry);
    });
    try {
      await updateSortOrders(newFiltered.map((e, i) => ({ id: e.id, sort_order: i + 1 })));
    } catch {
      // silent
    }
  }

  function downloadCSV() {
    const sorted = [...filteredEntries].sort((a, b) => a.date.localeCompare(b.date));
    const headers = ['DATE','A/C TYPE','A/C IDENT','FLT NO.','FROM','TO','PIC','PICUS','CO-PILOT','IP','TR','BLOCK','NIGHT','INST','APP TYPE','TO DAY','TO NIGHT','LD DAY','LD NIGHT','REMARKS'];
    const rows = sorted.map(e => [
      e.date, e.ac_type, e.ac_ident, e.flt_no, e.from_apt, e.to_apt,
      e.pic, e.picus, e.cop, e.ip, e.tr, e.block, e.night, e.inst, e.app_type,
      e.to_d ? '1' : '', e.to_n ? '1' : '', e.ld_d ? '1' : '', e.ld_n ? '1' : '',
      e.remark,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logbook_${filterLabel.replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterLabel = selectedYear !== null
    ? `${selectedYear}${selectedMonth !== null ? `년 ${selectedMonth}월` : '년'}`
    : '전체';

  return (
    <main style={{ minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, color: '#1a1a1a', background: '#f0f0ea' }}>

      {/* Header */}
      <header className="grid-bg relative" style={{ background: '#020c14', borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-xs font-mono text-cyan-600 hover:text-cyan-400 transition-colors">
              ← JUVIS
            </Link>
            <div className="w-px h-4 bg-cyan-500/30" />
            <div>
              <h1 className="text-lg font-bold text-cyan-300 font-mono tracking-widest glow-text">LOGBOOK v2</h1>
              <p className="text-[10px] text-cyan-600 font-mono">PILOT FLIGHT RECORD — Manual Entry</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="status-dot" />
            <span className="text-xs font-mono text-cyan-400">ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Total stats */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #eee', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#888', fontWeight: 700, marginRight: 4 }}>전체 합계</span>
        <StatCard label="Block" value={fmtTime(totalStats.totalBlock)} />
        <StatCard label="Night" value={fmtTime(totalStats.totalNight)} />
        <StatCard label="PIC" value={fmtTime(totalStats.totalPic)} />
        <StatCard label="PICUS" value={fmtTime(totalStats.totalPicus)} />
        <StatCard label="Co-pilot" value={fmtTime(totalStats.totalCop)} />
        <StatCard label="Sectors" value={totalStats.count} />
        {loading && (
          <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-1" />
            로딩 중…
          </span>
        )}
        {error && <span style={{ fontSize: 11, color: '#c81e1e', marginLeft: 8 }}>⚠ {error}</span>}
      </div>

      {/* Year / Month filter */}
      <div style={{ padding: '8px 16px', background: '#fafaf8', borderBottom: '1px solid #e8e8e0' }}>
        {/* Year row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#888', fontWeight: 700 }}>연도</span>
          <select
            value={selectedYear ?? ''}
            onChange={e => { setSelectedYear(e.target.value ? parseInt(e.target.value) : null); setSelectedMonth(null); }}
            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, border: '1.5px solid #1a56db', cursor: 'pointer', background: '#fff', color: '#1a56db', fontWeight: 600 }}
          >
            <option value="">전체</option>
            {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
        {/* Month row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#888', fontWeight: 700 }}>월</span>
          {[null, ...availableMonths].map(m => (
            <button
              key={m ?? 'all'}
              onClick={() => setSelectedMonth(m)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: `1.5px solid ${selectedMonth === m ? '#1a56db' : '#ddd'}`,
                background: selectedMonth === m ? '#1a56db' : '#fff',
                color: selectedMonth === m ? '#fff' : '#555',
                fontWeight: selectedMonth === m ? 600 : 400,
              }}
            >
              {m === null ? '전체' : `${m}월`}
            </button>
          ))}
        </div>

        {/* Filtered stats */}
        {(selectedYear !== null || selectedMonth !== null) && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#1a56db', fontWeight: 700 }}>{filterLabel} 합계</span>
            <StatCard label="Block" value={fmtTime(filteredStats.totalBlock)} />
            <StatCard label="Night" value={fmtTime(filteredStats.totalNight)} />
            <StatCard label="PIC" value={fmtTime(filteredStats.totalPic)} />
            <StatCard label="PICUS" value={fmtTime(filteredStats.totalPicus)} />
            <StatCard label="Co-pilot" value={fmtTime(filteredStats.totalCop)} />
            <StatCard label="INST" value={fmtTime(filteredStats.totalInst)} />
            <StatCard label="T/O D" value={filteredStats.toDay} />
            <StatCard label="T/O N" value={filteredStats.toNight} />
            <StatCard label="L/D D" value={filteredStats.ldDay} />
            <StatCard label="L/D N" value={filteredStats.ldNight} />
          </div>
        )}
      </div>

      {/* New entry button */}
      <div style={{ padding: '10px 16px', background: '#fff', borderBottom: '2px solid #e8e8e0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link
          href="/logbook2/new"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8,
            background: '#1a56db', color: '#fff', textDecoration: 'none',
          }}
        >
          + 새 기록 추가
        </Link>
        <button
          onClick={downloadCSV}
          style={{
            padding: '9px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
            border: '1.5px solid #16a34a', background: '#f0fdf4', color: '#15803d',
            cursor: 'pointer',
          }}
        >
          CSV 다운로드
        </button>
        <span style={{ fontSize: 11, color: '#888' }}>
          {filteredEntries.length}개 기록
          {(selectedYear !== null || selectedMonth !== null)
            ? ` (${filterLabel}) / 전체 ${entries.length}개`
            : ''}
        </span>
      </div>

      {/* Table */}
      <LogbookTable
        entries={filteredEntries}
        stats={filteredStats}
        onDelete={handleDelete}
        onReorder={handleReorder}
        onUpdate={handleUpdate}
      />

    </main>
  );
}
