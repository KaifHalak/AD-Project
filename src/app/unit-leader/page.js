"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSession } from "@/lib/supabase/auth";

function formatTime(timeValue) {
  if (!timeValue) return "-";

  const [hours = "0", minutes = "0"] = String(timeValue).split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function UnitLeaderApprovalPage() {
  const [data, setData] = useState([]);
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
  const [errorMessage, setErrorMessage] = useState("");

  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.id).includes(searchTerm);

    const matchesType = typeFilter === "All" || item.type === typeFilter;
    const matchesStatus =
      statusFilter === "All" || item.unit_leader_status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  useEffect(() => {
    let isMounted = true;

    getCurrentSession()
      .then(async ({ data: sessionData }) => {
        const accessToken = sessionData?.session?.access_token;

        if (!isMounted) return;

        setErrorMessage("");

        if (!accessToken) {
          router.push("/");
          return;
        }

        const response = await fetch("/api/unit-leader", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const responseData = await response.json();

        if (!isMounted) return;

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/");
            return;
          }

          setErrorMessage(
            responseData?.error || "Could not load unit leader requests.",
          );
          return;
        }

        setData(responseData.requests || []);
        setStats(
          responseData.stats || {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
          },
        );
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setErrorMessage("Server error while loading unit leader requests.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="bg-[#f4efe9] min-h-screen">
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-[#b0125b]">
          Unit Leader Approval Dashboard
        </h1>
        <p className="text-gray-500 mt-2">
          Review booking requests before they move to PPMU final approval.
        </p>
      </div>

      <div className="flex justify-center pb-10">
        <div className="w-3/4 max-w-6xl space-y-8">
          <div className="bg-[#fafafa] border border-border-light p-5 rounded-2xl shadow-sm">
            <h2 className="text-lg font-semibold text-[#b0125b]">
              How to review requests
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              Pending requests appear first. Use search and filters to narrow
              the list, open View Details to inspect the booking, then submit
              the unit leader decision.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-6">
            <Card
              title="Total Requests Received"
              value={stats.total}
              color="text-blue-600"
            />
            <Card
              title="Pending Review"
              value={stats.pending}
              color="text-yellow-600"
            />
            <Card
              title="Approved"
              value={stats.approved}
              color="text-green-600"
            />
            <Card title="Rejected" value={stats.rejected} color="text-pink-600" />
          </div>

          <div className="bg-[#fafafa] border border-border-light p-6 rounded-2xl shadow-sm space-y-4">
            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <input
              type="text"
              placeholder="Search by user name or request ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] outline-none placeholder:text-gray-400"
            />

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="equipment">Equipment</option>
              <option value="lab">Lab</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

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

          <div className="bg-white rounded-2xl overflow-hidden w-full">
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="sticky top-0 bg-[#f2f2f2] text-gray-600 z-10">
                  <tr>
                    <th className="p-4 text-left">REQUEST ID</th>
                    <th className="p-4 text-left">TYPE</th>
                    <th className="p-4 text-left">USER NAME</th>
                    <th className="p-4 text-left">BOOKING DATE</th>
                    <th className="p-4 text-left">START</th>
                    <th className="p-4 text-left">END</th>
                    <th className="p-4 text-left">Lab / Equipment</th>
                    <th className="p-4 text-left">UNIT LEADER STATUS</th>
                    <th className="p-4 text-left">ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.map((item) => (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="p-4">{item.id}</td>
                      <td className="p-4">{item.type}</td>
                      <td className="p-4">{item.user_name}</td>
                      <td className="p-4">{item.booking_date}</td>
                      <td className="p-4">{formatTime(item.start_time)}</td>
                      <td className="p-4">{formatTime(item.end_time)}</td>
                      <td className="p-4">{item.resource_name}</td>
                      <td className="p-4">
                        <StatusBadge status={item.unit_leader_status} />
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() =>
                            router.push(`/unit-leader/${item.type}/${item.id}`)
                          }
                          className="bg-[#b0125b] text-white px-4 py-2 rounded-lg cursor-pointer hover:opacity-80 transition"
                        >
                          View Details
                        </button>
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

function Card({ title, value, color }) {
  return (
    <div className="bg-[#fafafa] border border-border-light p-6 rounded-2xl shadow-sm">
      <h2 className={`text-3xl font-bold ${color}`}>{value}</h2>
      <p className="text-gray-600 mt-2">{title}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Pending: "bg-yellow-100 text-yellow-600",
    Approved: "bg-green-100 text-green-600",
    Rejected: "bg-red-100 text-red-600",
  };

  return (
    <span
      className={`px-5 py-1.5 rounded-full text-xs font-medium inline-flex items-center justify-center whitespace-nowrap min-w-[140px] ${map[status]}`}
    >
      {status}
    </span>
  );
}
