-- Create bookings table for the Lab Booking System
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)

create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
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

-- Disable RLS so API routes using service role can read/write freely
-- Auth is handled at the API route level
alter table bookings disable row level security;

-- Index for fast lookups by user
create index if not exists bookings_user_id_idx on bookings (user_id);

-- Index for status filtering
create index if not exists bookings_status_idx on bookings (status);
