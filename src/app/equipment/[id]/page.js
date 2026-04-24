"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

export default function EquipmentBookingPage() {
  const { id } = useParams();

  const [equipment, setEquipment] = useState(null);
  const [bookings, setBookings] = useState([]);

  const [currentDate, setCurrentDate] = useState(new Date());

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");

  const [usage, setUsage] = useState("");
  const [token, setToken] = useState("");

  const times = [
    "08:00","09:00","10:00","11:00","12:00",
    "13:00","14:00","15:00","16:00","17:00"
  ];

  // ===== 日期处理 =====
  const formatDateForDB = (d) => d.toISOString().split("T")[0];

  const formatDate = (d) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

  const changeDate = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  // ===== get equipment =====
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchEquipment() {
      const { data } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", id)
        .single();

      setEquipment(data);
    }

    fetchEquipment();
  }, [id]);

  // ===== get booking =====
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchBookings() {
      const { data } = await supabase
        .from("equipment_bookings")
        .select("*")
        .eq("equipment_id", id)
        .eq("booking_date", formatDateForDB(currentDate));

      setBookings(data || []);
    }

    fetchBookings();
  }, [id, currentDate]);

  if (!equipment) return <p>Loading...</p>;

  //status
  const getStatus = (time) => {
    const hour = parseInt(time);

    for (let b of bookings) {
      const start = parseInt(b.start_time);
      const end = parseInt(b.end_time);

      if (hour >= start && hour < end) {
        return b.status; // booked / pending
      }
    }

    return "available";
  };

  //duration / total
  const duration = parseInt(endTime) - parseInt(startTime);
  const total = duration * equipment.price_per_hour;

  //  check availability
  const isTimeAvailable = () => {
  const start = parseInt(startTime);
  const end = parseInt(endTime);

  return !bookings.some((b) => {
    const bStart = parseInt(b.start_time);
    const bEnd = parseInt(b.end_time);

    return start < bEnd && end > bStart;
  });
};

const available = isTimeAvailable();

  //handle booking
const handleSubmitBooking = async () => {
  const supabase = getSupabaseBrowserClient();

  // 🔥 ① 先检查时间冲突（你已经写好的 available）
  if (!available) {
    alert("Time slot not available ❌ Please select another time");
    return;
  }

  // 🔥 ② 再检查 token
  if (!token) {
    alert("Please enter token");
    return;
  }

  // 🔥 ③ 验证 token
  const { data: tokenData, error: tokenError } = await supabase
    .from("pic_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (tokenError || !tokenData) {
    alert("Invalid token ❌");
    return;
  }

  // 🔥 ④ 提交 booking
  const { data, error } = await supabase
    .from("equipment_bookings")
    .insert([
      {
        equipment_id: id,
        booking_date: formatDateForDB(currentDate),
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        status: "pending",
        user_id: tokenData.assigned_to,
      },
    ])
    .select();

  if (error) {
    console.error(error);
    alert("Booking failed ❌");
  } else {
    alert("Booking submitted! Waiting for approval ⏳");

    setToken("");
    setUsage("");
  }
};
  
  return (
    <div className="bg-[#f3eee7] min-h-screen p-10 space-y-6">

      {/*01equipment info*/}
      <div className="bg-[#efe8df] p-6 rounded-2xl w-3/4 mx-auto">
        <h1 className="text-2xl font-semibold">{equipment.name}</h1>
        <p className="text-gray-400">ID: {equipment.id}</p>
      </div>

      {/*02show Availability */}
      <div className="bg-[#efe8df] p-6 rounded-2xl w-3/4 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">

          <div className="flex items-center gap-4">
            <button onClick={() => changeDate(-1)} className="px-3 py-1 border rounded-full">◀</button>

            <h2 className="text-xl font-semibold">
              {formatDate(currentDate)}
            </h2>

            <button onClick={() => changeDate(1)} className="px-3 py-1 border rounded-full">▶</button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 rounded-full border border-pink-400 text-pink-500"
            >
              TODAY
            </button>

            <input
              type="date"
              value={currentDate.toISOString().split("T")[0]}
              onChange={(e) =>
                setCurrentDate(new Date(e.target.value))
              }
              onClick={(e) => e.target.showPicker?.()} 
              className="border rounded-full px-4 py-2 cursor-pointer"
            />
          </div>
        </div>

        {/* Availability Grid */}
        <div className="overflow-x-auto pb-4 custom-scroll scroll-smooth">

          {/* Time Slots */}
          <div className="grid grid-cols-[160px_repeat(10,120px)] gap-4 text-sm text-gray-500 mb-4 min-w-max">
            <div></div>
            {times.map((t) => (
              <div key={t} className="text-center">{t}</div>
            ))}
          </div>

          {/* Content */}
          <div className="grid grid-cols-[160px_repeat(10,120px)] gap-4 items-center min-w-max">

            {/* equipment info at left */}
            <div>
              <p className="font-semibold">{equipment.name}</p>
              <p className="text-sm text-gray-400">{equipment.location}</p>
            </div>

            {/* time slots */}
            {times.map((t) => {
              const status = getStatus(t);

              return (
                <div
                  key={t}
                  className={`h-24 rounded-2xl flex items-center justify-center
                  ${
                    status === "booked"
                      ? "bg-pink-300 text-pink-800"
                      : status === "pending"
                      ? "bg-purple-300 text-purple-800"
                      : "bg-green-200 text-green-800"
                  }`}
                >
                  {status === "booked" && "BOOKED"}
                  {status === "pending" && "PENDING"}
                </div>
              );
            })}

          </div>

        </div>
      </div>

      {/*03time choose*/}
      <div className="bg-[#efe8df] p-6 rounded-2xl w-3/4 max-w-6xl mx-auto space-y-6">

        {/* DATE + DURATION */}
        <div className="grid grid-cols-2 gap-6">

          <div>
            <p className="text-xs text-gray-400 mb-1">DATE</p>
            <div className="p-3 border rounded-xl">
              {formatDate(currentDate)}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">DURATION</p>
            <div className="p-3 border rounded-xl">
              {duration}h
            </div>
          </div>

        </div>

        {/* START / END */}
        <div className="grid grid-cols-2 gap-6">

          <div>
            <p className="text-xs text-gray-400 mb-1">START TIME</p>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-3 border rounded-xl"
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">END TIME</p>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-3 border rounded-xl"
            >
              {times.filter((t) => t > startTime).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Suggested Slots */}
        <div>
          <p className="text-xs text-gray-400 mb-3 tracking-wider">
            SUGGESTED SLOTS
          </p>

          <div className="flex gap-4">

            {[
              ["09:00","11:00"],
              ["11:00","13:00"],
              ["14:00","16:00"],
              ["15:00","17:00"],
            ].map(([s, e], i) => {

              const duration = parseInt(e) - parseInt(s);

              const slotAvailable = !bookings.some((b) => {
                const bStart = parseInt(b.start_time);
                const bEnd = parseInt(b.end_time);
                return parseInt(s) < bEnd && parseInt(e) > bStart;
              });

              return (
                <div
                  key={i}
                  onClick={() => {
                    setStartTime(s);
                    setEndTime(e);
                  }}
                  className={`rounded-2xl p-5 w-48 cursor-pointer transition hover:shadow-md
                    ${
                      slotAvailable
                        ? "bg-[#faf7f3]"
                        : "bg-red-100"
                    }
                  `}
                >
                  <p className="font-semibold text-lg">
                    {s} – {e}
                  </p>

                  <p className="text-sm text-gray-400 mt-1">
                    {duration}h
                  </p>

                  <p
                    className={`text-sm mt-3 font-medium
                      ${
                        slotAvailable
                          ? "text-pink-600"
                          : "text-red-600"
                      }
                    `}
                  >
                    {slotAvailable ? "QUICK SELECT" : "NOT AVAILABLE"}
                  </p>
                </div>
              );
            })}

          </div>

          {/* Availability Status */}
          <div
            className={`mt-6 p-4 rounded-2xl
              ${
                !bookings.some((b) => {
                  const bStart = parseInt(b.start_time);
                  const bEnd = parseInt(b.end_time);

                  return (
                    parseInt(startTime) < bEnd &&
                    parseInt(endTime) > bStart
                  );
                })
                  ? "bg-green-200 text-green-900"
                  : "bg-red-200 text-red-900"
              }
            `}
          >
            {
              !bookings.some((b) => {
                const bStart = parseInt(b.start_time);
                const bEnd = parseInt(b.end_time);

                return (
                  parseInt(startTime) < bEnd &&
                  parseInt(endTime) > bStart
                );
              })
                ? "✔ Slot is available"
                : "❌ Time slot not available"
            }
          </div>

        </div>

      </div>

      {/*04Usage*/}
      <div className="bg-[#efe8df] p-6 rounded-2xl w-3/4 max-w-6xl mx-auto">
        <textarea
          placeholder="Briefly describe research objective..."
          className="w-full p-4 border rounded-xl"
          value={usage}
          onChange={(e) => setUsage(e.target.value)}
        />
      </div>

      {/*05Token*/}
      <div className="bg-[#efe8df] p-6 rounded-2xl w-3/4 max-w-6xl mx-auto">
        <input
          placeholder="Enter your token"
          className="w-full p-3 border rounded-xl"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>

      {/*06prices*/}
      <div className="mt-6 flex justify-between items-centerbg-[#efe8df] p-6 rounded-2xl w-3/4 max-w-6xl mx-auto">

        <div>
          <p className="text-xs text-gray-400">TOTAL</p>
          <p className="text-2xl text-pink-600 font-bold">
            ${total}.00
          </p>
        </div>

        <button
          onClick={handleSubmitBooking}
          className="bg-pink-600 text-white px-6 py-3 rounded-full hover:bg-pink-700 transition cursor-pointer"
        >
          Book Now
        </button>

      </div>
    </div>
  );
}