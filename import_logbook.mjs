import { readFileSync } from 'fs';

const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YmVjb3l4a3V4YXh4eWpqZmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Nzc5MjksImV4cCI6MjA4OTU1MzkyOX0.Gj0pIFDzooAac1eBr2gBA6mNUiHvtF_8KlH_9X0Dr64";
const url = "https://nzbecoyxkuxaxxyjjfkp.supabase.co/rest/v1/logbook_v2";

// CSV 파싱 (따옴표 처리 포함)
function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').replace(/^"|"$/g, ''));
    return obj;
  });
}

// M/D → YYYY-MM-DD 변환
function toISODate(dateStr, createdAt) {
  // created_at에서 연도 추출
  const year = createdAt ? createdAt.substring(0, 4) : new Date().getFullYear().toString();
  const parts = dateStr.split('/');
  if (parts.length === 2) {
    const m = parts[0].padStart(2, '0');
    const d = parts[1].padStart(2, '0');
    return `${year}-${m}-${d}`;
  }
  return dateStr;
}

const text = readFileSync('E:\\Downloads\\logbook_v2_import.csv', 'utf-8');
const rows = parseCSV(text);
console.log(`총 ${rows.length}개 행 로드`);

const cleaned = rows.map(r => ({
  ...r,
  date: toISODate(r.date, r.created_at),
  to_d: r.to_d === 'true',
  to_n: r.to_n === 'true',
  ld_d: r.ld_d === 'true',
  ld_n: r.ld_n === 'true',
  sort_order: parseInt(r.sort_order) || 0,
}));

const batch = 50;
for (let i = 0; i < cleaned.length; i += batch) {
  const chunk = cleaned.slice(i, i + batch);
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(chunk)
  });
  if (!res.ok) {
    const err = await res.text();
    console.log(`배치 ${Math.floor(i/batch)+1} 오류: ${res.status} ${err.substring(0, 100)}`);
  } else {
    console.log(`배치 ${Math.floor(i/batch)+1}: 완료`);
  }
}
console.log('전체 완료!');