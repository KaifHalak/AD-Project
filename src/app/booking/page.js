"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/loader";
import { getCurrentSession } from "@/lib/supabase/auth";

export default function BookingPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function redirectToEquipmentBooking() {
      const { data: sessionData } = await getCurrentSession();

      if (!isMounted) {
        return;
      }

      if (!sessionData?.session) {
        router.replace("/");
        return;
      }

      router.replace("/equipment-booking");
    }

    redirectToEquipmentBooking();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return <Loader text="Opening equipment booking..." />;
}
