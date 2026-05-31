'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchGroupSummary,
  fetchLatestHoldings,
  fetchLatestTotal,
  fetchRealizedPnl,
  type GroupSummary,
  type LatestHolding,
  type RealizedPnl,
} from '@/lib/supabase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtKrw(v: number) {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}
function fmtKrwFull(v: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(v)) + '원';
}
function fmtPct(v: number) {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}
function pnlColor(v: number) {
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-red-400';
  return 'text-cyan-400';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="juvis-card p-4">
      <p className="text-[10px] font-mono text-cyan-600 tracking-widest mb-1">{label}</p>
      <p className="text-xl font-bold text-cyan-100 font-mono">{value}</p>
      {sub && <p className={`text-xs font-mono mt-0.5 ${subColor ?? 'text-cyan-500'}`}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-mono text-cyan-600 tracking-widest uppercase">{title}</span>
      <div className="flex-1 h-px bg-cyan-500/15" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetPage() {
  const [summary, setSummary] = useState<GroupSummary[]>([]);
  const [holdings, setHoldings] = useState<LatestHolding[]>([]);
  const [total, setTotal] = useState<{ cur_krw: number } | null>(null);
  const [realized, setRealized] = useState<RealizedPnl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'realized'>('holdings');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, h, t, r] = await Promise.all([
        fetchGroupSummary(),
        fetchLatestHoldings(),
        fetchLatestTotal(),
        fetchRealizedPnl(),
      ]);
      setSummary(s);
      setHoldings(h);
      setTotal(t);
      setRealized(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredHoldings = groupFilter === 'ALL'
    ? holdings
    : holdings.filter(h => h.group_code === groupFilter);

  const totalRealizedPnl = realized.reduce((acc, r) => acc + r.pnl_krw, 0);

  const groups = summary.map(s => ({ id: s.code, name: s.name_ko }));

  return (
    <main className="min-h-screen grid-bg relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-emerald-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/" className="text-[10px] font-mono text-cyan-600 tracking-widest hover:text-cyan-400 transition-colors mb-3 block">
                ← JUVIS CORE
              </Link>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg border border-cyan-400/60 flex items-center justify-center bg-cyan-500/10"
                  style={{ boxShadow: '0 0 15px rgba(0,212,255,0.3)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-cyan-300" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-cyan-600 tracking-widest">[ASSET]</p>
                  <h1 className="text-2xl font-bold text-cyan-200 tracking-wider">자산관리 대시보드</h1>
                  <p className="text-[10px] font-mono text-cyan-600/60">Asset Management Dashboard</p>
                </div>
              </div>
            </div>

            <div className="text-right hidden sm:block mt-2">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                  style={{ boxShadow: loading ? '0 0 6px #facc15' : '0 0 6px #34d399' }} />
                <span className="text-xs font-mono text-cyan-400 tracking-wider">
                  {loading ? 'SYNCING...' : 'LIVE'}
                </span>
              </div>
              <button
                onClick={load}
                className="text-[10px] font-mono text-cyan-600 hover:text-cyan-400 transition-colors tracking-widest"
              >
                REFRESH ↻
              </button>
            </div>
          </div>
          <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono">
            ERROR: {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-lg bg-cyan-500/5 border border-cyan-500/10" />
              ))}
            </div>
            <div className="h-48 rounded-lg bg-cyan-500/5 border border-cyan-500/10" />
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {/* Total Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="총 자산 (KRW)"
                value={total ? `₩${fmtKrw(total.cur_krw)}` : '—'}
                sub={total ? fmtKrwFull(total.cur_krw) : undefined}
              />
              <StatCard
                label="보유 종목"
                value={holdings.length > 0 ? String(holdings.length) : '—'}
                sub="active holdings"
              />
              <StatCard
                label="실현손익 합계"
                value={realized.length > 0 ? `₩${fmtKrw(totalRealizedPnl)}` : '—'}
                sub={realized.length > 0 ? fmtKrwFull(totalRealizedPnl) : undefined}
                subColor={realized.length > 0 ? pnlColor(totalRealizedPnl) : undefined}
              />
              <StatCard
                label="그룹 수"
                value={summary.length > 0 ? String(summary.length) : '—'}
                sub="asset groups"
              />
            </div>

            {/* Group Summary */}
            <section>
              <SectionHeader title="그룹별 요약" />
              {summary.length === 0 ? (
                <div className="text-center py-8 text-cyan-600 font-mono text-sm">데이터 없음</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {summary.map(g => (
                    <div key={g.code} className="juvis-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[10px] font-mono text-cyan-600 tracking-widest">
                            [{g.code.toUpperCase()}]
                          </p>
                          <p className="text-sm font-semibold text-cyan-100">{g.name_ko}</p>
                        </div>
                        <span className="text-sm font-mono font-bold text-cyan-400">
                          {g.holding_count}종목
                        </span>
                      </div>
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-cyan-600">평가금액</span>
                          <span className="text-cyan-200">₩{fmtKrw(g.cur_krw)}</span>
                        </div>
                        <div className="flex justify-between border-t border-cyan-500/10 pt-1 mt-1">
                          <span className="text-cyan-600">목표 비중</span>
                          <span className="text-cyan-400">{g.target_pct}%</span>
                        </div>
                      </div>
                      {/* allocation bar */}
                      <div className="mt-3 h-1 w-full bg-cyan-500/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all bg-cyan-500/60"
                          style={{ width: `${Math.min(g.target_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Holdings / Realized PnL tabs */}
            <section>
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setActiveTab('holdings')}
                  className={`text-[10px] font-mono tracking-widest px-3 py-1.5 rounded border transition-all ${
                    activeTab === 'holdings'
                      ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300'
                      : 'border-cyan-500/20 text-cyan-600 hover:text-cyan-400'
                  }`}
                >
                  보유 종목 ({holdings.length})
                </button>
                <button
                  onClick={() => setActiveTab('realized')}
                  className={`text-[10px] font-mono tracking-widest px-3 py-1.5 rounded border transition-all ${
                    activeTab === 'realized'
                      ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300'
                      : 'border-cyan-500/20 text-cyan-600 hover:text-cyan-400'
                  }`}
                >
                  실현손익 ({realized.length})
                </button>
                <div className="flex-1 h-px bg-cyan-500/15" />
                {activeTab === 'realized' && realized.length > 0 && (
                  <span className={`text-xs font-mono ${pnlColor(totalRealizedPnl)}`}>
                    합계: {totalRealizedPnl >= 0 ? '+' : ''}₩{fmtKrw(totalRealizedPnl)}
                  </span>
                )}
              </div>

              {activeTab === 'holdings' && (
                <>
                  {/* Group filter */}
                  {groups.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => setGroupFilter('ALL')}
                        className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
                          groupFilter === 'ALL'
                            ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300'
                            : 'border-cyan-500/20 text-cyan-600 hover:text-cyan-400'
                        }`}
                      >
                        ALL
                      </button>
                      {groups.map(g => (
                        <button
                          key={g.id}
                          onClick={() => setGroupFilter(g.id)}
                          className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
                            groupFilter === g.id
                              ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300'
                              : 'border-cyan-500/20 text-cyan-600 hover:text-cyan-400'
                          }`}
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredHoldings.length === 0 ? (
                    <div className="text-center py-8 text-cyan-600 font-mono text-sm">데이터 없음</div>
                  ) : (
                    <div className="juvis-card overflow-x-auto p-0">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b border-cyan-500/15">
                            <th className="text-left px-4 py-3 text-cyan-600 tracking-widest font-normal">TICKER</th>
                            <th className="text-left px-4 py-3 text-cyan-600 tracking-widest font-normal hidden md:table-cell">NAME</th>
                            <th className="text-left px-4 py-3 text-cyan-600 tracking-widest font-normal hidden lg:table-cell">GROUP</th>
                            <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal">QTY</th>
                            <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal hidden md:table-cell">AVG COST</th>
                            <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal">CUR PRICE</th>
                            <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal">VALUE (KRW)</th>
                            <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal">ROR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHoldings.map((h, i) => (
                            <tr
                              key={`${h.ticker}-${i}`}
                              className="border-b border-cyan-500/8 hover:bg-cyan-500/5 transition-colors"
                            >
                              <td className="px-4 py-2.5 text-cyan-300 font-bold tracking-wider">{h.ticker}</td>
                              <td className="px-4 py-2.5 text-cyan-400 hidden md:table-cell max-w-[120px] truncate">{h.name}</td>
                              <td className="px-4 py-2.5 text-cyan-600 hidden lg:table-cell">{h.group_name}</td>
                              <td className="px-4 py-2.5 text-cyan-300 text-right">{h.qty.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-cyan-400 text-right hidden md:table-cell">
                                {h.avg_price.toLocaleString()} {h.currency}
                              </td>
                              <td className="px-4 py-2.5 text-cyan-300 text-right">
                                {h.current_price.toLocaleString()} {h.currency}
                              </td>
                              <td className="px-4 py-2.5 text-cyan-200 text-right">₩{fmtKrw(h.eval_krw)}</td>
                              <td className={`px-4 py-2.5 text-right ${pnlColor(h.ror)}`}>
                                {fmtPct(h.ror)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'realized' && (
                realized.length === 0 ? (
                  <div className="text-center py-8 text-cyan-600 font-mono text-sm">데이터 없음</div>
                ) : (
                  <div className="juvis-card overflow-x-auto p-0">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-cyan-500/15">
                          <th className="text-left px-4 py-3 text-cyan-600 tracking-widest font-normal">DATE</th>
                          <th className="text-left px-4 py-3 text-cyan-600 tracking-widest font-normal">TYPE</th>
                          <th className="text-left px-4 py-3 text-cyan-600 tracking-widest font-normal hidden md:table-cell">NAME</th>
                          <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal hidden md:table-cell">COST (KRW)</th>
                          <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal hidden md:table-cell">PROCEEDS (KRW)</th>
                          <th className="text-right px-4 py-3 text-cyan-600 tracking-widest font-normal">PNL (KRW)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realized.map((r, i) => (
                          <tr key={r.id ?? i} className="border-b border-cyan-500/8 hover:bg-cyan-500/5 transition-colors">
                            <td className="px-4 py-2.5 text-cyan-600">{r.sell_date}</td>
                            <td className="px-4 py-2.5 text-cyan-300 font-bold">{r.asset_type}</td>
                            <td className="px-4 py-2.5 text-cyan-400 hidden md:table-cell">{r.name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-cyan-400 text-right hidden md:table-cell">
                              ₩{fmtKrw(r.cost_krw)}
                            </td>
                            <td className="px-4 py-2.5 text-cyan-400 text-right hidden md:table-cell">
                              ₩{fmtKrw(r.proceeds_krw)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-bold ${pnlColor(r.pnl_krw)}`}>
                              {r.pnl_krw >= 0 ? '+' : ''}₩{fmtKrw(r.pnl_krw)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </section>
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-cyan-500/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-cyan-700">
            <p>JUVIS ASSET DASHBOARD — PERSONAL USE ONLY</p>
            <span>Powered by Supabase + Yahoo Finance</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
