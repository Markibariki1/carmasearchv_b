-- Portfolio tables for CARMA vehicle monitoring dashboard
-- Applied via Supabase migration: create_portfolio_tables

-- ============================================================
-- Portfolio Vehicles
-- ============================================================
create table if not exists public.portfolio_vehicles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  make text not null,
  model text not null,
  year integer not null,
  trim text,
  purchase_price numeric(12,2) not null,
  purchase_date date,
  purchase_mileage integer,
  current_mileage integer,
  fuel_type text,
  transmission text,
  body_type text,
  exterior_color text,
  interior_color text,
  num_doors integer,
  num_seats integer,
  engine_displacement_cc integer,
  power_kw numeric(7,1),
  power_hp numeric(7,1),
  drivetrain text,
  vin text,
  license_plate text,
  condition text,
  modifications text,
  notes text,
  image_url text,
  current_market_value numeric(12,2),
  market_value_updated_at timestamptz,
  valuation_source text default 'carma_comparables',
  valuation_sample_size integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean default true
);

alter table public.portfolio_vehicles enable row level security;
create policy "Users can view own vehicles" on public.portfolio_vehicles for select using (auth.uid() = user_id);
create policy "Users can insert own vehicles" on public.portfolio_vehicles for insert with check (auth.uid() = user_id);
create policy "Users can update own vehicles" on public.portfolio_vehicles for update using (auth.uid() = user_id);
create policy "Users can delete own vehicles" on public.portfolio_vehicles for delete using (auth.uid() = user_id);
create index idx_portfolio_vehicles_user on public.portfolio_vehicles (user_id) where is_active = true;

-- ============================================================
-- Service Records
-- ============================================================
create table if not exists public.service_records (
  id uuid default gen_random_uuid() primary key,
  vehicle_id uuid references public.portfolio_vehicles on delete cascade not null,
  user_id uuid references auth.users not null,
  service_type text not null,
  description text,
  cost numeric(10,2),
  currency text default 'EUR',
  service_date date not null,
  mileage_at_service integer,
  provider text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.service_records enable row level security;
create policy "Users can view own service records" on public.service_records for select using (auth.uid() = user_id);
create policy "Users can insert own service records" on public.service_records for insert with check (auth.uid() = user_id);
create policy "Users can update own service records" on public.service_records for update using (auth.uid() = user_id);
create policy "Users can delete own service records" on public.service_records for delete using (auth.uid() = user_id);
create index idx_service_records_vehicle on public.service_records (vehicle_id);

-- ============================================================
-- Valuation History
-- ============================================================
create table if not exists public.valuation_history (
  id uuid default gen_random_uuid() primary key,
  vehicle_id uuid references public.portfolio_vehicles on delete cascade not null,
  user_id uuid references auth.users not null,
  market_value numeric(12,2) not null,
  sample_size integer,
  median_price numeric(12,2),
  min_price numeric(12,2),
  max_price numeric(12,2),
  source text default 'carma_comparables',
  recorded_at timestamptz default now()
);

alter table public.valuation_history enable row level security;
create policy "Users can view own valuation history" on public.valuation_history for select using (auth.uid() = user_id);
create policy "Users can insert own valuation history" on public.valuation_history for insert with check (auth.uid() = user_id);
create index idx_valuation_history_vehicle on public.valuation_history (vehicle_id, recorded_at desc);
