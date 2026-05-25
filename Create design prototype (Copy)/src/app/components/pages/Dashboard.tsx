import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

export function Dashboard() {
  const labs = [
    { name: 'Chemistry Lab', location: 'Building A, Floor 2' },
    { name: 'Physics Lab', location: 'Building B, Floor 3' },
    { name: 'Biology Lab', location: 'Building A, Floor 1' },
    { name: 'Electrical Lab', location: 'Building C, Floor 2' },
  ];

  const timeSlots = ['08:00', '09:00', '10:00', '11:00'];

  const schedule = {
    'Chemistry Lab': ['available', 'booked', 'available', 'available'],
    'Physics Lab': ['available', 'available', 'pending', 'available'],
    'Biology Lab': ['booked', 'available', 'available', 'booked'],
    'Electrical Lab': ['available', 'available', 'available', 'available'],
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">Laboratory Booking</div>
          <h1 className="text-[56px] leading-[1.1] font-bold text-[#1a1a1a] mb-4">
            Laboratory<br />
            Resource<br />
            Scheduling
          </h1>
          <p className="text-[14px] text-[#6b6b6b]">View and manage lab availability across the facility</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#A8E6CF]"></div>
            <span className="text-sm text-[#6b6b6b]">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#E6A8C4]"></div>
            <span className="text-sm text-[#6b6b6b]">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#D4A8E6]"></div>
            <span className="text-sm text-[#6b6b6b]">Pending</span>
          </div>
        </div>
      </div>

      <div className="bg-[#FAF8F4] rounded-[28px] p-8 shadow-sm border border-[rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-xl bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#1a1a1a]" />
            </button>
            <h2 className="text-[28px] font-bold text-[#1a1a1a]">Tuesday, Apr 21</h2>
            <button className="w-10 h-10 rounded-xl bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center transition-colors">
              <ChevronRight className="w-5 h-5 text-[#1a1a1a]" />
            </button>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors">
              TODAY
            </button>
            <button className="px-5 py-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors">
              PICK DATE
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left pb-4 pr-6">
                  <div className="text-[11px] tracking-[0.1em] uppercase text-[#6b6b6b] font-semibold">Lab Resource</div>
                </th>
                {timeSlots.map((time) => (
                  <th key={time} className="text-center pb-4 px-3">
                    <div className="text-[13px] font-semibold text-[#1a1a1a]">{time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labs.map((lab, labIndex) => (
                <tr key={labIndex}>
                  <td className="pr-6 py-3">
                    <div>
                      <div className="font-semibold text-[15px] text-[#1a1a1a]">{lab.name}</div>
                      <div className="text-[12px] text-[#6b6b6b]">{lab.location}</div>
                    </div>
                  </td>
                  {schedule[lab.name as keyof typeof schedule].map((status, slotIndex) => (
                    <td key={slotIndex} className="px-3 py-3">
                      <Link
                        to={status === 'available' ? `/reserve?lab=${encodeURIComponent(lab.name)}&date=Tuesday, Apr 21&time=${timeSlots[slotIndex]}` : '#'}
                        className={`block h-16 rounded-xl flex items-center justify-center text-[11px] font-semibold tracking-wide transition-all ${
                          status === 'available'
                            ? 'bg-[#A8E6CF] hover:bg-[#96DFBE] cursor-pointer'
                            : status === 'booked'
                            ? 'bg-[#E6A8C4] cursor-not-allowed'
                            : 'bg-[#D4A8E6] cursor-not-allowed'
                        }`}
                      >
                        {status !== 'available' && <span className="uppercase">{status}</span>}
                      </Link>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
