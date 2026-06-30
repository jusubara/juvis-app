import { readFileSync } from 'fs';

const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YmVjb3l4a3V4YXh4eWpqZmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Nzc5MjksImV4cCI6MjA4OTU1MzkyOX0.Gj0pIFDzooAac1eBr2gBA6mNUiHvtF_8KlH_9X0Dr64";
const baseUrl = "https://nzbecoyxkuxaxxyjjfkp.supabase.co/rest/v1/logbook_v2";

const updates = JSON.parse(readFileSync('E:\\Downloads\\sort_order_updates.json', 'utf-8'));
console.log(`총 ${updates.length}개 업데이트`);

let success = 0, fail = 0;
for (const u of updates) {
  const url = `${baseUrl}?date=eq.${u.date}&flt_no=eq.${u.flt_no}&from_apt=eq.${u.from_apt}&to_apt=eq.${u.to_apt}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sort_order: u.sort_order })
  });
  if (res.ok) { success++; } else { fail++; console.log(`실패: ${u.date} ${u.flt_no}`); }
}
console.log(`완료: 성공 ${success}, 실패 ${fail}`);