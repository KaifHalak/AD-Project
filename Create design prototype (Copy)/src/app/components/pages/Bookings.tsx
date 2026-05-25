import { ChevronLeft, ChevronRight, Clock, MousePointer2, ChevronDown, Check } from 'lucide-react';
import { Link } from 'react-router';
import { useState, useRef, useEffect } from 'react';

export function Bookings() {
  const [selectedDate, setSelectedDate] = useState('Tuesday, Apr 21');
  const [selectedLabIds, setSelectedLabIds] = useState<string[]>(['all']);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const labs = [
    { id: 'chemistry', name: 'Chemistry Lab', location: 'Building A, Floor 2' },
    { id: 'physics', name: 'Physics Lab', location: 'Building B, Floor 3' },
    { id: 'biology', name: 'Biology Lab', location: 'Building A, Floor 1' },
    { id: 'electrical', name: 'Electrical Lab', location: 'Building C, Floor 2' },
  ];

  const toggleLab = (labId: string) => {
    if (labId === 'all') {
      setSelectedLabIds(['all']);
    } else {
      setSelectedLabIds(prev => {
        const withoutAll = prev.filter(id => id !== 'all');
        if (withoutAll.includes(labId)) {
          const newSelection = withoutAll.filter(id => id !== labId);
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          const newSelection = [...withoutAll, labId];
          return newSelection.length === labs.length ? ['all'] : newSelection;
        }
      });
    }
  };

  const filteredLabs = selectedLabIds.includes('all')
    ? labs
    : labs.filter(lab => selectedLabIds.includes(lab.id));

  const getDropdownLabel = () => {
    if (selectedLabIds.includes('all')) {
      return 'Show All';
    }
    const count = selectedLabIds.length;
    return count === 1 ? labs.find(l => l.id === selectedLabIds[0])?.name : `${count} Labs Selected`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  const schedule: Record<string, Array<{ status: string; bookedBy?: string }>> = {
    chemistry: [
      { status: 'available' },
      { status: 'booked', bookedBy: 'Dr. Smith' },
      { status: 'booked', bookedBy: 'Dr. Smith' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'booked', bookedBy: 'Lab Team' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
    ],
    physics: [
      { status: 'available' },
      { status: 'available' },
      { status: 'pending' },
      { status: 'available' },
      { status: 'available' },
      { status: 'booked', bookedBy: 'Research Group A' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
    ],
    biology: [
      { status: 'booked', bookedBy: 'Dr. Johnson' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'booked', bookedBy: 'Lab Session' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'pending' },
      { status: 'available' },
    ],
    electrical: [
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
      { status: 'available' },
    ],
  };

  const getSlotUrl = (labId: string, lab: string, time: string, status: string) => {
    if (status !== 'available') return '#';
    return `/reserve?lab=${encodeURIComponent(lab)}&date=${encodeURIComponent(selectedDate)}&time=${time}`;
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">Laboratory Booking</div>
            <h1 className="text-[56px] leading-[1.1] font-bold text-[#1a1a1a] mb-4">
              Book a Lab
            </h1>
            <p className="text-[14px] text-[#6b6b6b]">Select an available time slot to start your booking</p>
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

      </div>

      <div className="bg-[#FAF8F4] rounded-[28px] p-8 shadow-sm border border-[rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-xl bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#1a1a1a]" />
            </button>
            <h2 className="text-[28px] font-bold text-[#1a1a1a]">{selectedDate}</h2>
            <button className="w-10 h-10 rounded-xl bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center transition-colors">
              <ChevronRight className="w-5 h-5 text-[#1a1a1a]" />
            </button>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="px-5 py-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors flex items-center gap-2 min-w-[180px] justify-between"
              >
                <span>Labs: {getDropdownLabel()}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full mt-2 right-0 w-[280px] bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-lg z-50 py-2">
                  <button
                    onClick={() => toggleLab('all')}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedLabIds.includes('all')
                        ? 'bg-[#B0005A] border-[#B0005A]'
                        : 'border-[rgba(0,0,0,0.2)]'
                    }`}>
                      {selectedLabIds.includes('all') && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="text-[14px] font-semibold text-[#1a1a1a]">Show All</span>
                  </button>
                  <div className="border-t border-[rgba(0,0,0,0.06)] my-2"></div>
                  {labs.map((lab) => (
                    <button
                      key={lab.id}
                      onClick={() => toggleLab(lab.id)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedLabIds.includes(lab.id) && !selectedLabIds.includes('all')
                          ? 'bg-[#B0005A] border-[#B0005A]'
                          : 'border-[rgba(0,0,0,0.2)]'
                      }`}>
                        {selectedLabIds.includes(lab.id) && !selectedLabIds.includes('all') && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-[#1a1a1a]">{lab.name}</div>
                        <div className="text-[11px] text-[#6b6b6b]">{lab.location}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="px-5 py-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors">
              TODAY
            </button>
            <button className="px-5 py-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors">
              PICK DATE
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left pb-4 pr-6 sticky left-0 bg-[#FAF8F4] z-10">
                  <div className="text-[11px] tracking-[0.1em] uppercase text-[#6b6b6b] font-semibold">Lab Resource</div>
                </th>
                {timeSlots.map((time) => (
                  <th key={time} className="text-center pb-4 px-2 min-w-[100px]">
                    <div className="text-[13px] font-semibold text-[#1a1a1a]">{time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLabs.map((lab) => (
                <tr key={lab.id} className="border-t border-[rgba(0,0,0,0.04)]">
                  <td className="pr-6 py-4 sticky left-0 bg-[#FAF8F4] z-10">
                    <div>
                      <div className="font-semibold text-[15px] text-[#1a1a1a]">{lab.name}</div>
                      <div className="text-[12px] text-[#6b6b6b]">{lab.location}</div>
                    </div>
                  </td>
                  {schedule[lab.id].map((slot, slotIndex) => {
                    const time = timeSlots[slotIndex];
                    const isAvailable = slot.status === 'available';
                    const isBooked = slot.status === 'booked';
                    const isPending = slot.status === 'pending';

                    if (isAvailable) {
                      return (
                        <td key={slotIndex} className="px-2 py-4">
                          <Link
                            to={getSlotUrl(lab.id, lab.name, time, slot.status)}
                            className="group block h-20 rounded-xl bg-gradient-to-br from-[#A8E6CF] to-[#96DFBE] hover:from-[#96DFBE] hover:to-[#84D4AC] hover:shadow-lg hover:scale-105 transition-all duration-200 relative overflow-hidden border-2 border-transparent hover:border-[#84D4AC]"
                          >
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <MousePointer2 className="w-5 h-5 text-[#1a1a1a] mb-1 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-bold text-[#1a1a1a] tracking-wider">CLICK TO BOOK</span>
                            </div>
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                          </Link>
                        </td>
                      );
                    }

                    return (
                      <td key={slotIndex} className="px-2 py-4">
                        <div
                          className={`h-20 rounded-xl flex flex-col items-center justify-center text-center px-2 ${
                            isBooked
                              ? 'bg-[#E6A8C4] cursor-not-allowed'
                              : 'bg-[#D4A8E6] cursor-not-allowed'
                          }`}
                          title={slot.bookedBy || 'Pending request'}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1a1a1a]">
                            {slot.status}
                          </span>
                          {slot.bookedBy && (
                            <span className="text-[9px] text-[#6b6b6b] mt-1 line-clamp-2">
                              {slot.bookedBy}
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[9px] text-[#6b6b6b] mt-1">
                              Awaiting approval
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 pt-6 border-t border-[rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-3 text-[13px] text-[#6b6b6b]">
            <div className="w-5 h-5 rounded bg-[#F4E8F0] flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[#B0005A] text-xs">💡</span>
            </div>
            <p>
              <strong className="text-[#1a1a1a]">How to book:</strong> Click any available (green) time slot to start your booking.
              You'll be able to select equipment, set duration, and add details on the next page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
