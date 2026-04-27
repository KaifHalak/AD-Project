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
      const { data, error } = await supabase.from("equipment").select("*");

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

  if (loading) {
    return (
      <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
        Loading equipment...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Showing {filtered.length} equipment item(s)
      </p>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-border-light bg-white px-3 py-4 text-sm text-text-muted">
          No equipment found.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <EquipmentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
