import { BookingContent } from "@/app/booking/page";

export default async function BookingLabPage({ params }) {
  const { labId } = await params;

  return <BookingContent initialLabId={decodeURIComponent(labId)} />;
}

