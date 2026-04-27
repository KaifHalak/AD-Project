"use client";

import { useRouter } from "next/navigation";

export default function EquipmentCard({ item }) {
  const router = useRouter();

  const getStatusStyle = () => {
    switch (item.status) {
      case "available":
        return "border-green-200 bg-green-50 text-green-700";
      case "in_use":
        return "border-primary/20 bg-white text-primary";
      case "maintenance":
        return "border-yellow-200 bg-yellow-50 text-yellow-700";
      default:
        return "border-border-light bg-white text-text-muted";
    }
  };

  const getStatusText = () => {
    switch (item.status) {
      case "available":
        return "AVAILABLE";
      case "in_use":
        return "IN USE";
      case "maintenance":
        return "MAINTENANCE";
      default:
        return item.status;
    }
  };

  const handleBooking = () => {
    router.push(`/equipment-booking/${item.id}`);
  };

  return (
    <button
      type="button"
      onClick={handleBooking}
      className="h-full rounded-xl border border-border-light bg-white p-4 text-left transition-colors hover:border-primary focus:border-primary focus:outline-none md:p-5"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/10 bg-background-main text-2xl">
          🔬
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle()}`}
        >
          {getStatusText()}
        </span>
      </div>

      <h2 className="text-xl font-semibold text-text-main">{item.name}</h2>

      <p className="mb-3 text-sm text-text-muted">ID: {item.id}</p>

      <p className="mb-4 text-sm leading-relaxed text-text-muted">
        {item.description}
      </p>

      <div className="mb-4 space-y-2 text-sm text-text-muted">
        <p className="flex items-center gap-2">
          <span aria-hidden="true">🎓</span>
          {item.course || "-"}
        </p>
        <p className="flex items-center gap-2">
          <span aria-hidden="true">📍</span>
          {item.location || "-"}
        </p>
      </div>

      <hr className="my-4 border-border-light" />

      <p className="text-xs font-semibold tracking-wide text-text-muted">
        EST. PRICE
      </p>

      <p className="text-xl font-semibold text-primary">
        ${item.price_per_hour}/hr
      </p>
    </button>
  );
}
