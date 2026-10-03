-- ==============================================================================
-- Migration: 20261003_zero_access_confidentiality_policy.sql
-- Description: Enforce Zero-Knowledge Multi-Tenancy & Zero-Access Privacy
--              Guarantees that Global Administrators (SUPERADMIN, GLOBAL_ADMIN)
--              have ZERO read or write access to private campaign operational,
--              financial, voter census, leader, or strategic data.
-- ==============================================================================

-- 1. Ensure get_user_client_id() returns NULL for Global SuperAdmins
create or replace function public.get_user_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case 
    when exists (
      select 1 from public.profiles
      where id = auth.uid() 
        and upper(role) in ('SUPERADMIN', 'GLOBAL_ADMIN')
    ) then null
    else client_id
  end
  from public.profiles
  where id = auth.uid()
    and upper(status) in ('ACTIVE', 'ACTIVO')
  limit 1;
$$;

-- 2. Ensure get_user_campaign_id() returns NULL for Global SuperAdmins
create or replace function public.get_user_campaign_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case 
    when exists (
      select 1 from public.profiles
      where id = auth.uid() 
        and upper(role) in ('SUPERADMIN', 'GLOBAL_ADMIN')
    ) then null
    else campaign_id
  end
  from public.profiles
  where id = auth.uid()
    and upper(status) in ('ACTIVE', 'ACTIVO')
  limit 1;
$$;

-- 3. Drop legacy platform owner policies that permitted inspection of campaigns & members
drop policy if exists platform_owner_campaigns_read on public.campaigns;
drop policy if exists platform_owner_campaigns_update on public.campaigns;
drop policy if exists platform_owner_members_read on public.campaign_members;

-- 4. Campaign isolation policy: campaigns can only be read by their own authenticated members / client
drop policy if exists "Campaigns: Client and Member access only" on public.campaigns;
create policy "Campaigns: Client and Member access only"
on public.campaigns for select
to authenticated
using (
  -- SuperAdmins are explicitly excluded from reading campaign business details
  not public.is_superadmin()
  and (
    id = public.get_user_campaign_id()
    or (client_id is not null and client_id = public.get_user_client_id())
    or public.is_campaign_member(id)
  )
);

-- 5. Business Data Isolation: Voters, Leaders, Budget, Surveys, Witnesses, Jurors
-- Ensure table RLS is strictly tied to tenant client_id or campaign_id without superadmin bypass

do $$
begin
  -- Budget items
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'budget_items') then
    execute 'alter table public.budget_items enable row level security';
    execute 'drop policy if exists "budget_items_zero_knowledge" on public.budget_items';
    execute 'create policy "budget_items_zero_knowledge" on public.budget_items for all to authenticated
      using (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )
      with check (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )';
  end if;

  -- Voters
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'voters') then
    execute 'alter table public.voters enable row level security';
    execute 'drop policy if exists "voters_zero_knowledge" on public.voters';
    execute 'create policy "voters_zero_knowledge" on public.voters for all to authenticated
      using (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )
      with check (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )';
  end if;

  -- Leaders
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'leaders') then
    execute 'alter table public.leaders enable row level security';
    execute 'drop policy if exists "leaders_zero_knowledge" on public.leaders';
    execute 'create policy "leaders_zero_knowledge" on public.leaders for all to authenticated
      using (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )
      with check (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )';
  end if;

  -- Witnesses
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'witnesses') then
    execute 'alter table public.witnesses enable row level security';
    execute 'drop policy if exists "witnesses_zero_knowledge" on public.witnesses';
    execute 'create policy "witnesses_zero_knowledge" on public.witnesses for all to authenticated
      using (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )
      with check (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )';
  end if;

  -- Jurors
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'jurors') then
    execute 'alter table public.jurors enable row level security';
    execute 'drop policy if exists "jurors_zero_knowledge" on public.jurors';
    execute 'create policy "jurors_zero_knowledge" on public.jurors for all to authenticated
      using (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )
      with check (
        not public.is_superadmin()
        and (
          (campaign_id is not null and campaign_id = public.get_user_campaign_id())
          or (client_id is not null and client_id = public.get_user_client_id())
        )
      )';
  end if;
end $$;

comment on function public.get_user_client_id() is 'Zero-Knowledge: Returns NULL for global superadmins, strictly isolating campaign data.';
comment on function public.get_user_campaign_id() is 'Zero-Knowledge: Returns NULL for global superadmins, strictly isolating campaign data.';
