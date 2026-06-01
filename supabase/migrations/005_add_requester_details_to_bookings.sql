alter table public.lab_bookings
  add column if not exists requester_identifier text,
  add column if not exists requester_faculty text,
  add column if not exists requester_contact text;

alter table public.equipment_bookings
  add column if not exists requester_identifier text,
  add column if not exists requester_faculty text,
  add column if not exists requester_contact text;
