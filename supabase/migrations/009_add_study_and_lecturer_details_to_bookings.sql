alter table public.bookings
  add column if not exists study_level text,
  add column if not exists lect_name text,
  add column if not exists lect_email text,
  add column if not exists lect_contact text;
