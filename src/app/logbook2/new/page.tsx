'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EntryForm from '@/components/logbook2/EntryForm';
import { loadEntries, CrewMember } from '@/lib/logbook2-storage';

export default function NewLogbook2Page() {
  const [lastCrew, setLastCrew] = useState<CrewMember[]>([]);

  useEffect(() => {
    loadEntries()
      .then(entries => {
        if (entries.length > 0) setLastCrew(entries[0].crew ?? []);
      })
      .catch(() => {});
  }, []);

  return (
    <main style={{ minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f0f0ea' }}>

      {/* Header */}
      <header className="grid-bg" style={{ background: '#020c14', borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/logbook2" className="text-xs font-mono text-cyan-600 hover:text-cyan-400 transition-colors">
            ← LOGBOOK v2
          </Link>
          <div className="w-px h-4 bg-cyan-500/30" />
          <div>
            <h1 className="text-base font-bold text-cyan-300 font-mono tracking-wider">새 비행 기록</h1>
            <p className="text-[10px] text-cyan-600 font-mono">NEW FLIGHT LOG ENTRY</p>
          </div>
        </div>
      </header>

      <EntryForm lastCrew={lastCrew} />

    </main>
  );
}
