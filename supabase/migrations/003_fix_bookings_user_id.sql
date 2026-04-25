-- Fix: user_id should match the users.id type (integer, not uuid)
-- Run this in Supabase SQL Editor if you already ran migration 001

-- Drop and recreate the bookings table with correct user_id type
drop table if exists bookings;

create table bookings (
  id uuid default gen_random_uuid() primary key,
  user_id integer not null,
  type text not null check (type in ('lab', 'equipment')),
  resource_name text not null,
  resource_subtitle text,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'cancelled', 'rejected')),
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table bookings disable row level security;

create index if not exists bookings_user_id_idx on bookings (user_id);
create index if not exists bookings_status_idx on bookings (status);
