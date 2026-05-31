import { createClient } from '@supabase/supabase-js';
import { EastarEntry } from '@/types/logbook';

// ─── Asset Management Types ───────────────────────────────────────────────────

export interface AssetGroup {
  group_id: string;
  name: string;
  type: 'stock' | 'crypto' | 'etf' | 'bond' | 'cash' | string;
  currency: string;
  note?: string;
}

export interface Holding {
  id: string;
  group_id: string;
  ticker: string;
  name: string;
  quantity: number;
  avg_cost: number;
  currency: string;
  note?: string;
}

export interface PriceSnapshot {
  id: string;
  ticker: string;
  price: number;
  currency: string;
  fetched_at: string;
}

export interface PortfolioDaily {
  id: string;
  date: string;
  group_id: string;
  total_value_krw: number;
  total_cost_krw: number;
  pnl_krw: number;
  pnl_pct: number;
}

export interface RealizedPnl {
  id: string;
  ticker: string;
  name?: string;
  sell_date: string;
  quantity: number;
  avg_cost: number;
  sell_price: number;
  currency: string;
  pnl_krw: number;
  group_id?: string;
}

export interface GroupSummary {
  group_id: string;
  name: string;
  type: string;
  total_value_krw: number;
  total_cost_krw: number;
  pnl_krw: number;
  pnl_pct: number;
}

export interface LatestHolding {
  ticker: string;
  name: string;
  group_id: string;
  group_name: string;
  quantity: number;
  avg_cost: number;
  currency: string;
  current_price: number;
  current_value_krw: number;
  cost_krw: number;
  pnl_krw: number;
  pnl_pct: number;
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
    .order('total_value_krw', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GroupSummary[];
}

export async function fetchLatestHoldings(): Promise<LatestHolding[]> {
  const { data, error } = await supabase
    .from('v_latest_holdings')
    .select('*')
    .order('current_value_krw', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LatestHolding[];
}

export async function fetchLatestTotal(): Promise<{ total_value_krw: number; total_cost_krw: number; pnl_krw: number; pnl_pct: number } | null> {
  const { data, error } = await supabase
    .from('portfolio_daily')
    .select('total_value_krw, total_cost_krw, pnl_krw, pnl_pct, date')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchRealizedPnl(): Promise<RealizedPnl[]> {
  const { data, error } = await supabase
    .from('realized_pnl')
    .select('*')
    .order('sell_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RealizedPnl[];
}
