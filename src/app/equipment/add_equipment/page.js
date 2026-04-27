"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

export default function EquipmentPage() {
  const timerRef = useRef(null);
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [course, setCourse] = useState("");
  const [price, setPrice] = useState("");

  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [courseOpen, setCourseOpen] = useState(false);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchLocations = async () => {
        const { data, error } = await supabase
        .from("equipment")
        .select("location");

        if (error) {
        console.error("Error fetching locations:", error);
        return;
        }

        const unique = [
        ...new Set(data.map(i => i.location).filter(Boolean))
        ];

        setLocations(unique);
    };

    fetchLocations();
  }, []);
  useEffect(() => {
  const fetchCourses = async () => {
    const { data } = await supabase
      .from("equipment")
      .select("course");

    const unique = [
      ...new Set(data.map(i => i.course).filter(Boolean))
    ];

    setCourses(unique);
  };

  fetchCourses();
  }, []);

 const handleSubmit = async (e) => {
  e.preventDefault();

  if (!name.trim()) {
    alert("Equipment Name cannot be empty");
    return;
  }

  if (!id.trim()) {
    alert("Equipment ID cannot be empty");
    return;
  }

  if (!description.trim()) {
    alert("Description cannot be empty");
    return;
  }

  if (!location) {
    alert("Location cannot be empty");
    return;
  }

  if (!course) {
    alert("Course cannot be empty");
    return;
  }

  if (!price) {
    alert("Price per hour cannot be empty");
    return;
  }

  const { error } = await supabase.from("equipment").insert([
    {
      id,
      name,
      description,
      location,
      course,
      status: "available",
      price_per_hour: Number(price),
    },
  ]);

  if (error) {
    alert("Error: " + error.message);
    return;
  }

  alert("Equipment added!");
  router.push("/equipment");
 };

  return (
<div className="bg-[#f3eee7] min-h-screen p-10">

  {/* Title */}
  <div className="bg-[#efe8df] p-6 rounded-2xl w-3/4 mx-auto shadow-sm">
    <h1 className="text-4xl font-bold text-center text-gray-800">
      Add New Equipment
    </h1>
  </div>

  {/* FORM */}
  <form
    onSubmit={handleSubmit}
    className="bg-[#efe8df] p-8 rounded-2xl w-3/4 mx-auto mt-8 space-y-6 shadow-md">
    <div className="grid grid-cols-2 gap-6">
      <input
        placeholder="Equipment Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="col-span-2 w-full p-4 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 transition"/>

      <input
        placeholder="Equipment ID"
        value={id}
        onChange={(e) => setId(e.target.value.toUpperCase())}
        className="col-span-2 w-full p-4 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 transition"/>

      <input
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="col-span-2 w-full p-4 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 transition"/>
     
      <div className="col-span-2 grid grid-cols-2 gap-6">
        {/* Location */}
        <div className="relative w-full min-w-0">
            <div
            onClick={() => {
            setOpen(!open);
            setCourseOpen(false);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                    setOpen(false);
            }, 1500);
            }}
            className="w-full min-w-0 p-4 rounded-xl border border-gray-300 bg-white cursor-pointer flex justify-between items-center"
            >
            <span className={location ? "text-black" : "text-gray-400"}>
                {location || "Select Location"}
            </span>
            <span className="ml-2">▼</span>
            </div>

            {open && (
            <div className="absolute w-full bg-white border mt-2 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                {locations.map((l, i) => (
                <div
                    key={i}
                    onClick={() => {
                    setLocation(l);
                    setOpen(false);
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-pink-100"
                >
                    {l}
                </div>
                ))}
            </div>
            )}
        </div>
        {/* Course */}
        <div className="relative w-full min-w-0">
            <div
            onClick={() => {
            setCourseOpen(!courseOpen); 
            setOpen(false);             
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setCourseOpen(false);     
            }, 1000);
            }}
            className="w-full min-w-0 p-4 rounded-xl border border-gray-300 bg-white cursor-pointer flex justify-between items-center"
            >
            <span className={course ? "text-black" : "text-gray-400"}>
                {course || "Select Course"}
            </span>
            <span className="ml-2">▼</span>
            </div>

            {courseOpen && (
            <div className="absolute w-full bg-white border mt-2 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                {courses.map((c, i) => (
                <div
                    key={i}
                    onClick={() => {
                    setCourse(c);
                    setCourseOpen(false);
                    }}
                    className="px-4 py-3 cursor-pointer hover:bg-pink-100"
                >
                    {c}
                </div>
                ))}
            </div>
            )}
        </div>
      </div>
    </div>

    <input
      type="number"
      placeholder="Price per hour"
      value={price}
      onChange={(e) => setPrice(e.target.value)}
      className="p-4 rounded-xl border border-gray-300 bg-white w-full focus:outline-none focus:ring-2 focus:ring-pink-400 transition"/>

    {/*cancel & Save Buttons*/}
    <div className="flex justify-between items-center pt-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-red-500 hover:underline cursor-pointer">
        Cancel
      </button>

      <button
        type="submit"
        className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-8 py-3 rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition cursor-pointer">
        Save Equipment
      </button>
    </div>
  </form>
</div>
  );
}