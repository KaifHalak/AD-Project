alter table public.bookings
  add column if not exists lect_faculty text,
  add column if not exists lect_id text;
