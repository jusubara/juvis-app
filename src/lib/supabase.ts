import { createClient } from '@supabase/supabase-js';
import { EastarEntry } from '@/types/logbook';

// ─── Asset Management Types ───────────────────────────────────────────────────

export interface AssetGroup {
  id: string;
  code: string;
  name_ko: string;
  target_pct: number;
  sort_order: number;
  note?: string;
  created_at: string;
}

export interface Holding {
  id: string;
  group_code: string;
  account: string;
  sector: string;
  name: string;
  ticker: string;
  currency: string;
  qty: number;
  avg_price: number;
  is_active: boolean;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface PriceSnapshot {
  id: string;
  holding_id: string;
  snapshot_date: string;
  current_price: number;
  eval_krw: number;
  usd_krw_rate: number;
  created_at: string;
}

export interface PortfolioDaily {
  id: string;
  snapshot_date: string;
  total_krw: number;
  usd_krw_rate: number;
  fund_krw: number;
  memo?: string;
  created_at: string;
}

export interface RealizedPnl {
  id: string;
  asset_type: string;
  name: string;
  sell_date: string;
  cost_krw: number;
  proceeds_krw: number;
  pnl_krw: number;
  revenge_target?: string;
  revenge_pct?: number;
  lesson?: string;
  created_at?: string;
}

export interface GroupSummary {
  code: string;
  name_ko: string;
  target_pct: number;
  sort_order: number;
  cur_krw: number;
  holding_count: number;
}

export interface LatestHolding {
  id: string;
  group_code: string;
  group_name: string;
  account: string;
  sector: string;
  name: string;
  ticker: string;
  currency: string;
  qty: number;
  avg_price: number;
  current_price: number;
  eval_krw: number;
  snapshot_date: string;
  usd_krw_rate: number;
  ror: number;
}

// Supabase table: eastar_entries
// Run this SQL in Supabase SQL editor to create the table:
//
// create table public.eastar_entries (
//   id uuid primary key default gen_random_uuid(),
//   date text not null default '',
//   ac_type text not null default '',
//   ac_ident text not null default '',
//   from_apt text not null default '',
//   to_apt text not null default '',
//   flt_no text not null default '',
//   pic text not null default '',
//   picus text not null default '',
//   cop text not null default '',
//   ip text not null default '',
//   tr text not null default '',
//   block text not null default '',
//   night text not null default '',
//   inst text not null default '',
//   app_type text not null default '',
//   to_d boolean not null default false,
//   to_n boolean not null default false,
//   ld_d boolean not null default false,
//   ld_n boolean not null default false,
//   remarks text not null default '',
//   created_at timestamptz not null default now()
// );
// alter table public.eastar_entries enable row level security;
// create policy "public read" on public.eastar_entries for select using (true);
// create policy "public write" on public.eastar_entries for all using (true);

export interface Database {
  public: {
    Tables: {
      eastar_entries: {
        Row: EastarEntry;
        Insert: Omit<EastarEntry, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<EastarEntry, 'id'>>;
      };
    };
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ─── Asset Management Fetch Functions ────────────────────────────────────────

export async function fetchGroupSummary(): Promise<GroupSummary[]> {
  const { data, error } = await supabase
    .from('v_group_summary')
    .select('*')
    .order('cur_krw', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GroupSummary[];
}

export async function fetchLatestHoldings(): Promise<LatestHolding[]> {
  const { data, error } = await supabase
    .from('v_latest_holdings')
    .select('*')
    .order('eval_krw', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LatestHolding[];
}

export async function fetchLatestTotal(): Promise<{ cur_krw: number } | null> {
  const { data, error } = await supabase
    .from('portfolio_daily')
    .select('total_krw')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { cur_krw: (data as { total_krw: number }).total_krw };
}

export async function fetchRealizedPnl(): Promise<RealizedPnl[]> {
  const { data, error } = await supabase
    .from('realized_pnl')
    .select('*')
    .order('sell_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RealizedPnl[];
}
