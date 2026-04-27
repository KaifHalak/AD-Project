"use client";

import { useState } from "react";

import EquipmentList from "./equipment-components/EquipmentList";
import CourseFilter from "./equipment-components/filters/CourseFilter";
import LocationFilter from "./equipment-components/filters/LocationFilter";
import { Input } from "@/components/ui/input";

export default function EquipmentPage() {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("All Courses");
  const [location, setLocation] = useState("All Locations");

  return (
    <main className="min-h-full bg-background-main px-3 py-4 md:px-6 md:py-6">
      <section className="min-h-[calc(100vh-7rem)] w-full rounded-2xl border border-border-light bg-background-main p-5 md:p-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-primary">
              Equipment Catalog
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Browse and filter available laboratory equipment.
            </p>
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input
                type="search"
                aria-label="Search equipment"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="md:min-w-80"
                placeholder="Search by equipment name or ID..."
              />

              <CourseFilter selected={course} setSelected={setCourse} />
              <LocationFilter selected={location} setSelected={setLocation} />
            </div>
          </div>

          <EquipmentList search={search} course={course} location={location} />
        </div>
      </section>
    </main>
  );
}
