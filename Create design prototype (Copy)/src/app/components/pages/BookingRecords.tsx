import { Calendar, Clock, ChevronDown, Check, Filter, X } from 'lucide-react';
import { Link } from 'react-router';
import { useState, useRef, useEffect } from 'react';

export function BookingRecords() {
  const [selectedFilter, setSelectedFilter] = useState<string[]>(['all']);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);

  const bookings = [
    {
      id: 1,
      type: 'lab',
      name: 'Chemistry Lab',
      subtitle: 'Laboratory–Building A, Floor 2',
      date: 'Tuesday, April 21, 2026',
      time: '09:00 - 11:00',
      status: 'Pending Approval',
      image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=300&h=200&fit=crop',
    },
    {
      id: 2,
      type: 'lab',
      name: 'Physics Lab',
      subtitle: 'Laboratory–Building B, Floor 3',
      date: 'Wednesday, April 22, 2026',
      time: '14:00 - 16:00',
      status: 'Pending Approval',
      image: 'https://images.unsplash.com/photo-1567427018141-0584cfcbf1b8?w=300&h=200&fit=crop',
    },
    {
      id: 3,
      type: 'equipment',
      name: 'Mass Spectrometer',
      subtitle: 'Equipment–Building A, Room 204',
      date: 'Thursday, April 23, 2026',
      time: '10:00 - 12:00',
      status: 'Approved',
      image: 'https://images.unsplash.com/photo-1581093458791-9d5e4c4a8d1e?w=300&h=200&fit=crop',
    },
    {
      id: 4,
      type: 'equipment',
      name: 'Electron Microscope',
      subtitle: 'Equipment–Building C, Room 201',
      date: 'Friday, April 24, 2026',
      time: '13:00 - 15:00',
      status: 'Pending Approval',
      image: 'https://images.unsplash.com/photo-1530210124550-912dc1381cb8?w=300&h=200&fit=crop',
    },
  ];

  const toggleFilter = (filterId: string) => {
    if (filterId === 'all') {
      setSelectedFilter(['all']);
    } else {
      setSelectedFilter(prev => {
        const withoutAll = prev.filter(id => id !== 'all');
        if (withoutAll.includes(filterId)) {
          const newSelection = withoutAll.filter(id => id !== filterId);
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          return [filterId];
        }
      });
    }
  };

  const getFilterLabel = () => {
    if (selectedFilter.includes('all')) return 'All Bookings';
    if (selectedFilter.includes('lab')) return 'Lab Bookings';
    if (selectedFilter.includes('equipment')) return 'Equipment Bookings';
    return 'All Bookings';
  };

  const filteredBookings = selectedFilter.includes('all')
    ? bookings
    : bookings.filter(booking => selectedFilter.includes(booking.type));

  const handleCancelClick = (booking: any) => {
    setBookingToCancel(booking);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    setCancelModalOpen(false);
    setBookingToCancel(null);
  };

  const handleKeepBooking = () => {
    setCancelModalOpen(false);
    setBookingToCancel(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">Laboratory Booking</div>
        <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a] mb-4">
          Booking Records
        </h1>
        <p className="text-[15px] text-[#6b6b6b] max-w-3xl leading-relaxed mb-6">
          Comprehensive log of institutional lab access and high-precision equipment usage across the Oxford Research complex.
          Filter by status or department for reporting.
        </p>

        <div className="flex items-center gap-3">
          <span className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold">Filter by Type:</span>
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="px-5 py-2.5 rounded-xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-white transition-colors flex items-center gap-3 min-w-[200px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#6b6b6b]" />
                <span>{getFilterLabel()}</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isFilterDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 w-[240px] bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-lg z-50 py-2">
                <button
                  onClick={() => toggleFilter('all')}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedFilter.includes('all') ? 'bg-[#B0005A] border-[#B0005A]' : 'border-[rgba(0,0,0,0.2)]'
                  }`}>
                    {selectedFilter.includes('all') && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="text-[14px] font-semibold text-[#1a1a1a]">All Bookings</span>
                </button>
                <div className="border-t border-[rgba(0,0,0,0.06)] my-2"></div>
                <button
                  onClick={() => toggleFilter('lab')}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedFilter.includes('lab') && !selectedFilter.includes('all')
                      ? 'bg-[#B0005A] border-[#B0005A]'
                      : 'border-[rgba(0,0,0,0.2)]'
                  }`}>
                    {selectedFilter.includes('lab') && !selectedFilter.includes('all') && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <span className="text-[14px] text-[#1a1a1a]">Lab Bookings</span>
                </button>
                <button
                  onClick={() => toggleFilter('equipment')}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedFilter.includes('equipment') && !selectedFilter.includes('all')
                      ? 'bg-[#B0005A] border-[#B0005A]'
                      : 'border-[rgba(0,0,0,0.2)]'
                  }`}>
                    {selectedFilter.includes('equipment') && !selectedFilter.includes('all') && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <span className="text-[14px] text-[#1a1a1a]">Equipment Bookings</span>
                </button>
              </div>
            )}
          </div>
          <span className="text-[13px] text-[#6b6b6b]">
            Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {filteredBookings.map((booking) => (
          <div key={booking.id} className="bg-[#FAF8F4] rounded-[28px] p-8 shadow-sm border border-[rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-6">
              <img
                src={booking.image}
                alt={booking.name}
                className="w-[200px] h-[140px] object-cover rounded-2xl"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="inline-block px-3 py-1 rounded-full bg-[#F4E8F0] text-[#B0005A] text-[10px] font-semibold tracking-wide uppercase">
                    Your Request
                  </div>
                  <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                    booking.type === 'lab' ? 'bg-[#E8D4F0] text-[#8B5A9E]' : 'bg-[#D4E8F0] text-[#5A8B9E]'
                  }`}>
                    {booking.type === 'lab' ? 'LAB' : 'EQUIPMENT'}
                  </div>
                </div>
                <h3 className="text-[24px] font-bold text-[#1a1a1a] mb-1">{booking.name}</h3>
                <p className="text-[14px] text-[#6b6b6b] mb-6">{booking.subtitle}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[14px] text-[#1a1a1a]">
                    <Calendar className="w-4 h-4 text-[#6b6b6b]" />
                    <span>{booking.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[14px] text-[#1a1a1a]">
                    <Clock className="w-4 h-4 text-[#6b6b6b]" />
                    <span>{booking.time}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-4">
                <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase ${
                  booking.status === 'Approved' ? 'bg-[#A8E6CF] text-[#1a1a1a]' : 'bg-[#D4A8E6] text-[#1a1a1a]'
                }`}>
                  {booking.status}
                </div>
                <div className="flex flex-col gap-2">
                  {booking.status === 'Approved' && (
                    <Link
                      to={`/reschedule?type=${booking.type}&name=${encodeURIComponent(booking.name)}`}
                      className="px-6 py-2.5 rounded-xl bg-[#B0005A] text-white text-sm font-semibold hover:bg-[#900048] transition-colors text-center"
                    >
                      Reschedule Date
                    </Link>
                  )}
                  <button
                    onClick={() => handleCancelClick(booking)}
                    className="px-6 py-2.5 rounded-xl bg-white border-2 border-[#D0547B] text-[#D0547B] text-sm font-semibold hover:bg-[#FFF0F5] transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredBookings.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[16px] text-[#6b6b6b]">No bookings found matching your filter.</p>
        </div>
      )}

      {cancelModalOpen && bookingToCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={handleKeepBooking}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-[#F4F0E6] hover:bg-[#E8E4DA] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-[#6b6b6b]" />
            </button>

            <div className="mb-6">
              <h2 className="text-[28px] font-bold text-[#1a1a1a] mb-4">
                {bookingToCancel.status === 'Approved' ? 'Cancel Booking?' : 'Cancel Request?'}
              </h2>
              <p className="text-[15px] text-[#6b6b6b] leading-relaxed">
                {bookingToCancel.status === 'Approved'
                  ? 'This will release your reserved time slot.'
                  : 'This request is still under review. Cancelling it will remove your request.'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleKeepBooking}
                className="flex-1 px-6 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors"
              >
                {bookingToCancel.status === 'Approved' ? 'Keep Booking' : 'Keep Request'}
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 px-6 py-3 rounded-xl bg-[#D0547B] text-white text-sm font-semibold hover:bg-[#B8416A] transition-colors"
              >
                {bookingToCancel.status === 'Approved' ? 'Cancel Booking' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
