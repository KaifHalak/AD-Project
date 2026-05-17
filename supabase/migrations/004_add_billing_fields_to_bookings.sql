alter table lab_bookings
  add column if not exists grant_number text,
  add column if not exists vot_number text,
  add column if not exists total_price numeric(12, 2);

alter table equipment_bookings
  add column if not exists grant_number text,
  add column if not exists vot_number text,
  add column if not exists total_price numeric(12, 2);

create or replace view bookings as
select
  concat('lab-', lab_bookings.id) as id,
  'lab'::text as booking_type,
  lab_bookings.lab_id as item_id,
  lab_bookings.user_id,
  lab_bookings.booking_date,
  lab_bookings.start_time,
  lab_bookings.end_time,
  lab_bookings.status,
  labs.name as item_name,
  lab_bookings.grant_number,
  lab_bookings.vot_number,
  lab_bookings.total_price,
  lab_bookings.created_at
from lab_bookings
left join labs on labs.id = lab_bookings.lab_id
union all
select
  concat('equipment-', equipment_bookings.id) as id,
  'equipment'::text as booking_type,
  equipment_bookings.equipment_id as item_id,
  equipment_bookings.user_id,
  equipment_bookings.booking_date,
  equipment_bookings.start_time,
  equipment_bookings.end_time,
  equipment_bookings.status,
  equipment.name as item_name,
  equipment_bookings.grant_number,
  equipment_bookings.vot_number,
  equipment_bookings.total_price,
  equipment_bookings.created_at
from equipment_bookings
left join equipment on equipment.id = equipment_bookings.equipment_id;
