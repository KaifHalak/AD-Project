alter table public.bookings
  add column if not exists overall_status text not null default 'pending_unit_leader_process';

alter table public.bookings
  alter column overall_status set default 'pending_unit_leader_process';

update public.bookings
set overall_status = case
  when overall_status in ('cancelled') then 'cancelled'
  when overall_status in ('under_ppmu_review', 'pending_ppmu_process') then 'pending_ppmu_process'
  when overall_status in ('approved', 'rejected', 'partially_approved', 'processed') then 'processed'
  else 'pending_unit_leader_process'
end;

alter table public.bookings
  alter column overall_status set not null;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%overall_status%'
  loop
    execute format(
      'alter table public.bookings drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.bookings
  add constraint bookings_overall_status_check
  check (
    overall_status in (
      'pending_unit_leader_process',
      'pending_ppmu_process',
      'processed',
      'cancelled'
    )
  );
