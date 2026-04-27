"use client";

import { useEffect, useState, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

export default function CourseFilter({ selected, setSelected }) {
  const [courses, setCourses] = useState([]);
  const [open, setOpen] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchCourses() {
      const { data } = await supabase.from("equipment").select("course");

      const unique = [
        ...new Set((data || []).map((item) => item.course).filter(Boolean)),
      ];

      setCourses(unique);
    }

    fetchCourses();
  }, []);

  // Clear delayed close timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full md:w-60"
      onMouseEnter={() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      }}
      onMouseLeave={() => {
        timerRef.current = setTimeout(() => {
          setOpen(false);
        }, 500);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border-light bg-white px-3 text-left text-sm text-text-main outline-none transition-colors hover:border-primary focus:border-primary"
      >
        <span>{selected || "All Courses"}</span>
        <span className="text-xs text-text-muted">▼</span>
      </button>

      {/* dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-border-light bg-white shadow-sm">
          <button
            type="button"
            onClick={() => {
              setSelected("All Courses");
              setOpen(false);
            }}
            className="w-full px-4 py-3 text-left text-sm text-text-main transition-colors hover:bg-background-main hover:text-primary"
          >
            All Courses
          </button>

          {courses.map((course) => (
            <button
              type="button"
              key={course}
              onClick={() => {
                setSelected(course);
                setOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-text-main transition-colors hover:bg-background-main hover:text-primary"
            >
              {course}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
