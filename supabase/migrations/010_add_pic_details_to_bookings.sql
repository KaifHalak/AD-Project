alter table public.bookings
  add column if not exists pic_name text,
  add column if not exists pic_email text;
