import { LogbookEntry } from '@/types/logbook';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function loadEntries(): Promise<LogbookEntry[]> {
  const { data, error } = await supabase
    .from('logbook_entries')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('loadEntries error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function saveEntry(entry: LogbookEntry): Promise<LogbookEntry[]> {
  const { error } = await supabase
    .from('logbook_entries')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(entry as any, { onConflict: 'id' });

  if (error) throw new Error(error.message);
  return loadEntries();
}

export async function bulkSaveEntries(entries: LogbookEntry[]): Promise<LogbookEntry[]> {
  const { error } = await supabase
    .from('logbook_entries')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(entries as any, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return loadEntries();
}

export async function deleteEntry(id: string): Promise<LogbookEntry[]> {
  const { error } = await supabase
    .from('logbook_entries')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  return loadEntries();
}

// ---------------------------------------------------------------------------
// Time utilities (unchanged)
// ---------------------------------------------------------------------------

/** Convert "HH:MM" to total minutes */
export function parseTimeToMinutes(time: string): number {
  if (!time || !time.includes(':')) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Convert total minutes to "H:MM" */
export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface LogbookStats {
  totalBlockMinutes: number;
  totalNightMinutes: number;
  flightCount: number;
  thisMonthMinutes: number;
  monthlyData: { month: string; label: string; minutes: number }[];
}

export function computeStats(entries: LogbookEntry[]): LogbookStats {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let totalBlockMinutes = 0;
  let totalNightMinutes = 0;
  let thisMonthMinutes = 0;
  const monthMap: Record<string, number> = {};

  for (const entry of entries) {
    const block = parseTimeToMinutes(entry.block_time);
    const night = parseTimeToMinutes(entry.night_time);
    totalBlockMinutes += block;
    totalNightMinutes += night;

    const month = entry.date.substring(0, 7);
    monthMap[month] = (monthMap[month] || 0) + block;
    if (month === thisMonth) thisMonthMinutes += block;
  }

  const monthlyData: { month: string; label: string; minutes: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData.push({ month: key, label: `${d.getMonth() + 1}월`, minutes: monthMap[key] || 0 });
  }

  return { totalBlockMinutes, totalNightMinutes, flightCount: entries.length, thisMonthMinutes, monthlyData };
}
