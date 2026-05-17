"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSession } from "@/lib/supabase/auth";
import { formatRmFromUsd } from "@/lib/currency";

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

function formatDateTime(dateTimeValue) {
  if (!dateTimeValue) return "-";

  return new Date(dateTimeValue).toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPrice(value) {
  return value === null || value === undefined ? "-" : formatRmFromUsd(value);
}

export default function ApprovalPage() {
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
  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc",
  });

  const filteredData = data.filter((item) => {
    // Search filter
    const matchesSearch =
      item.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.id).includes(searchTerm);

    // Type filter
    const matchesType = typeFilter === "All" || item.type === typeFilter;

    // Status filter
    const matchesStatus =
      statusFilter === "All" || item.ppmu_status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });
  const sortedData = [...filteredData].sort((left, right) => {
    const leftValue = getSortValue(left, sortConfig.key, "ppmu_status");
    const rightValue = getSortValue(right, sortConfig.key, "ppmu_status");

    if (leftValue < rightValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (leftValue > rightValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  function handleSort(key) {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

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

        const response = await fetch("/api/ppmu", {
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
            responseData?.error || "Could not load PPMU requests.",
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
          setErrorMessage("Server error while loading PPMU requests.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

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
          <div className="bg-[#fafafa] border border-border-light p-5 rounded-2xl shadow-sm">
            <h2 className="text-lg font-semibold text-[#b0125b]">
              How to review requests
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              This dashboard lists bookings already approved by a unit leader.
              Use search and filters to narrow the queue, open View Details to
              inspect the request, then submit the final PPMU decision.
            </p>
          </div>

          {/*CARDS*/}
          <div className="grid grid-cols-4 gap-6">
            <Card
              title="Total Requests Received"
              value={stats.total}
              color="text-blue-600"
            />
            <Card
              title="Pending Final Review"
              value={stats.pending}
              color="text-yellow-600"
            />
            <Card
              title="Final Approved"
              value={stats.approved}
              color="text-green-600"
            />
            <Card
              title="Rejected"
              value={stats.rejected}
              color="text-pink-600"
            />
          </div>

          {/* FILTER */}
          <div className="bg-[#fafafa] border border-border-light p-6 rounded-2xl shadow-sm space-y-4">
            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            {/* SEARCH */}
            <input
              type="text"
              placeholder="Search by user name or request ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] outline-none placeholder:text-gray-400"
            />

            {/* TYPE FILTER */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] cursor-pointer"
            >
              <option value="All">All Types</option>

              <option value="equipment">Equipment</option>

              <option value="lab">Lab</option>
            </select>

            {/* STATUS FILTER */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-3 border border-[#ddd6cc] rounded-xl bg-[#f3efe9] cursor-pointer"
            >
              <option value="All">All Status</option>

              <option value="Pending">Pending</option>

              <option value="Approved">Approved</option>

              <option value="Rejected">Rejected</option>
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
          <div className="bg-white rounded-2xl overflow-hidden w-full">
            {/* SCROLL CONTAINER */}
            <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm min-w-[1350px]">
                {/* STICKY HEADER */}
                <thead className="sticky top-0 bg-[#f2f2f2] text-gray-600 z-10">
                  <tr>
                    <SortableHeader
                      label="REQUEST ID"
                      column="id"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="TYPE"
                      column="type"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="USER NAME"
                      column="user_name"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="REQUEST MADE"
                      column="created_at"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="BOOKING DATE"
                      column="booking_date"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <th className="p-4 text-left">START</th>
                    <th className="p-4 text-left">END</th>
                    <SortableHeader
                      label="ITEM"
                      column="resource_name"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="PRICE"
                      column="total_price"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="UNIT LEADER STATUS"
                      column="unit_leader_status"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="PPMU STATUS"
                      column="status"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <th className="p-4 text-left">ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedData.map((item) => (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="p-4">{item.id}</td>
                      <td className="p-4">{item.type}</td>
                      <td className="p-4">{item.user_name}</td>
                      <td className="p-4">{formatDateTime(item.created_at)}</td>
                      <td className="p-4">{item.booking_date}</td>
                      <td className="p-4">{formatTime(item.start_time)}</td>
                      <td className="p-4">{formatTime(item.end_time)}</td>
                      <td className="p-4">{item.resource_name}</td>
                      <td className="p-4">{formatPrice(item.total_price)}</td>

                      {/* UNIT LEADER */}
                      <td className="p-4">
                        <StatusBadge status={item.unit_leader_status} />
                      </td>

                      {/* PPMU */}
                      <td className="p-4 min-w-[180px]">
                        <StatusBadge status={item.ppmu_status} isFinal />
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
function getSortValue(item, key, statusKey) {
  if (key === "created_at" || key === "booking_date") {
    return new Date(item[key] || 0).getTime();
  }

  if (key === "total_price") {
    return Number(item.total_price || 0);
  }

  if (key === "status") {
    return String(item[statusKey] || "").toLowerCase();
  }

  if (key === "id") {
    return Number(item.id || 0);
  }

  return String(item[key] || "").toLowerCase();
}

function SortableHeader({ label, column, sortConfig, onSort }) {
  const isActive = sortConfig.key === column;
  const indicator = isActive
    ? sortConfig.direction === "asc"
      ? " ▲"
      : " ▼"
    : "";

  return (
    <th
      className="p-4 text-left"
      aria-sort={
        isActive
          ? sortConfig.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="font-semibold uppercase hover:text-[#b0125b]"
      >
        {label}
        {indicator}
      </button>
    </th>
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
