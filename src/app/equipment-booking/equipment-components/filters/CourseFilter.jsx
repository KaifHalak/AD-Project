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
      const { data } = await supabase
        .from("equipment")
        .select("course");

      const unique = [
        ...new Set(data.map(i => i.course).filter(Boolean))
      ];

      setCourses(unique);
    }

    fetchCourses();
  }, []);

  // 清理 timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative w-60"
      onMouseEnter={() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      }}
      onMouseLeave={() => {
        timerRef.current = setTimeout(() => {
          setOpen(false);
        }, 500); //can adjust 2000
      }}
    >
      
      {/*button*/}
      <div
        onClick={() => setOpen(!open)}
        className="px-5 py-4 rounded-full border cursor-pointer flex justify-between items-center bg-white hover:border-pink-500"
      >
        <span>{selected || "All Courses"}</span>
        <span>▼</span>
      </div>

      {/* dropdown */}
      {open && (
        <div className="absolute mt-2 w-full bg-white border rounded-xl shadow-md z-50 max-h-60 overflow-y-auto">
          
          {/* All */}
          <div
            onClick={() => {
              setSelected(null);
              setOpen(false);
            }}
            className="px-4 py-3 cursor-pointer hover:bg-pink-100"
          >
            All Courses
          </div>

          {/* list */}
          {courses.map((c, i) => (
            <div
              key={i}
              onClick={() => {
                setSelected(c);
                setOpen(false);
              }}
              className="px-4 py-3 cursor-pointer hover:bg-pink-100"
            >
              {c}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}