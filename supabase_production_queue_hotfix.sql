-- Lot 5 Barbershop production queue hotfix
-- Paste this into Supabase SQL Editor and run it once.
-- It adds the columns required by the upgraded Queue Manager + POS workflow.

alter table public.queue_entries
  add column if not exists entry_type text default 'walk_in',
  add column if not exists assigned_barber_id uuid references public.profiles(id) on delete set null,
  add column if not exists service_type text,
  add column if not exists remark text;

update public.queue_entries
set entry_type = case when booked_time is null then 'walk_in' else 'booking' end
where entry_type is null;

alter table public.queue_entries
  drop constraint if exists queue_entries_entry_type_check;

alter table public.queue_entries
  add constraint queue_entries_entry_type_check
  check (entry_type in ('walk_in', 'booking'));

create index if not exists idx_queue_entries_active_type
on public.queue_entries(entry_type, status, queue_number);

create index if not exists idx_queue_entries_booked_time
on public.queue_entries(booked_time)
where booked_time is not null;

alter table public.queue_entries enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'queue_entries'
  loop
    execute format('drop policy if exists %I on public.queue_entries', policy_record.policyname);
  end loop;
end $$;

create policy "Queue active rows visible, own history visible"
on public.queue_entries
for select
using (
  status in ('WAITING', 'NOTIFIED', 'CALLED', 'IN_CHAIR', 'HOLD', 'PAYMENT_PENDING')
  or auth.uid() = user_id
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'owner', 'barber')
  )
);

create policy "Queue insert own customer or staff"
on public.queue_entries
for insert
to authenticated
with check (
  auth.uid() = user_id
  or user_id is null
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'owner', 'barber')
  )
);

create policy "Queue update own or staff"
on public.queue_entries
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'owner', 'barber')
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'owner', 'barber')
  )
);

create or replace function public.join_walk_in_queue(
  p_customer_name text,
  p_phone_number text default null,
  p_user_id uuid default null,
  p_service_type text default null,
  p_remark text default null
)
returns public.queue_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  inserted_entry public.queue_entries;
begin
  perform pg_advisory_xact_lock(hashtext('lot5_walk_in_queue_' || current_date::text));

  select coalesce(max(queue_number), 0) + 1
  into next_number
  from public.queue_entries
  where entry_type = 'walk_in'
    and joined_at >= date_trunc('day', now())
    and joined_at < date_trunc('day', now()) + interval '1 day';

  insert into public.queue_entries (
    user_id,
    customer_name,
    phone_number,
    queue_number,
    status,
    entry_type,
    service_type,
    remark
  )
  values (
    coalesce(p_user_id, auth.uid()),
    p_customer_name,
    p_phone_number,
    next_number,
    'WAITING',
    'walk_in',
    p_service_type,
    p_remark
  )
  returning * into inserted_entry;

  return inserted_entry;
end;
$$;

grant execute on function public.join_walk_in_queue(text, text, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
