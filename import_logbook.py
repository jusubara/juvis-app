import csv, json, urllib.request

url = "https://nzbecoyxkuxaxxyjjfkp.supabase.co/rest/v1/logbook_v2"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YmVjb3l4a3V4YXh4eWpqZmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Nzc5MjksImV4cCI6MjA4OTU1MzkyOX0.Gj0pIFDzooAac1eBr2gBA6mNUiHvtF_8KlH_9X0Dr64"
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

with open(r'E:\Downloads\logbook_v2_import.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

for r in rows:
    for k in ['to_d','to_n','ld_d','ld_n']:
        r[k] = r[k].lower() == 'true'
    r['sort_order'] = int(r['sort_order'])

batch_size = 50
for i in range(0, len(rows), batch_size):
    batch = rows[i:i+batch_size]
    data = json.dumps(batch).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        urllib.request.urlopen(req)
        print(f"배치 {i//batch_size+1}: {len(batch)}개 완료")
    except Exception as e:
        print(f"배치 {i//batch_size+1} 오류: {e}")

print("전체 완료!")