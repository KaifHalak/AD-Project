create table if not exists public.booking_quotations (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  quotation_number text not null unique,
  quotation_date date not null default current_date,
  version integer not null default 1,
  booking_type text not null
    check (booking_type = any (array['lab'::text, 'equipment'::text])),
  primary_booking_id bigint not null,
  booking_ids bigint[] not null check (cardinality(booking_ids) > 0),
  user_id bigint not null references public.users(id),
  quotation_payload jsonb not null,
  constraint booking_quotations_primary_booking_unique
    unique (booking_type, primary_booking_id)
);

create index if not exists booking_quotations_user_id_idx
  on public.booking_quotations(user_id);

create index if not exists booking_quotations_booking_lookup_idx
  on public.booking_quotations using gin (booking_ids);

create index if not exists booking_quotations_booking_type_idx
  on public.booking_quotations(booking_type);

insert into public.booking_quotations (
  quotation_number,
  quotation_date,
  booking_type,
  primary_booking_id,
  booking_ids,
  user_id,
  quotation_payload
)
select
  'QTN-LAB-' || lb.id::text,
  coalesce(lb.created_at::date, current_date),
  'lab',
  lb.id,
  array[lb.id],
  lb.user_id,
  jsonb_build_object(
    'bookingType', 'Lab Booking',
    'quotationNumber', 'QTN-LAB-' || lb.id::text,
    'quotationDate', to_char(coalesce(lb.created_at::date, current_date), 'DD Month YYYY'),
    'resourceName', coalesce(l.name, 'Lab'),
    'resourceId', lb.lab_id,
    'requester', jsonb_build_object(
      'username', coalesce(u.username, ''),
      'email', coalesce(u.email, ''),
      'role', coalesce(u.role, '')
    ),
    'requesterIdentifier', coalesce(lb.requester_identifier, ''),
    'requesterFaculty', coalesce(lb.requester_faculty, ''),
    'requesterContact', coalesce(lb.requester_contact, ''),
    'pic', jsonb_build_object(
      'username', '',
      'email', '',
      'role', ''
    ),
    'picCode', '',
    'startDate', lb.booking_date::text,
    'endDate', lb.booking_date::text,
    'startTime', left(lb.start_time::text, 5),
    'endTime', left(lb.end_time::text, 5),
    'bookingDayCount', 1,
    'durationHours', extract(epoch from (lb.end_time - lb.start_time)) / 3600,
    'pricePerHour', coalesce(l.price_per_hour, 0),
    'totalPrice', coalesce(lb.total_price, 0),
    'votNumber', coalesce(lb.vot_number, ''),
    'purpose', coalesce(lb.booking_reason, ''),
    'resourceLocation', coalesce(l.location, ''),
    'resourceStatus', coalesce(l.status, ''),
    'resourceCourse', coalesce(l.course, ''),
    'resourceDescription', coalesce(l.description, '')
  )
from public.lab_bookings lb
left join public.labs l on l.id = lb.lab_id
left join public.users u on u.id = lb.user_id
on conflict (booking_type, primary_booking_id) do nothing;

insert into public.booking_quotations (
  quotation_number,
  quotation_date,
  booking_type,
  primary_booking_id,
  booking_ids,
  user_id,
  quotation_payload
)
select
  'QTN-EQUIPMENT-' || eb.id::text,
  coalesce(eb.created_at::date, current_date),
  'equipment',
  eb.id,
  array[eb.id],
  eb.user_id,
  jsonb_build_object(
    'bookingType', 'Equipment Booking',
    'quotationNumber', 'QTN-EQUIPMENT-' || eb.id::text,
    'quotationDate', to_char(coalesce(eb.created_at::date, current_date), 'DD Month YYYY'),
    'resourceName', coalesce(e.name, 'Equipment'),
    'resourceId', eb.equipment_id,
    'requester', jsonb_build_object(
      'username', coalesce(u.username, ''),
      'email', coalesce(u.email, ''),
      'role', coalesce(u.role, '')
    ),
    'requesterIdentifier', coalesce(eb.requester_identifier, ''),
    'requesterFaculty', coalesce(eb.requester_faculty, ''),
    'requesterContact', coalesce(eb.requester_contact, ''),
    'pic', jsonb_build_object(
      'username', '',
      'email', '',
      'role', ''
    ),
    'picCode', '',
    'startDate', eb.booking_date::text,
    'endDate', eb.booking_date::text,
    'startTime', left(eb.start_time::text, 5),
    'endTime', left(eb.end_time::text, 5),
    'bookingDayCount', 1,
    'durationHours', extract(epoch from (eb.end_time - eb.start_time)) / 3600,
    'pricePerHour', coalesce(e.price_per_hour, 0),
    'totalPrice', coalesce(eb.total_price, 0),
    'votNumber', coalesce(eb.vot_number, ''),
    'purpose', coalesce(eb.booking_reason, ''),
    'resourceLocation', coalesce(e.location, ''),
    'resourceStatus', coalesce(e.status, ''),
    'resourceCourse', coalesce(e.course, ''),
    'resourceDescription', coalesce(e.description, ''),
    'resourceQuantity', coalesce(e.quantity, 0),
    'resourceLabId', coalesce(e.lab_id, '')
  )
from public.equipment_bookings eb
left join public.equipment e on e.id = eb.equipment_id
left join public.users u on u.id = eb.user_id
on conflict (booking_type, primary_booking_id) do nothing;
