"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabaseClient";

export default function Navbar() {
  const router = useRouter();

  const [username, setUsername] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchUsername() {
      // get crrent user session
      const { data: sessionData } = await supabase.auth.getSession();

      const email = sessionData?.session?.user?.email;

      if (!email) return;

      // fetch username by email
      const { data, error } = await supabase
        .from("users")
        .select("username")
        .eq("email", email)
        .single();

      if (data) {
        setUsername(data.username);
      }
    }

    fetchUsername();
  }, []);

  return (
    <div className="flex justify-between items-center px-10 py-4 bg-[#f3eee7] border-b">
      
      {/* left */}
      <div className="flex items-center gap-3">
        <div className="bg-pink-600 text-white p-2 rounded-lg">🧪</div>
        <div>
          <p className="font-semibold">Scholarly Lab</p>
          <p className="text-xs text-gray-500">CORE FACILITY</p>
        </div>
      </div>

      {/* mid */}
      <div className="flex gap-8 text-gray-600">
        
        <button
          onClick={() => router.push("/equipment")}
          className="cursor-pointer hover:text-pink-600"
        >
          Equipment
        </button>

        <button
          onClick={() => router.push("/booking")}
          className="cursor-pointer hover:text-pink-600"
        >
          Book a Lab
        </button>

        <button
          onClick={() => router.push("/records")}
          className="cursor-pointer hover:text-pink-600"
        >
          Booking Records
        </button>

      </div>

      {/* right */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-pink-200 flex items-center justify-center">
          👤
        </div>

        {/* username */}
        <span>{username || "User Name"}</span>
      </div>
    </div>
  );
}