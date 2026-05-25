import { ArrowLeft, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function ModifyEquipment() {
  const navigate = useNavigate();
  const [selectedEquipment, setSelectedEquipment] = useState('Confocal Microscope');

  const equipment = [
    { name: 'Confocal Microscope', model: 'Zeiss LSM 880', status: 'available' },
    { name: 'DNA Sequencer', model: 'Illumina MiSeq', status: 'available' },
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
          <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-6">Modify Equipment</h2>

          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search other equipment..."
                className="w-full pl-6 pr-12 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
              />
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6b6b]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {equipment.map((item) => (
              <button
                key={item.name}
                onClick={() => setSelectedEquipment(item.name)}
                className={`relative p-6 rounded-2xl text-left transition-all ${
                  selectedEquipment === item.name
                    ? 'bg-[#FAF8F4] border-2 border-[#B0005A] shadow-sm'
                    : 'bg-[#FAF8F4] border-2 border-transparent hover:border-[rgba(176,0,90,0.3)]'
                }`}
              >
                <h3 className="font-bold text-[18px] text-[#1a1a1a] mb-1">{item.name}</h3>
                <p className="text-[14px] text-[#6b6b6b] mb-4">{item.model}</p>
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#A8E6CF] text-[#1a1a1a] text-[11px] font-semibold uppercase">
                  {item.status}
                </span>
                {selectedEquipment === item.name && (
                  <div className="absolute top-6 right-6 w-6 h-6 rounded-full bg-[#B0005A] flex items-center justify-center">
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
                          i === 22 ? 'bg-[#B0005A] text-white' : 'bg-white text-[#1a1a1a]'
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
                    <option>14:00</option>
                    <option>15:00</option>
                    <option>16:00</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">End Time</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20">
                    <option>16:00</option>
                    <option>17:00</option>
                    <option>18:00</option>
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
