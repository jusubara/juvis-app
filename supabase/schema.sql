-- logbook_entries table
create table if not exists public.logbook_entries (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  flight_number text not null default '',
  departure     text not null default '',
  arrival       text not null default '',
  block_time    text not null default '0:00',
  night_time    text not null default '0:00',
  aircraft_type text not null default '',
  aircraft_reg  text not null default '',
  duty_code     text not null default '',
  approach_type text not null default '',
  remarks       text not null default '',
  created_at    timestamptz not null default now()
);

-- Index for date ordering (most common query)
create index if not exists logbook_entries_date_idx on public.logbook_entries (date desc);

-- Enable Row Level Security
alter table public.logbook_entries enable row level security;

-- Allow all operations for now (no auth). Restrict later when user auth is added.
create policy "allow all"
  on public.logbook_entries
  for all
  using (true)
  with check (true);
