import { EastarEntry } from '@/types/logbook';
import { supabase } from './supabase';

const TABLE = 'eastar_entries';

// ─── Time utilities (H+MM format) ────────────────────────────────────────────

export function parseTime(s: string): number | null {
  if (!s || !s.trim()) return null;
  s = s.trim();
  let m = s.match(/^(\d+)\+(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  return null;
}

export function fmtTime(minutes: number): string {
  return `${Math.floor(minutes / 60)}+${String(minutes % 60).padStart(2, '0')}`;
}

// Normalize OCR time strings: "02.43" → "2+43", "02:43" → "2+43"
export function normalizeTime(s: string): string {
  if (!s || !s.trim()) return '';
  s = s.trim();
  let m = s.match(/^0*(\d+)[.:·\s](\d{2})$/);
  if (m) return `${parseInt(m[1])}+${m[2].padStart(2, '0')}`;
  m = s.match(/^0*(\d+)\+(\d{2})$/);
  if (m) return `${parseInt(m[1])}+${m[2].padStart(2, '0')}`;
  return s;
}

// ─── Supabase CRUD ────────────────────────────────────────────────────────────

export async function loadEntries(): Promise<EastarEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadEntries error:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    to_d: Boolean(row.to_d),
    to_n: Boolean(row.to_n),
    ld_d: Boolean(row.ld_d),
    ld_n: Boolean(row.ld_n),
  })) as EastarEntry[];
}

export async function saveEntry(entry: EastarEntry): Promise<EastarEntry[]> {
  const { error } = await supabase
    .from(TABLE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(entry as any, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return loadEntries();
}

export async function bulkSaveEntries(entries: EastarEntry[]): Promise<EastarEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(TABLE).upsert(entries, { onConflict: 'id' });
  if (error) throw new Error((error as { message: string }).message);
  return loadEntries();
}

export async function deleteAllEntries(): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .not('id', 'is', null);
  if (error) throw new Error(error.message);
}

export async function deleteEntry(id: string): Promise<EastarEntry[]> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
  return loadEntries();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface LogbookStats {
  totalBlockMinutes: number;
  totalNightMinutes: number;
  totalPicMinutes: number;
  totalCopMinutes: number;
  totalInstMinutes: number;
  flightCount: number;
  toDay: number;
  toNight: number;
  ldDay: number;
  ldNight: number;
}

export function computeStats(entries: EastarEntry[]): LogbookStats {
  let totalBlockMinutes = 0;
  let totalNightMinutes = 0;
  let totalPicMinutes = 0;
  let totalCopMinutes = 0;
  let totalInstMinutes = 0;
  let toDay = 0, toNight = 0, ldDay = 0, ldNight = 0;

  for (const e of entries) {
    totalBlockMinutes += parseTime(e.block) ?? 0;
    totalNightMinutes += parseTime(e.night) ?? 0;
    totalPicMinutes += parseTime(e.pic) ?? 0;
    totalCopMinutes += parseTime(e.cop) ?? 0;
    totalInstMinutes += parseTime(e.inst) ?? 0;
    if (e.to_d) toDay++;
    if (e.to_n) toNight++;
    if (e.ld_d) ldDay++;
    if (e.ld_n) ldNight++;
  }

  return {
    totalBlockMinutes,
    totalNightMinutes,
    totalPicMinutes,
    totalCopMinutes,
    totalInstMinutes,
    flightCount: entries.filter((e) => e.from_apt || e.to_apt).length,
    toDay,
    toNight,
    ldDay,
    ldNight,
  };
}
