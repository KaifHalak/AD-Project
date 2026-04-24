"use client";

import { useRouter } from "next/navigation";

export default function EquipmentCard({ item }) {
  const router = useRouter();

  const getStatusStyle = () => {
    switch (item.status) {
      case "available":
        return "bg-green-100 text-green-700";
      case "in_use":
        return "bg-pink-200 text-pink-700";
      case "maintenance":
        return "bg-yellow-200 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-600";
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
  router.push(`/equipment/${item.id}`);
};

  return (
    <div
      onClick={handleBooking} 
      className="bg-[#f8f5f1] rounded-3xl p-6 shadow-sm border border-gray-200 hover:border-pink-400 hover:shadow-md transition cursor-pointer"
    >
      {/*top*/}
      <div className="flex justify-between items-center mb-5">
        <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center text-2xl">
          🔬
        </div>

        <span
          className={`px-4 py-1 text-xs rounded-full font-semibold tracking-wide ${getStatusStyle()}`}
        >
          {getStatusText()}
        </span>
      </div>

      {/*name*/}
      <h2 className="text-xl font-semibold text-gray-800">
        {item.name}
      </h2>

      <p className="text-sm text-gray-400 mb-3">
        ID: {item.id}
      </p>

      {/*description*/}
      <p className="text-gray-600 text-sm mb-4 leading-relaxed">
        {item.description}
      </p>

      {/*info*/}
      <div className="text-sm text-gray-500 space-y-2 mb-4">
        <p className="flex items-center gap-2">
          🎓 {item.course}
        </p>
        <p className="flex items-center gap-2">
          📍 {item.location}
        </p>
      </div>

      <hr className="my-4 border-gray-200" />

      {/*price*/}
      <p className="text-xs text-gray-400 tracking-wide">
        EST. PRICE
      </p>

      <p className="text-pink-600 font-bold text-xl">
        ${item.price_per_hour}/hr
      </p>
    </div>
  );
}