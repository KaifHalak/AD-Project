import { ArrowLeft, Calendar, Clock, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, MousePointer2, Key } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function ReserveEquipment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefilledEquipmentId = searchParams.get('id') || '';
  const prefilledEquipmentName = searchParams.get('name') || '';

  const [selectedEquipment] = useState(prefilledEquipmentName || 'Mass Spectrometer');
  const [selectedDate, setSelectedDate] = useState('Tuesday, Apr 21');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [validationStatus, setValidationStatus] = useState<'valid' | 'conflict' | 'pending' | 'invalid' | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [token, setToken] = useState('');

  const availability = [
    { start: '08:00', end: '09:00', status: 'booked', bookedBy: 'Dr. Smith' },
    { start: '09:00', end: '11:00', status: 'available' },
    { start: '11:00', end: '13:00', status: 'available' },
    { start: '13:00', end: '14:00', status: 'pending' },
    { start: '14:00', end: '17:00', status: 'available' },
    { start: '17:00', end: '18:00', status: 'booked', bookedBy: 'Lab Team' },
  ];

  const suggestedSlots = [
    { start: '09:00', end: '11:00', duration: '2h' },
    { start: '11:00', end: '13:00', duration: '2h' },
    { start: '14:00', end: '16:00', duration: '2h' },
    { start: '15:00', end: '17:00', duration: '2h' },
  ];

  const validStartTimes = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const validEndTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const validateTimeSlot = () => {
    if (startTime >= endTime) {
      setValidationStatus('invalid');
      setValidationMessage('End time must be after start time');
      return;
    }

    const conflict = availability.find((slot) => {
      const slotStart = slot.start;
      const slotEnd = slot.end;
      const hasOverlap = !(endTime <= slotStart || startTime >= slotEnd);
      return hasOverlap && slot.status !== 'available';
    });

    if (conflict) {
      if (conflict.status === 'booked') {
        setValidationStatus('conflict');
        setValidationMessage(`This slot conflicts with an existing booking${conflict.bookedBy ? ` by ${conflict.bookedBy}` : ''}`);
      } else if (conflict.status === 'pending') {
        setValidationStatus('pending');
        setValidationMessage('This slot is currently requested by another user and awaiting approval');
      }
      return;
    }

    setValidationStatus('valid');
    setValidationMessage('Slot is available');
  };

  useEffect(() => {
    validateTimeSlot();
  }, [startTime, endTime, selectedDate]);

  const duration = calculateDuration(startTime, endTime);
  const totalPrice = '$120.00';

  const canSubmit = validationStatus === 'valid' && token.trim() !== '';

  return (
    <div>
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">Equipment Booking</div>
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/equipment')} className="text-[#6b6b6b] hover:text-[#1a1a1a]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a]">
            Reserve Equipment
          </h1>
        </div>
      </div>

      <div className="max-w-5xl">
        <div className="space-y-12">
          <section>
            <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-4">01 Equipment</h2>
            <div className="bg-[#FAF8F4] rounded-2xl p-6 border border-[rgba(0,0,0,0.04)]">
              <p className="text-[20px] font-bold text-[#1a1a1a]">{selectedEquipment}</p>
              {prefilledEquipmentId && (
                <p className="text-[12px] text-[#6b6b6b] mt-1">ID: {prefilledEquipmentId}</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">02 Availability Preview</h2>
            <div className="bg-[#FAF8F4] rounded-2xl p-8 border border-[rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button className="w-10 h-10 rounded-xl bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center transition-colors">
                    <ChevronLeft className="w-5 h-5 text-[#1a1a1a]" />
                  </button>
                  <h3 className="text-[28px] font-bold text-[#1a1a1a]">{selectedDate}</h3>
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
                <div className="min-w-max">
                  <div className="grid grid-cols-[200px_repeat(10,120px)] gap-3 mb-4">
                    <div className="text-[11px] tracking-[0.1em] uppercase text-[#6b6b6b] font-semibold">Equipment</div>
                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => (
                      <div key={time} className="text-center text-[13px] font-semibold text-[#1a1a1a]">
                        {time}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-[200px_repeat(10,120px)] gap-3 items-center">
                      <div>
                        <div className="font-semibold text-[15px] text-[#1a1a1a]">{selectedEquipment}</div>
                        <div className="text-[12px] text-[#6b6b6b]">Building A, Room 204</div>
                      </div>

                      {[
                        { status: 'booked', user: 'Dr. Smith' },
                        { status: 'available' },
                        { status: 'available' },
                        { status: 'available' },
                        { status: 'booked', user: 'Lab Team' },
                        { status: 'pending' },
                        { status: 'available' },
                        { status: 'available' },
                        { status: 'available' },
                        { status: 'booked', user: 'Research' },
                      ].map((slot, index) => {
                        const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
                        const time = timeSlots[index];

                        if (slot.status === 'available') {
                          return (
                            <button
                              key={index}
                              onClick={() => setStartTime(time)}
                              className="h-24 rounded-2xl bg-[#A8E6CF] hover:bg-[#96DFBE] hover:shadow-lg hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-[#84D4AC]"
                            >
                            </button>
                          );
                        }

                        return (
                          <div
                            key={index}
                            className={`h-24 rounded-2xl flex flex-col items-center justify-center text-center px-2 ${
                              slot.status === 'booked'
                                ? 'bg-[#E6A8C4]'
                                : 'bg-[#D4A8E6]'
                            }`}
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1a1a1a]">
                              {slot.status}
                            </span>
                            {slot.user && (
                              <span className="text-[9px] text-[#6b6b6b] mt-1">
                                {slot.user}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">03 Date & Time Selection</h2>
            <div className="bg-[#FAF8F4] rounded-2xl p-8 border border-[rgba(0,0,0,0.04)]">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                    <input
                      type="text"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">Duration</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                    <input
                      type="text"
                      value={duration}
                      readOnly
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.06)] text-[14px] text-[#6b6b6b]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">Start Time</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                  >
                    {validStartTimes.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">End Time</label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                  >
                    {validEndTimes.filter(t => t > startTime).map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-3">Suggested Slots</h3>
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="flex gap-3 min-w-max">
                    {suggestedSlots.map((slot, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setStartTime(slot.start);
                          setEndTime(slot.end);
                        }}
                        className="flex-shrink-0 w-[180px] flex flex-col items-start p-4 rounded-xl bg-white hover:bg-[#F4E8F0] hover:border-[#B0005A] border border-[rgba(0,0,0,0.06)] transition-all"
                      >
                        <div className="text-[14px] font-semibold text-[#1a1a1a] mb-1">{slot.start} – {slot.end}</div>
                        <div className="text-[11px] text-[#6b6b6b] mb-2">{slot.duration}</div>
                        <div className="text-[#B0005A] text-[10px] font-semibold tracking-wide">QUICK SELECT</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {validationStatus && (
                <div className={`px-4 py-3 rounded-xl flex items-center gap-3 ${
                  validationStatus === 'valid' ? 'bg-[#A8E6CF]' :
                  validationStatus === 'pending' ? 'bg-[#D4A8E6]' :
                  'bg-[#FFF0F5]'
                }`}>
                  {validationStatus === 'valid' ? (
                    <CheckCircle className="w-5 h-5 text-[#1a1a1a]" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[#1a1a1a]" />
                  )}
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">{validationMessage}</span>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">04 Usage Context</h2>
            <textarea
              placeholder="Briefly describe research objective or usage purpose..."
              rows={6}
              className="w-full px-6 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20 resize-none"
            />
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-4">05 Billing</h2>
            <div className="bg-[#FAF8F4] rounded-2xl p-6 border border-[rgba(0,0,0,0.04)]">
              <p className="text-[14px] text-[#6b6b6b]">Payment will be processed once the request has been approved.</p>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">06 Authorization Token</h2>
            <div className="bg-[#FAF8F4] rounded-2xl p-8 border border-[rgba(0,0,0,0.04)]">
              <p className="text-[14px] text-[#6b6b6b] mb-4">Please enter your authorization token to complete the booking.</p>
              <div className="relative max-w-md">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6b6b]" />
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your token"
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="flex items-center justify-between pt-8 mt-12 border-t border-[rgba(0,0,0,0.06)]">
        <div>
          <div className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-1">Est. Total</div>
          <div className="text-[36px] font-bold text-[#B0005A]">{totalPrice}</div>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-[#6b6b6b] mb-4">24h cancellation policy applies</p>
          <button
            onClick={() => canSubmit && navigate('/booking-records')}
            disabled={!canSubmit}
            className={`px-12 py-4 rounded-full font-semibold transition-colors shadow-lg text-[16px] ${
              canSubmit
                ? 'bg-[#B0005A] text-white hover:bg-[#900048]'
                : 'bg-[#E8E4DA] text-[#6b6b6b] cursor-not-allowed'
            }`}
          >
            {canSubmit ? 'Confirm Booking' : 'Cannot Book - Conflict'}
          </button>
        </div>
      </div>
    </div>
  );
}
