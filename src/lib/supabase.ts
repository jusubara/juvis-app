import { createClient } from '@supabase/supabase-js';
import { EastarEntry } from '@/types/logbook';

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
