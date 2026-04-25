import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mxeljwckxknfpyanrlvp.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZWxqd2NreGtuZnB5YW5ybHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjAxNzM2MywiZXhwIjoyMDkxNTkzMzYzfQ.oRrVvPUtdna-GocmqZC_-ODBvM-Z1mCVmsltfmPaFW8";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function buildDemoBookings(userId) {
  return [
    {
      user_id: userId,
      type: "lab",
      resource_name: "Chemistry Lab",
      resource_subtitle: "Laboratory – Building A, Floor 2",
      booking_date: daysFromNow(2),
      start_time: "09:00:00",
      end_time: "11:00:00",
      status: "pending",
      image_url: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=300&h=200&fit=crop",
    },
    {
      user_id: userId,
      type: "lab",
      resource_name: "Physics Lab",
      resource_subtitle: "Laboratory – Building B, Floor 3",
      booking_date: daysFromNow(4),
      start_time: "14:00:00",
      end_time: "16:00:00",
      status: "approved",
      image_url: "https://images.unsplash.com/photo-1567427018141-0584cfcbf1b8?w=300&h=200&fit=crop",
    },
    {
      user_id: userId,
      type: "equipment",
      resource_name: "Mass Spectrometer",
      resource_subtitle: "Equipment – Building A, Room 204",
      booking_date: daysFromNow(6),
      start_time: "10:00:00",
      end_time: "12:00:00",
      status: "approved",
      image_url: "https://images.unsplash.com/photo-1581093458791-9d5e4c4a8d1e?w=300&h=200&fit=crop",
    },
    {
      user_id: userId,
      type: "equipment",
      resource_name: "Electron Microscope",
      resource_subtitle: "Equipment – Building C, Room 201",
      booking_date: daysFromNow(8),
      start_time: "13:00:00",
      end_time: "15:00:00",
      status: "pending",
      image_url: "https://images.unsplash.com/photo-1530210124550-912dc1381cb8?w=300&h=200&fit=crop",
    },
    {
      user_id: userId,
      type: "lab",
      resource_name: "Biology Lab",
      resource_subtitle: "Laboratory – Building A, Floor 1",
      booking_date: daysFromNow(-3),
      start_time: "08:00:00",
      end_time: "10:00:00",
      status: "cancelled",
      image_url: "https://images.unsplash.com/photo-1576671081837-49000212a370?w=300&h=200&fit=crop",
    },
    {
      user_id: userId,
      type: "equipment",
      resource_name: "DNA Sequencer",
      resource_subtitle: "Equipment – Building B, Room 308",
      booking_date: daysFromNow(-1),
      start_time: "11:00:00",
      end_time: "13:00:00",
      status: "rejected",
      image_url: "https://images.unsplash.com/photo-1581093804475-577d72e35323?w=300&h=200&fit=crop",
    },
  ];
}

async function seed() {
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email");

  if (usersError || !users?.length) {
    console.error("❌ No users found. Register an account at http://localhost:3000 first.");
    process.exit(1);
  }

  console.log(`Found ${users.length} user(s). Seeding bookings for all...`);

  await supabase.from("bookings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("🗑️  Cleared all existing bookings.");

  for (const user of users) {
    const bookings = buildDemoBookings(user.id);
    const { data, error } = await supabase.from("bookings").insert(bookings).select();
    if (error) {
      console.error(`❌ Failed for ${user.email}:`, error.message);
    } else {
      console.log(`✅ Inserted ${data.length} bookings for ${user.email} (id: ${user.id})`);
    }
  }

  console.log("\n👉 Open http://localhost:3000/booking-records to see the design.");
}

seed();
