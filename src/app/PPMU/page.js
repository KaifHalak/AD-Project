"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import { useRouter } from "next/navigation";

export default function ApprovalPage() {
  const [data, setData] = useState([]);
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredData = data.filter((item) => {

  // Search filter
  const matchesSearch =
    item.user_name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase()) ||

    String(item.id)
      .includes(searchTerm);

  // Type filter
  const matchesType =
    typeFilter === "All" ||
    item.type === typeFilter;

  // Status filter
  const matchesStatus =
    statusFilter === "All" ||
    item.ppmu_status === statusFilter;

  return (
    matchesSearch &&
    matchesType &&
    matchesStatus
  );
  });
  const fetchBookings = async () => {

    // Fetch equipment bookings
    const { data: equipmentData } = await supabase
      .from("equipment_bookings")
      .select("*");

    //Fetch lab bookings
    const { data: labData } = await supabase
      .from("lab_bookings")
      .select("*");

    //Add booking type
    const equipment = (equipmentData || []).map((item) => ({
      ...item,
      type: "equipment",
    }));

    const lab = (labData || []).map((item) => ({
      ...item,
      type: "lab",
    }));

    //Merge all bookings
    const merged = [...equipment, ...lab];

    //
    const activeBookings = merged.filter(
      (item) =>
        item.status !== "cancelled");

    //Fetch users
    const { data: users } = await supabase
      .from("users")
      .select("*");

    //Fetch equipment resources
    const { data: equipments } = await supabase
      .from("equipment")
      .select("*");

    //Fetch lab resources
    const { data: labs } = await supabase
      .from("labs")
      .select("*");

    // Map usernames and resource names
    const finalData = activeBookings.map((item) => {

      // Find matching user
      const user = users?.find(
        (u) =>
          String(u.id) === String(item.user_id)
      );

      // Find matching resource
      const resource =
        item.type === "equipment"
          ? equipments?.find(
              (e) =>
                String(e.id) ===
                String(item.equipment_id)
            )
          : labs?.find(
              (l) =>
                String(l.id) ===
                String(item.lab_id)
            );

      return {
        ...item,

        // Display username
        user_name:
          user?.username || "Unknown",

        // Display resource name
        resource_name:
          resource?.name ||
          item.equipment_id ||
          item.lab_id ||
          "Unknown",
      };
    });

    //Sort by latest booking date
    finalData.sort(
      (a, b) =>
        new Date(b.booking_date) -
        new Date(a.booking_date)
    );

    // Update table data
    setData(finalData);

    //Dashboard statistics
    const total = finalData.length;

    const pending = finalData.filter(
      (i) => i.ppmu_status === "Pending"
    ).length;

    const approved = finalData.filter(
      (i) => i.ppmu_status === "Approved"
    ).length;

    const rejected = finalData.filter(
      (i) => i.ppmu_status === "Rejected"
    ).length;

    // Update statistics cards
    setStats({
      total,
      pending,
      approved,
      rejected,
    });
  };
  useEffect(() => {
    fetchBookings();
  }, []);


  return (
    <div className="bg-[#f4efe9] min-h-screen">

      {/*HEADER*/}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-[#b0125b]">
          PPMU Approval Dashboard
        </h1>
        <p className="text-gray-500 mt-2">
          Perform final review for approved booking requests.
        </p>
      </div>

      <div className="flex justify-center pb-10">
        <div className="w-3/4 max-w-6xl space-y-8">

          {/*CARDS*/}
          <div className="grid grid-cols-4 gap-6">
            <Card title="Total Requests Received" value={stats.total} color="text-blue-600" />
            <Card title="Pending Final Review" value={stats.pending} color="text-yellow-600" />
            <Card title="Final Approved" value={stats.approved} color="text-green-600" />
            <Card title="Rejected" value={stats.rejected} color="text-pink-600" />
          </div>

          {/* FILTER */}
          <div className="bg-[#fafafa] border border-border-light p-6 rounded-2xl shadow-sm space-y-4">

            {/* SEARCH */}
            <input
              type="text"
              placeholder="Search by user name or request ID..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] outline-none placeholder:text-gray-400"
            />

            {/* TYPE FILTER */}
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value)
              }
             className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] cursor-pointer"
            >
              <option value="All">
                All Types
              </option>

              <option value="equipment">
                Equipment
              </option>

              <option value="lab">
                Lab
              </option>
            </select>

            {/* STATUS FILTER */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] cursor-pointer"
            >
              <option value="All">
                All Status
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Approved">
                Approved
              </option>

              <option value="Rejected">
                Rejected
              </option>
            </select>

            {/* CLEAR BUTTON */}
            <button
              onClick={() => {
                setSearchTerm("");
                setTypeFilter("All");
                setStatusFilter("All");
              }}
              className="w-full bg-[#f3efe9] p-3 rounded-xl font-medium cursor-pointer hover:bg-[#9f9993] transition"
            >
              Clear Filters
            </button>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-2xl overflow-hidden">

            {/* SCROLL CONTAINER */}
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                {/* STICKY HEADER */}
                <thead className="sticky top-0 bg-[#f2f2f2] text-gray-600 z-10">
                  <tr>
                    <th className="p-4 text-left">REQUEST ID</th>
                    <th className="p-4 text-left">TYPE</th>
                    <th className="p-4 text-left">USER NAME</th>
                    <th className="p-4 text-left">DATE SUBMITTED</th>
                    <th className="p-4 text-left">START</th>
                    <th className="p-4 text-left">END</th>
                    <th className="p-4 text-left">Lab / Equipment</th>
                    <th className="p-4 text-left">UNIT LEADER STATUS</th>
                    <th className="p-4 text-left">PPMU STATUS</th>
                    <th className="p-4 text-left">ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.map((item) => (
                    <tr
                       key={`${item.type}-${item.id}`}
                      className="border-t hover:bg-gray-50">
                      <td className="p-4">{item.id}</td>
                      <td className="p-4">{item.type}</td>
                      <td className="p-4">{item.user_name}</td>
                      <td className="p-4">{item.booking_date}</td>
                      <td className="p-4">{item.start_time}</td>
                      <td className="p-4">{item.end_time}</td>
                      <td className="p-4">{item.resource_name}</td>

                      {/* UNIT LEADER */}
                      <td className="p-4">
                        <StatusBadge
                          status={item.unit_leader_status}
                        />
                      </td>

                      {/* PPMU */}
                      <td className="p-4 min-w-[180px]">
                        <StatusBadge
                          status={item.ppmu_status}
                          isFinal
                        />
                      </td>

                      {/* ACTION */}
                      <td className="p-4">
                      {item.unit_leader_status === "Approved" && (

                        <button
                          onClick={() =>
                            router.push(`/PPMU/${item.type}/${item.id}`)
                          }
                          className="bg-[#b0125b] text-white px-4 py-2 rounded-lg cursor-pointer hover:opacity-80 transition"
                        >
                          View Details
                        </button>

                      )}
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/*card */
function Card({ title, value, color }) {
  return (
    <div className="bg-[#fafafa] border border-border-light p-6 rounded-2xl shadow-sm">
      <h2 className={`text-3xl font-bold ${color}`}>{value}</h2>
      <p className="text-gray-600 mt-2">{title}</p>
    </div>
  );
}

function StatusBadge({ status, isFinal }) {
  const map = {
    Pending: "bg-yellow-100 text-yellow-600",
    Approved: "bg-green-100 text-green-600",
    Rejected: "bg-red-100 text-red-600",
  };

  //
  let displayText = status;

  if (isFinal && status === "Pending") {
    displayText = "Pending Final Review";
  }

  return (
    <span
      className={`px-5 py-1.5 rounded-full text-xs font-medium inline-flex items-center justify-center whitespace-nowrap min-w-[140px] ${map[status]}`}
    >
      {displayText}
    </span>
  );
}