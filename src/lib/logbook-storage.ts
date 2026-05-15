import { LogbookEntry } from '@/types/logbook';

const STORAGE_KEY = 'juvis_logbook_entries';

export function loadEntries(): LogbookEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEntry(entry: LogbookEntry): LogbookEntry[] {
  const entries = loadEntries();
  const updated = [entry, ...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteEntry(id: string): LogbookEntry[] {
  const entries = loadEntries().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

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

  // Last 6 months including current
  const monthlyData: { month: string; label: string; minutes: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getMonth() + 1}월`;
    monthlyData.push({ month: key, label, minutes: monthMap[key] || 0 });
  }

  return {
    totalBlockMinutes,
    totalNightMinutes,
    flightCount: entries.length,
    thisMonthMinutes,
    monthlyData,
  };
}
