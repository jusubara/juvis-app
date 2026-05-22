import { EastarEntry } from '@/types/logbook';

const DRIVE_FILE_NAME = 'JUVIS_logbook_eastar.csv';

const CSV_HEADERS: (keyof EastarEntry)[] = [
  'id', 'date', 'ac_type', 'ac_ident', 'from_apt', 'to_apt', 'flt_no',
  'pic', 'picus', 'cop', 'ip', 'tr', 'block', 'night', 'inst',
  'app_type', 'to_d', 'to_n', 'ld_d', 'ld_n', 'remarks', 'created_at',
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

export function csvToEntries(csv: string): EastarEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const entry: Record<string, unknown> = {};
    CSV_HEADERS.forEach((h, i) => {
      const val = cols[i] ?? '';
      if (h === 'to_d' || h === 'to_n' || h === 'ld_d' || h === 'ld_n') {
        entry[h as string] = val === 'true' || val === '1';
      } else {
        entry[h as string] = val;
      }
    });
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
