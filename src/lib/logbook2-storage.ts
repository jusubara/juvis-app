import { supabase } from './supabase';

export interface CrewMember {
  name: string;
  duty: string;
}

export interface Logbook2Entry {
  id: string;
  date: string;          // YYYY-MM-DD
  ac_ident: string;
  ac_type: string;
  flt_no: string;
  from_apt: string;
  to_apt: string;
  block: string;         // H+MM
  night: string;
  inst: string;
  pic: string;
  picus: string;
  cop: string;
  ip: string;
  tr: string;
  app_type: string;      // combined: "ILS Z RWY07"
  to_d: boolean;
  to_n: boolean;
  ld_d: boolean;
  ld_n: boolean;
  crew: CrewMember[];
  remark: string;
  created_at: string;
  sort_order?: number;
}

export interface FltRoute {
  flt_no: string;
  from_apt: string;
  to_apt: string;
  count: number;
}

export interface CrewDb {
  id: string;
  name: string;
  last_duty: string;
}

export interface Logbook2Stats {
  totalBlock: number;
  totalNight: number;
  totalInst: number;
  totalPic: number;
  totalPicus: number;
  totalCop: number;
  totalIp: number;
  totalTr: number;
  toDay: number;
  toNight: number;
  ldDay: number;
  ldNight: number;
  count: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function parseTime(s: string): number {
  if (!s) return 0;
  const m = s.match(/^(\d+)\+(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const m2 = s.match(/^(\d+):(\d{2})$/);
  if (m2) return parseInt(m2[1]) * 60 + parseInt(m2[2]);
  return 0;
}

export function fmtTime(minutes: number): string {
  if (!minutes) return '';
  return `${Math.floor(minutes / 60)}+${String(minutes % 60).padStart(2, '0')}`;
}

export function halfTime(s: string): string {
  const m = parseTime(s);
  return fmtTime(Math.floor(m / 2));
}

export function computeStats(entries: Logbook2Entry[]): Logbook2Stats {
  const s: Logbook2Stats = {
    totalBlock: 0, totalNight: 0, totalInst: 0,
    totalPic: 0, totalPicus: 0, totalCop: 0, totalIp: 0, totalTr: 0,
    toDay: 0, toNight: 0, ldDay: 0, ldNight: 0, count: entries.length,
  };
  for (const e of entries) {
    s.totalBlock  += parseTime(e.block);
    s.totalNight  += parseTime(e.night);
    s.totalInst   += parseTime(e.inst);
    s.totalPic    += parseTime(e.pic);
    s.totalPicus  += parseTime(e.picus);
    s.totalCop    += parseTime(e.cop);
    s.totalIp     += parseTime(e.ip);
    s.totalTr     += parseTime(e.tr);
    if (e.to_d)   s.toDay++;
    if (e.to_n) s.toNight++;
    if (e.ld_d)   s.ldDay++;
    if (e.ld_n) s.ldNight++;
  }
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(row: any): Logbook2Entry {
  return {
    ...row,
    crew: Array.isArray(row.crew) ? row.crew : (row.crew ? JSON.parse(row.crew) : []),
    to_d: Boolean(row.to_d),
    to_n: Boolean(row.to_n),
    ld_d: Boolean(row.ld_d),
    ld_n: Boolean(row.ld_n),
  } as Logbook2Entry;
}

export async function loadEntries(): Promise<Logbook2Entry[]> {
  const { data, error } = await sb
    .from('logbook_v2')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

export async function updateSortOrders(updates: { id: string; sort_order: number }[]): Promise<void> {
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      sb.from('logbook_v2').update({ sort_order }).eq('id', id)
    )
  );
}

export async function saveEntry(
  entry: Omit<Logbook2Entry, 'id' | 'created_at'>
): Promise<Logbook2Entry> {
  const { data, error } = await sb
    .from('logbook_v2')
    .insert(entry)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await sb.from('logbook_v2').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateEntry(id: string, changes: Partial<Logbook2Entry>): Promise<Logbook2Entry> {
  const { data, error } = await sb
    .from('logbook_v2')
    .update(changes)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function lookupRoute(fltNo: string): Promise<FltRoute | null> {
  console.log('[lookupRoute] input:', JSON.stringify(fltNo), 'type:', typeof fltNo);

  const { data: strData, error: strError } = await sb
    .from('flt_route_db')
    .select('*')
    .eq('flt_no', fltNo)
    .maybeSingle();
  console.log('[lookupRoute] string query result:', strData, 'error:', strError);
  if (strData) return strData as FltRoute;

  const numVal = Number(fltNo);
  if (!isNaN(numVal) && fltNo !== '') {
    const { data: numData, error: numError } = await sb
      .from('flt_route_db')
      .select('*')
      .eq('flt_no', numVal)
      .maybeSingle();
    console.log('[lookupRoute] number query result:', numData, 'error:', numError);
    if (numData) return numData as FltRoute;
  }

  return null;
}

export async function saveRoute(fltNo: string, fromApt: string, toApt: string): Promise<void> {
  const existing = await lookupRoute(fltNo);
  if (existing) {
    await sb.from('flt_route_db')
      .update({ from_apt: fromApt, to_apt: toApt, count: existing.count + 1 })
      .eq('flt_no', fltNo);
  } else {
    await sb.from('flt_route_db').insert({ flt_no: fltNo, from_apt: fromApt, to_apt: toApt, count: 1 });
  }
}

export async function loadCrewDb(): Promise<CrewDb[]> {
  const { data } = await sb.from('crew_db').select('*').order('name');
  return (data ?? []) as CrewDb[];
}

export async function upsertCrewMember(name: string, duty: string): Promise<void> {
  const { data } = await sb.from('crew_db').select('id').eq('name', name).maybeSingle();
  if (data) {
    await sb.from('crew_db').update({ last_duty: duty }).eq('name', name);
  } else {
    await sb.from('crew_db').insert({ name, last_duty: duty });
  }
}
