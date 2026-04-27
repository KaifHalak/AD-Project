-- STEP 1: Check your users (run this first to confirm users exist)
-- select id, email from users;

-- STEP 2: Insert demo bookings using a subquery to get the first user's ID
-- (no PL/pgSQL needed — works in any Supabase SQL editor)

insert into bookings (user_id, type, resource_name, resource_subtitle, booking_date, start_time, end_time, status, image_url)
select
  u.id,
  v.type,
  v.resource_name,
  v.resource_subtitle,
  (current_date + v.days_offset)::date,
  v.start_time::time,
  v.end_time::time,
  v.status,
  v.image_url
from (select id from users limit 1) u
cross join (
  values
    ('lab',       'Chemistry Lab',      'Laboratory – Building A, Floor 2', interval '2 days',  '09:00', '11:00', 'pending',   'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=300&h=200&fit=crop'),
    ('lab',       'Physics Lab',        'Laboratory – Building B, Floor 3', interval '4 days',  '14:00', '16:00', 'approved',  'https://images.unsplash.com/photo-1567427018141-0584cfcbf1b8?w=300&h=200&fit=crop'),
    ('equipment', 'Mass Spectrometer',  'Equipment – Building A, Room 204', interval '6 days',  '10:00', '12:00', 'approved',  'https://images.unsplash.com/photo-1581093458791-9d5e4c4a8d1e?w=300&h=200&fit=crop'),
    ('equipment', 'Electron Microscope','Equipment – Building C, Room 201', interval '8 days',  '13:00', '15:00', 'pending',   'https://images.unsplash.com/photo-1530210124550-912dc1381cb8?w=300&h=200&fit=crop'),
    ('lab',       'Biology Lab',        'Laboratory – Building A, Floor 1', interval '-3 days', '08:00', '10:00', 'cancelled', 'https://images.unsplash.com/photo-1576671081837-49000212a370?w=300&h=200&fit=crop'),
    ('equipment', 'DNA Sequencer',      'Equipment – Building B, Room 308', interval '-1 days', '11:00', '13:00', 'rejected',  'https://images.unsplash.com/photo-1581093804475-577d72e35323?w=300&h=200&fit=crop')
) as v(type, resource_name, resource_subtitle, days_offset, start_time, end_time, status, image_url);
