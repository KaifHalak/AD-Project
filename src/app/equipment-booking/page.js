"use client";

import { useState } from "react";

import EquipmentList from "./equipment-components/EquipmentList";
import CourseFilter from "./equipment-components/filters/CourseFilter";
import LocationFilter from "./equipment-components/filters/LocationFilter";

export default function EquipmentPage() {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("All Courses");
  const [location, setLocation] = useState("All Locations");

  return (
    <>
      <div className="bg-[#f3eee7] min-h-screen px-10 py-8">
        {/* Page Title */}
        <p className="text-xs tracking-widest text-gray-500 mb-2">
          LABORATORY BOOKING
        </p>

        <h1 className="text-5xl font-bold mb-8">Equipment Catalog</h1>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <input
            placeholder="Search by equipment name or ID..."
            className="flex-1 px-6 py-4 rounded-full border outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <CourseFilter selected={course} setSelected={setCourse} />
          <LocationFilter selected={location} setSelected={setLocation} />
        </div>

        {/* Equipment List */}
        <EquipmentList search={search} course={course} location={location} />
      </div>
    </>
  );
}
