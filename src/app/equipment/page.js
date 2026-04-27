"use client";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";
import Navbar from "./equipment-components/navbar";
import EquipmentList from "./equipment-components/EquipmentList";
import CourseFilter from "./equipment-components/filters/CourseFilter";
import LocationFilter from "./equipment-components/filters/LocationFilter";
import { useRouter } from "next/navigation";




export default function EquipmentPage() {
  const router = useRouter(); //
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("All Courses");
  const [location, setLocation] = useState("All Locations");
  const [user, setUser] = useState(null);
  const supabase = getSupabaseBrowserClient();
  // get user role
    useEffect(() => {
    const fetchUser = async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData?.user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("email", authData.user.email)
        .single();

      setUser({
        email: authData.user.email,
        role: userData?.role,
      });
    };

    fetchUser();
  }, []);
  
  return (
    <>
      {/*Navbar */}
      <Navbar />

      <div className="bg-[#f3eee7] min-h-screen px-10 py-8">
        {/* Page Title */}
        <p className="text-xs tracking-widest text-gray-500 mb-2">
          LABORATORY BOOKING
        </p>

        {/*Equipment Catalog */} 
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold">
            Equipment Catalog
          </h1>

          {/*only pic show */}
          {user?.role === "pic" && (
            <button 
            onClick={() => router.push("/equipment/add_equipment")}
            className="bg-red-400 text-white px-5 py-3 rounded-xl hover:opacity-80 cursor-pointer">
              + Add Equipment
            </button>
          )}
        </div>

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
        <EquipmentList
          search={search}
          course={course}
          location={location}
        />
      </div>
    </>
  );
}