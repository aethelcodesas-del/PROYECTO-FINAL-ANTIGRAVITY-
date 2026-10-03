-- ==============================================================================
-- Migration: 20261003_fix_profiles_full_name_and_custom_roles.sql
-- Description: Add full_name column to profiles for full compatibility with
--              admin queries and create custom_roles table with RLS.
-- ==============================================================================

-- 1. Ensure full_name column exists on public.profiles
alter table public.profiles add column if not exists full_name text;

-- 2. Populate full_name from display_name, nombre or email if currently null
update public.profiles
set full_name = coalesce(display_name, email, 'Usuario')
where full_name is null;

-- 3. Ensure custom_roles table exists with proper schema
create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  allowed_modules text[] default '{}',
  is_system boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on custom_roles
alter table public.custom_roles enable row level security;

-- Policies for custom_roles
drop policy if exists "custom_roles_read_all" on public.custom_roles;
create policy "custom_roles_read_all" on public.custom_roles
  for select to authenticated using (true);

drop policy if exists "custom_roles_admin_write" on public.custom_roles;
create policy "custom_roles_admin_write" on public.custom_roles
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Pre-seed core custom roles if empty
insert into public.custom_roles (code, name, description, allowed_modules, is_system)
values
  ('AUDITOR_CNE', 'Auditor CNE', 'Auditor electoral con acceso a ingresos, gastos y contabilidad', array['modulo_admin', 'presupuesto'], false),
  ('ESTRATEGA_SENIOR', 'Estratega Senior', 'Coordinador de analítica, narrativa, DOFA y programa de gobierno', array['gestion_estrategica'], false),
  ('LIDER_COMUNA', 'Líder Comuna / Zonal', 'Coordinador territorial de líderes y registro de votantes', array['gestion_territorial'], false)
on conflict (code) do nothing;
