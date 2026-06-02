import { EastarEntry } from '@/types/logbook';
import { AIRPORT_TZ } from '@/lib/pay-calculator/calculator';

const DRIVE_FILE_NAME = 'JUVIS_logbook_eastar.csv';

const CSV_HEADERS: (keyof EastarEntry)[] = [
  'id', 'date', 'date_lcl', 'ac_type', 'ac_ident', 'from_apt', 'to_apt', 'flt_no',
  'pic', 'picus', 'cop', 'ip', 'tr', 'block', 'night', 'inst',
  'app_type', 'to_d', 'to_n', 'ld_d', 'ld_n', 'remarks', 'created_at', 'sort_order',
  'ramp_out', 'ramp_in', 'take_off', 'landing',
];

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function entriesToCSV(entries: EastarEntry[]): string {
  const rows = entries.map((e) =>
    CSV_HEADERS.map((h) => escapeCSV(String(e[h] ?? ''))).join(',')
  );
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

const EXTERNAL_HEADER_MAP: Record<string, keyof EastarEntry> = {
  'DATE(UTC)': 'date',
  'DATE(LCL)': 'date',
  'A/CTYPE': 'ac_type',
  'A/CIDENT': 'ac_ident',
  'FLTNO.': 'flt_no',
  'FROM': 'from_apt',
  'TO': 'to_apt',
  'BLOCKTIME(auto)': 'block',
  'NIGHTTIME(converted)': 'night',
  'INSTRUMENTTIME(auto)': 'inst',
  'TYPEOFAPPROACH': 'app_type',
};

export function csvToEntries(csv: string): EastarEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const normalizeHeader = (h: string) => h.replace(/[\r\n\s]+/g, '').trim();
  const headers = parseCSVLine(lines[0]);
  const headerMap = new Map(headers.map((h, i) => [normalizeHeader(h), i]));

  // Build field → column index map: internal JUVIS names first, then external mappings
  const fieldColIdx = new Map<string, number>();
  CSV_HEADERS.forEach((h) => {
    const idx = headerMap.get(h as string);
    if (idx !== undefined) fieldColIdx.set(h as string, idx);
  });
  Object.entries(EXTERNAL_HEADER_MAP).forEach(([extHeader, field]) => {
    if (!fieldColIdx.has(field as string)) {
      const idx = headerMap.get(normalizeHeader(extHeader));
      if (idx !== undefined) fieldColIdx.set(field as string, idx);
    }
  });

  return lines.slice(1).filter((l) => l.trim()).map((line, index) => {
    const cols = parseCSVLine(line);
    const entry: Record<string, unknown> = {};

    CSV_HEADERS.forEach((h) => {
      const idx = fieldColIdx.get(h as string);
      const val = idx !== undefined ? (cols[idx] ?? '').trim() : '';

      if (h === 'to_d' || h === 'to_n' || h === 'ld_d' || h === 'ld_n') {
        entry[h as string] = val === 'true' || val === '1';
      } else if (h === 'date') {
        // 외부 CSV의 ISO 날짜 "2025-07-09" → JUVIS "M/D" 포맷으로 변환
        if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
          const d = new Date(val + 'T00:00:00Z');
          entry['date'] = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
        } else {
          entry['date'] = val;
        }
      } else {
        entry[h as string] = val;
      }
    });

    // uuid: 빈값이면 새 UUID 생성
    if (!entry['id']) {
      entry['id'] = crypto.randomUUID();
    }

    // created_at: date 컬럼의 원본값으로 설정
    if (!entry['created_at']) {
      const dateIdx = fieldColIdx.get('date');
      const rawDate = dateIdx !== undefined ? (cols[dateIdx] ?? '').trim() : '';
      let parsedFullDate = '';

      if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        parsedFullDate = rawDate.substring(0, 10);
      } else {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dy = String(d.getUTCDate()).padStart(2, '0');
          parsedFullDate = `${y}-${m}-${dy}`;
        }
      }

      if (parsedFullDate) {
        entry['created_at'] = `${parsedFullDate}T00:00:00Z`;
      } else {
        // M/D 포맷에서 연도 추론
        const dateStr = (entry['date'] as string) || '';
        const [monStr, dayStr] = dateStr.split('/');
        const mon = parseInt(monStr || '0');
        const day = parseInt(dayStr || '0');
        if (mon > 0 && day > 0) {
          const now = new Date();
          const curYear = now.getFullYear();
          const curMonth = now.getMonth() + 1;
          const year = mon > curMonth ? curYear - 1 : curYear;
          entry['created_at'] = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`;
        } else {
          entry['created_at'] = new Date().toISOString();
        }
      }
    }

    // date_lcl: CSV에 값이 있으면 그대로, ramp_out 있으면 그걸로 계산, 둘 다 없으면 그냥 date
    if (!entry['date_lcl']) {
      const rampOut = (entry['ramp_out'] as string) || '';
      const caStr = entry['created_at'] as string;
      if (rampOut && /^\d{2}:\d{2}$/.test(rampOut) && caStr && /^\d{4}-\d{2}-\d{2}/.test(caStr)) {
        const dateStr = caStr.substring(0, 10);
        const fromApt = ((entry['from_apt'] as string) || '').toUpperCase();
        const tzOffset = AIRPORT_TZ[fromApt] ?? 9;
        const utcMs = new Date(`${dateStr}T${rampOut}:00Z`).getTime();
        const lclDate = new Date(utcMs + tzOffset * 3600 * 1000);
        entry['date_lcl'] = `${lclDate.getUTCMonth() + 1}/${lclDate.getUTCDate()}`;
      }
      // 둘 다 없으면 date_lcl 미설정 (표시 시 date 그대로 사용)
    }

    entry['sort_order'] = index + 1;

    return entry as unknown as EastarEntry;
  });
}

export function downloadCSVLocally(entries: EastarEntry[]): void {
  const csv = entriesToCSV(entries);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = DRIVE_FILE_NAME;
  a.click();
  URL.revokeObjectURL(url);
}

async function findFileId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files as { id: string }[])?.[0]?.id ?? null;
}

export async function syncToDrive(token: string, entries: EastarEntry[]): Promise<void> {
  const csv = entriesToCSV(entries);
  const csvBlob = new Blob([csv], { type: 'text/csv' });
  const fileId = await findFileId(token);

  const metadata = JSON.stringify(
    fileId ? {} : { name: DRIVE_FILE_NAME, mimeType: 'text/csv' }
  );
  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', csvBlob);

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Drive sync failed');
  }
}

export async function importFromDrive(token: string): Promise<EastarEntry[] | null> {
  const fileId = await findFileId(token);
  if (!fileId) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return csvToEntries(await res.text());
}
