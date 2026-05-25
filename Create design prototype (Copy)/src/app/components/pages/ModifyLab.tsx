import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function ModifyLab() {
  const navigate = useNavigate();
  const [selectedLab, setSelectedLab] = useState('Chemistry Lab');

  const labs = [
    { name: 'Biology Lab', location: 'Building A, Floor 1', image: 'https://images.unsplash.com/photo-1582719471137-c3967ffb9d42?w=300&h=200&fit=crop' },
    { name: 'Chemistry Lab', location: 'Building A, Floor 2', image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=300&h=200&fit=crop' },
    { name: 'Physics Lab', location: 'Building B, Floor 3', image: 'https://images.unsplash.com/photo-1567427018141-0584cfcbf1b8?w=300&h=200&fit=crop' },
    { name: 'Electrical Lab', location: 'Building C, Floor 2', image: 'https://images.unsplash.com/photo-1581093458791-9d5e4c4a8d1e?w=300&h=200&fit=crop' },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/booking-records')} className="text-[#6b6b6b] hover:text-[#1a1a1a]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a]">
            Modify Your Reservation
          </h1>
        </div>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-6">Modify Laboratory</h2>
          <div className="grid grid-cols-4 gap-4">
            {labs.map((lab) => (
              <button
                key={lab.name}
                onClick={() => setSelectedLab(lab.name)}
                className={`relative rounded-2xl overflow-hidden transition-all ${
                  selectedLab === lab.name
                    ? 'ring-4 ring-[#B0005A] shadow-lg'
                    : 'ring-2 ring-transparent hover:ring-[rgba(176,0,90,0.3)]'
                }`}
              >
                <img src={lab.image} alt={lab.name} className="w-full h-32 object-cover" />
                <div className="p-4 bg-[#FAF8F4] text-left">
                  <h3 className="font-semibold text-[14px] text-[#1a1a1a]">{lab.name}</h3>
                  <p className="text-[12px] text-[#6b6b6b]">{lab.location}</p>
                </div>
                {selectedLab === lab.name && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#B0005A] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="bg-[#FAF8F4] rounded-[28px] p-8 shadow-sm border border-[rgba(0,0,0,0.04)]">
            <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-8">Select a new date and time window</h2>

            <div className="grid grid-cols-[2fr,1fr] gap-8 mb-8">
              <div>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <button className="w-8 h-8 rounded-lg bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex gap-3">
                      <select className="px-4 py-2 rounded-lg bg-white border border-[rgba(0,0,0,0.06)] text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20">
                        <option>April</option>
                        <option>May</option>
                        <option>June</option>
                      </select>
                      <select className="px-4 py-2 rounded-lg bg-white border border-[rgba(0,0,0,0.06)] text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20">
                        <option>2026</option>
                        <option>2027</option>
                      </select>
                    </div>
                    <button className="w-8 h-8 rounded-lg bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="text-center text-[11px] font-semibold text-[#6b6b6b] mb-2">{day}</div>
                    ))}
                    {Array.from({ length: 30 }, (_, i) => (
                      <button
                        key={i}
                        className={`aspect-square rounded-lg text-[13px] hover:bg-[#F4E8F0] transition-colors ${
                          i === 20 ? 'bg-[#B0005A] text-white' : 'bg-white text-[#1a1a1a]'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">Start Time</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20">
                    <option>09:00</option>
                    <option>10:00</option>
                    <option>11:00</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">End Time</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20">
                    <option>11:00</option>
                    <option>12:00</option>
                    <option>13:00</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-3 font-semibold">Reason for Modification</label>
              <textarea
                placeholder="Briefly explain the adjustment for the peer-review audit trail..."
                rows={4}
                className="w-full px-6 py-4 rounded-2xl bg-white border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20 resize-none"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between pt-6">
          <button className="px-8 py-3 rounded-xl border-2 border-[#D0547B] text-[#D0547B] font-semibold hover:bg-[#FFF0F5] transition-colors">
            Cancel Reservation
          </button>
          <button
            onClick={() => navigate('/booking-records')}
            className="px-12 py-4 rounded-full bg-[#B0005A] text-white font-semibold hover:bg-[#900048] transition-colors shadow-lg text-[16px]"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
