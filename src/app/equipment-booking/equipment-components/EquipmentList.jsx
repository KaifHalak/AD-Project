"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import EquipmentCard from "./EquipmentCard";

export default function EquipmentList({ search, course, location }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchData() {
      const { data, error } = await supabase
        .from("equipment")
        .select("*");

      if (error) {
        console.error(error);
      } else {
        setData(data || []);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const keyword = search?.toLowerCase() || "";

  const filtered = data.filter((item) => {
    const matchSearch =
      item.name?.toLowerCase().includes(keyword) ||
      item.id?.toLowerCase().includes(keyword);

    const matchCourse =
      !course || course === "All Courses" || item.course === course;

    const matchLocation =
      !location || location === "All Locations" || item.location === location;

    return matchSearch && matchCourse && matchLocation;
  });

  if (loading) return <p>Loading equipments...</p>;

  return (
    <div>
      <p className="text-gray-500 mb-4">
        Showing {filtered.length} equipments
      </p>

      {/* No results message */}
      {filtered.length === 0 && (
        <p className="text-gray-400">No equipment found</p>
      )}

      <div className="grid grid-cols-3 gap-6">
        {filtered.map((item) => (
          <EquipmentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}