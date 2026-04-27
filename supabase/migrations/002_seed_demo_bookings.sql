-- Demo seed data for bookings table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- It automatically uses the first user found in your users table

do $$
declare
  demo_user_id uuid;
begin
  -- Get the first available user id
  select id into demo_user_id from users limit 1;

  if demo_user_id is null then
    raise exception 'No users found in the users table. Please register an account first.';
  end if;

  insert into bookings (user_id, type, resource_name, resource_subtitle, booking_date, start_time, end_time, status, image_url)
  values
    (
      demo_user_id,
      'lab',
      'Chemistry Lab',
      'Laboratory – Building A, Floor 2',
      current_date + interval '2 days',
      '09:00',
      '11:00',
      'pending',
      'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=300&h=200&fit=crop'
    ),
    (
      demo_user_id,
      'lab',
      'Physics Lab',
      'Laboratory – Building B, Floor 3',
      current_date + interval '4 days',
      '14:00',
      '16:00',
      'approved',
      'https://images.unsplash.com/photo-1567427018141-0584cfcbf1b8?w=300&h=200&fit=crop'
    ),
    (
      demo_user_id,
      'equipment',
      'Mass Spectrometer',
      'Equipment – Building A, Room 204',
      current_date + interval '6 days',
      '10:00',
      '12:00',
      'approved',
      'https://images.unsplash.com/photo-1581093458791-9d5e4c4a8d1e?w=300&h=200&fit=crop'
    ),
    (
      demo_user_id,
      'equipment',
      'Electron Microscope',
      'Equipment – Building C, Room 201',
      current_date + interval '8 days',
      '13:00',
      '15:00',
      'pending',
      'https://images.unsplash.com/photo-1530210124550-912dc1381cb8?w=300&h=200&fit=crop'
    ),
    (
      demo_user_id,
      'lab',
      'Biology Lab',
      'Laboratory – Building A, Floor 1',
      current_date - interval '3 days',
      '08:00',
      '10:00',
      'cancelled',
      'https://images.unsplash.com/photo-1576671081837-49000212a370?w=300&h=200&fit=crop'
    ),
    (
      demo_user_id,
      'equipment',
      'DNA Sequencer',
      'Equipment – Building B, Room 308',
      current_date - interval '1 day',
      '11:00',
      '13:00',
      'rejected',
      'https://images.unsplash.com/photo-1581093804475-577d72e35323?w=300&h=200&fit=crop'
    );

  raise notice 'Demo bookings inserted successfully for user %', demo_user_id;
end $$;
