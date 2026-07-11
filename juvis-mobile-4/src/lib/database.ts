import * as SQLite from 'expo-sqlite';

export interface LogbookEntry {
  id: string;
  date: string;
  ac_type: string;
  ac_ident: string;
  flt_no: string;
  from_apt: string;
  to_apt: string;
  pic: string;
  picus: string;
  cop: string;
  ip: string;
  tr: string;
  block: string;
  night: string;
  inst: string;
  app_type: string;
  to_d: number;
  to_n: number;
  ld_d: number;
  ld_n: number;
  remark: string;
  crew: string; // JSON: [{name: string, duty: string}]
  ramp_out: string;
  ramp_in: string;
  sort_order: number;
  created_at: string;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS logbook (
    id TEXT PRIMARY KEY,
    date TEXT,
    ac_type TEXT,
    ac_ident TEXT,
    flt_no TEXT,
    from_apt TEXT,
    to_apt TEXT,
    pic TEXT,
    picus TEXT,
    cop TEXT,
    ip TEXT,
    tr TEXT,
    block TEXT,
    night TEXT,
    inst TEXT,
    app_type TEXT,
    to_d INTEGER DEFAULT 0,
    to_n INTEGER DEFAULT 0,
    ld_d INTEGER DEFAULT 0,
    ld_n INTEGER DEFAULT 0,
    remark TEXT,
    crew TEXT DEFAULT '',
    ramp_out TEXT,
    ramp_in TEXT,
    sort_order INTEGER,
    created_at TEXT
  );
`;

const CREATE_FLT_ROUTE_SQL = `
  CREATE TABLE IF NOT EXISTS flt_route_db (
    flt_no TEXT PRIMARY KEY,
    from_apt TEXT,
    to_apt TEXT,
    count INTEGER DEFAULT 1
  );
`;

const CREATE_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    run_at TEXT NOT NULL
  );
`;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('logbook.db');
    await dbInstance.execAsync(CREATE_TABLE_SQL);
    await dbInstance.execAsync(CREATE_FLT_ROUTE_SQL);
    await dbInstance.execAsync(CREATE_MIGRATIONS_SQL);
    // Migration: add crew column for existing DBs
    try {
      await dbInstance.execAsync(`ALTER TABLE logbook ADD COLUMN crew TEXT DEFAULT ''`);
    } catch {
      // Column already exists — ignore
    }
    // Migration: add sort_order column for existing DBs
    try {
      await dbInstance.execAsync(`ALTER TABLE logbook ADD COLUMN sort_order INTEGER`);
    } catch {
      // Column already exists — ignore
    }
  }
  return dbInstance;
}

// ─── One-time migration: reverse sort_order within each date group ─────────────
// Old JUVIS web exports were in date-DESC order (newest row first), so the
// initial import assigned sort_order 1 to the LAST flight of the day.
// This migration inverts sort_orders within each date so the first CSV row
// (chronologically earliest) gets the smallest sort_order.
// Guard: runs once, result recorded in `migrations` table.

export async function runMigrationReverseSortOrderIfNeeded(): Promise<void> {
  const db = await getDatabase();

  // Check if already done
  const done = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM migrations WHERE name = 'reverse_sort_order_v1'"
  );
  if (done.length > 0) {
    console.log('[Migration] reverse_sort_order_v1 already ran — skipping');
    return;
  }

  console.log('[Migration] running reverse_sort_order_v1...');

  const rows = await db.getAllAsync<{ id: string; date: string; sort_order: number }>(
    'SELECT id, date, sort_order FROM logbook ORDER BY date ASC, sort_order ASC'
  );

  if (rows.length === 0) {
    await db.runAsync(
      "INSERT INTO migrations (name, run_at) VALUES ('reverse_sort_order_v1', ?)",
      [new Date().toISOString()]
    );
    console.log('[Migration] reverse_sort_order_v1 done (no rows)');
    return;
  }

  // Group by date
  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date)!.push(row);
  }

  // Build updates: within each date, swap sort_orders so first row gets smallest value
  const updates: { id: string; sort_order: number }[] = [];
  for (const group of byDate.values()) {
    if (group.length <= 1) continue;
    const sortOrders = group.map((r) => r.sort_order);
    group.forEach((r, i) => {
      const newSo = sortOrders[sortOrders.length - 1 - i]; // mirror position
      if (newSo !== r.sort_order) updates.push({ id: r.id, sort_order: newSo });
    });
  }

  console.log('[Migration] reverse_sort_order_v1 updating', updates.length, 'rows');

  await db.withTransactionAsync(async () => {
    for (const u of updates) {
      await db.runAsync('UPDATE logbook SET sort_order = ? WHERE id = ?', [u.sort_order, u.id]);
    }
    await db.runAsync(
      "INSERT INTO migrations (name, run_at) VALUES ('reverse_sort_order_v1', ?)",
      [new Date().toISOString()]
    );
  });

  console.log('[Migration] reverse_sort_order_v1 complete');
}

// ─── One-time migration: reassign sort_order globally (no per-year reset) ─────
// Old imports assigned sort_order 1..N per year, causing duplicates across years.
// This migration sorts all entries by date ASC + sort_order ASC, then reassigns
// sort_order = 1, 2, 3, ... globally so they're unique and continuous.

export async function runMigrationFixSortOrderGlobalIfNeeded(): Promise<void> {
  const db = await getDatabase();

  const done = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM migrations WHERE name = 'fix_sort_order_global_v1'"
  );
  if (done.length > 0) {
    console.log('[Migration] fix_sort_order_global_v1 already ran — skipping');
    return;
  }

  console.log('[Migration] running fix_sort_order_global_v1...');

  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM logbook ORDER BY date ASC, sort_order ASC'
  );

  if (rows.length === 0) {
    await db.runAsync(
      "INSERT INTO migrations (name, run_at) VALUES ('fix_sort_order_global_v1', ?)",
      [new Date().toISOString()]
    );
    console.log('[Migration] fix_sort_order_global_v1 done (no rows)');
    return;
  }

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < rows.length; i++) {
      await db.runAsync('UPDATE logbook SET sort_order = ? WHERE id = ?', [i + 1, rows[i].id]);
    }
    await db.runAsync(
      "INSERT INTO migrations (name, run_at) VALUES ('fix_sort_order_global_v1', ?)",
      [new Date().toISOString()]
    );
  });

  console.log('[Migration] fix_sort_order_global_v1 complete —', rows.length, 'rows renumbered');
}

export async function getAllEntries(): Promise<LogbookEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<LogbookEntry>(
    'SELECT * FROM logbook ORDER BY sort_order ASC'
  );
}

export async function getNextSortOrder(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getAllAsync<{ max_so: number | null }>(
    'SELECT MAX(sort_order) AS max_so FROM logbook'
  );
  return (result[0]?.max_so ?? 0) + 1;
}

export async function getEntriesByMonth(
  year: string,
  month: string
): Promise<LogbookEntry[]> {
  const db = await getDatabase();
  const prefix = `${year}-${month.padStart(2, '0')}`;
  return db.getAllAsync<LogbookEntry>(
    'SELECT * FROM logbook WHERE date LIKE ? ORDER BY date ASC, sort_order DESC',
    [`${prefix}%`]
  );
}

export async function getDistinctIdents(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ ac_ident: string }>(
    "SELECT DISTINCT ac_ident FROM logbook WHERE ac_ident IS NOT NULL AND ac_ident != '' ORDER BY ac_ident"
  );
  return rows.map((r) => r.ac_ident);
}

export async function insertEntry(entry: LogbookEntry): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO logbook
      (id, date, ac_type, ac_ident, flt_no, from_apt, to_apt,
       pic, picus, cop, ip, tr, block, night, inst, app_type,
       to_d, to_n, ld_d, ld_n, remark, crew, ramp_out, ramp_in,
       sort_order, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      entry.id, entry.date, entry.ac_type, entry.ac_ident, entry.flt_no,
      entry.from_apt, entry.to_apt, entry.pic, entry.picus, entry.cop,
      entry.ip, entry.tr, entry.block, entry.night, entry.inst,
      entry.app_type, entry.to_d, entry.to_n, entry.ld_d, entry.ld_n,
      entry.remark, entry.crew ?? '', entry.ramp_out, entry.ramp_in,
      entry.sort_order, entry.created_at,
    ]
  );
}

export async function insertEntries(entries: LogbookEntry[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await db.runAsync(
        `INSERT OR REPLACE INTO logbook
          (id, date, ac_type, ac_ident, flt_no, from_apt, to_apt,
           pic, picus, cop, ip, tr, block, night, inst, app_type,
           to_d, to_n, ld_d, ld_n, remark, crew, ramp_out, ramp_in,
           sort_order, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          entry.id, entry.date, entry.ac_type, entry.ac_ident, entry.flt_no,
          entry.from_apt, entry.to_apt, entry.pic, entry.picus, entry.cop,
          entry.ip, entry.tr, entry.block, entry.night, entry.inst,
          entry.app_type, entry.to_d, entry.to_n, entry.ld_d, entry.ld_n,
          entry.remark, entry.crew ?? '', entry.ramp_out, entry.ramp_in,
          entry.sort_order, entry.created_at,
        ]
      );
    }
  });
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM logbook WHERE id = ?', [id]);
}

export async function updateEntry(
  id: string,
  changes: Partial<LogbookEntry>
): Promise<void> {
  const db = await getDatabase();
  const fields = Object.keys(changes) as (keyof LogbookEntry)[];
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${String(f)} = ?`).join(', ');
  const values = fields.map((f) => changes[f] ?? null);
  await db.runAsync(`UPDATE logbook SET ${setClause} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

// ─── Time utilities ───────────────────────────────────────────────────────────

// H+MM format, e.g. "1+23"
export function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split('+');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}+${m.toString().padStart(2, '0')}`;
}

export function halfTime(t: string): string {
  if (!t) return '';
  return minutesToTimeStr(Math.round(parseTimeToMinutes(t) / 2));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Route lookup ─────────────────────────────────────────────────────────────

export async function lookupRoute(fltNo: string): Promise<{ from_apt: string; to_apt: string } | null> {
  if (!fltNo) return null;
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ from_apt: string; to_apt: string }>(
    'SELECT from_apt, to_apt FROM flt_route_db WHERE flt_no = ? LIMIT 1',
    [fltNo]
  );
  if (rows.length > 0) return rows[0];
  const lb = await db.getAllAsync<{ from_apt: string; to_apt: string }>(
    "SELECT from_apt, to_apt FROM logbook WHERE flt_no = ? AND from_apt IS NOT NULL AND from_apt != '' ORDER BY date DESC LIMIT 1",
    [fltNo]
  );
  return lb.length > 0 ? lb[0] : null;
}

export async function saveRoute(fltNo: string, fromApt: string, toApt: string): Promise<void> {
  if (!fltNo || !fromApt || !toApt) return;
  const db = await getDatabase();
  const existing = await db.getAllAsync<{ count: number }>(
    'SELECT count FROM flt_route_db WHERE flt_no = ? LIMIT 1',
    [fltNo]
  );
  if (existing.length > 0) {
    await db.runAsync(
      'UPDATE flt_route_db SET from_apt = ?, to_apt = ?, count = ? WHERE flt_no = ?',
      [fromApt, toApt, existing[0].count + 1, fltNo]
    );
  } else {
    await db.runAsync(
      'INSERT INTO flt_route_db (flt_no, from_apt, to_apt, count) VALUES (?, ?, ?, 1)',
      [fltNo, fromApt, toApt]
    );
  }
}

// ─── One-time migration: seed flt_route_db from bundled JSON ─────────────────
// Loads assets/flt-route-db.json (exported from Supabase) and inserts all rows
// into the local SQLite flt_route_db table using INSERT OR IGNORE so user-saved
// routes (from saveRoute) are never overwritten.

export async function runMigrationSeedFltRouteDbIfNeeded(): Promise<void> {
  const db = await getDatabase();

  const done = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM migrations WHERE name = 'seed_flt_route_db_v1'"
  );
  if (done.length > 0) {
    console.log('[Migration] seed_flt_route_db_v1 already ran — skipping');
    return;
  }

  console.log('[Migration] seed_flt_route_db_v1 starting...');
  const t0 = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rows: { flt_no: string; from_apt: string; to_apt: string; count: number }[] =
    require('../../assets/flt-route-db.json');

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      if (!row.flt_no) continue;
      await db.runAsync(
        'INSERT OR IGNORE INTO flt_route_db (flt_no, from_apt, to_apt, count) VALUES (?, ?, ?, ?)',
        [row.flt_no, row.from_apt ?? '', row.to_apt ?? '', row.count ?? 1]
      );
    }
    await db.runAsync(
      "INSERT INTO migrations (name, run_at) VALUES ('seed_flt_route_db_v1', ?)",
      [new Date().toISOString()]
    );
  });

  console.log(`[Migration] seed_flt_route_db_v1 done — ${rows.length} rows in ${Date.now() - t0}ms`);
}

// ─── Online refresh: pull latest flt_route_db from Supabase ──────────────────
// Call this from a "노선 DB 업데이트" button (requires network).

const SUPABASE_URL = 'https://nzbecoyxkuxaxxyjjfkp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56YmVjb3l4a3V4YXh4eWpqZmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Nzc5MjksImV4cCI6MjA4OTU1MzkyOX0.Gj0pIFDzooAac1eBr2gBA6mNUiHvtF_8KlH_9X0Dr64';

export async function refreshFltRouteDbFromSupabase(): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/flt_route_db?select=flt_no,from_apt,to_apt,count&order=count.desc&limit=2000`;
  const res = await fetch(url, {
    headers: {
      apikey:        SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept:        'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);

  const rows: { flt_no: string; from_apt: string; to_apt: string; count: number }[] = await res.json();
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      if (!row.flt_no) continue;
      await db.runAsync(
        `INSERT INTO flt_route_db (flt_no, from_apt, to_apt, count) VALUES (?, ?, ?, ?)
         ON CONFLICT(flt_no) DO UPDATE SET from_apt=excluded.from_apt, to_apt=excluded.to_apt, count=excluded.count`,
        [row.flt_no.toUpperCase(), row.from_apt ?? '', row.to_apt ?? '', row.count ?? 1]
      );
    }
  });

  console.log(`[refreshFltRouteDb] updated ${rows.length} rows from Supabase`);
  return rows.length;
}

export async function updateSortOrders(
  items: { id: string; sort_order: number }[]
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await db.runAsync(
        'UPDATE logbook SET sort_order = ? WHERE id = ?',
        [item.sort_order, item.id]
      );
    }
  });
}

export async function deleteAllEntries(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM logbook');
}

// ─── DEV ONLY: 스크린샷용 더미 데이터 삽입 ───────────────────────────────────
export async function insertDummyData(): Promise<void> {
  const nextSo = await getNextSortOrder();

  const DUMMY: Omit<LogbookEntry, 'id' | 'sort_order' | 'created_at'>[] = [
    {
      date: '2026-07-01', ac_type: 'B738', ac_ident: 'HL8500',
      flt_no: '101', from_apt: 'ICN', to_apt: 'CJU',
      pic: '1+05', picus: '', cop: '', ip: '', tr: '',
      block: '1+05', night: '', inst: '',
      app_type: '', to_d: 1, to_n: 0, ld_d: 1, ld_n: 0,
      remark: '', crew: JSON.stringify([{ name: '김민준', duty: 'F' }]),
      ramp_out: '', ramp_in: '',
    },
    {
      date: '2026-07-01', ac_type: 'B738', ac_ident: 'HL8500',
      flt_no: '102', from_apt: 'CJU', to_apt: 'ICN',
      pic: '1+10', picus: '', cop: '', ip: '', tr: '',
      block: '1+10', night: '', inst: '',
      app_type: '', to_d: 1, to_n: 0, ld_d: 1, ld_n: 0,
      remark: '', crew: JSON.stringify([{ name: '김민준', duty: 'F' }]),
      ramp_out: '', ramp_in: '',
    },
    {
      date: '2026-07-03', ac_type: 'B38M', ac_ident: 'HL8600',
      flt_no: '501', from_apt: 'ICN', to_apt: 'NRT',
      pic: '2+15', picus: '', cop: '', ip: '', tr: '',
      block: '2+15', night: '0+40', inst: '',
      app_type: '', to_d: 1, to_n: 0, ld_d: 0, ld_n: 1,
      remark: '', crew: JSON.stringify([{ name: '이서연', duty: 'F' }]),
      ramp_out: '', ramp_in: '',
    },
    {
      date: '2026-07-03', ac_type: 'B38M', ac_ident: 'HL8600',
      flt_no: '502', from_apt: 'NRT', to_apt: 'ICN',
      pic: '2+20', picus: '', cop: '', ip: '', tr: '',
      block: '2+20', night: '', inst: '',
      app_type: '', to_d: 1, to_n: 0, ld_d: 1, ld_n: 0,
      remark: '', crew: JSON.stringify([{ name: '이서연', duty: 'F' }]),
      ramp_out: '', ramp_in: '',
    },
    {
      date: '2026-07-05', ac_type: 'B738', ac_ident: 'HL8510',
      flt_no: '205', from_apt: 'GMP', to_apt: 'CJU',
      pic: '1+00', picus: '', cop: '', ip: '', tr: '',
      block: '1+00', night: '', inst: '',
      app_type: '', to_d: 1, to_n: 0, ld_d: 1, ld_n: 0,
      remark: '', crew: JSON.stringify([{ name: '박지호', duty: 'F' }]),
      ramp_out: '', ramp_in: '',
    },
  ];

  const now = new Date().toISOString();
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < DUMMY.length; i++) {
      const e = DUMMY[i];
      const id = `dummy-${Date.now()}-${i}`;
      await db.runAsync(
        `INSERT OR IGNORE INTO logbook
          (id, date, ac_type, ac_ident, flt_no, from_apt, to_apt,
           pic, picus, cop, ip, tr, block, night, inst, app_type,
           to_d, to_n, ld_d, ld_n, remark, crew, ramp_out, ramp_in,
           sort_order, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, e.date, e.ac_type, e.ac_ident, e.flt_no, e.from_apt, e.to_apt,
          e.pic, e.picus, e.cop, e.ip, e.tr, e.block, e.night, e.inst,
          e.app_type, e.to_d, e.to_n, e.ld_d, e.ld_n,
          e.remark, e.crew, e.ramp_out, e.ramp_in,
          nextSo + i, now,
        ]
      );
    }
  });

  console.log('[DEV] insertDummyData: 5건 삽입 완료 (sort_order', nextSo, '~', nextSo + DUMMY.length - 1, ')');
}
