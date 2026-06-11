import { BookingContent } from "@/app/booking/page";

export default async function BookingEquipmentPage({ params }) {
  const { labId, equipmentId } = await params;

  return (
    <BookingContent
      initialLabId={decodeURIComponent(labId)}
      initialEquipmentId={decodeURIComponent(equipmentId)}
    />
  );
}

