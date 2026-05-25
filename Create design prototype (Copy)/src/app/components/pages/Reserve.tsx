import { ArrowLeft, Search, CreditCard, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function Reserve() {
  const navigate = useNavigate();
  const [selectedLab, setSelectedLab] = useState('Chemistry Lab');
  const [selectedEquipment, setSelectedEquipment] = useState('Confocal Microscope XI-400');
  const [selectedPayment, setSelectedPayment] = useState('Online Payment');
  const [equipmentEnabled, setEquipmentEnabled] = useState(true);

  const labs = [
    { name: 'Chemistry Lab', location: 'Building A, Floor 2', price: '$45.00' },
    { name: 'Physics Lab', location: 'Building B, Floor 3', price: '$50.00' },
    { name: 'Biology Lab', location: 'Building A, Floor 1', price: '$40.00' },
  ];

  const equipment = [
    { name: 'Confocal Microscope XI-400', location: 'Room 204', price: '$30.00' },
    { name: 'Illumina DNA Sequencer', location: 'Room 308', price: '$55.00' },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">Laboratory Booking</div>
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/')} className="text-[#6b6b6b] hover:text-[#1a1a1a]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a]">
            Resource Reservation
          </h1>
        </div>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">01 Laboratory Selection</h2>
          <div className="grid grid-cols-3 gap-6">
            {labs.map((lab) => (
              <button
                key={lab.name}
                onClick={() => setSelectedLab(lab.name)}
                className={`p-6 rounded-2xl text-left transition-all ${
                  selectedLab === lab.name
                    ? 'bg-[#FAF8F4] border-2 border-[#B0005A] shadow-sm'
                    : 'bg-[#FAF8F4] border-2 border-transparent hover:border-[rgba(176,0,90,0.3)]'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#F4E8F0] flex items-center justify-center mb-4">
                  <div className="w-6 h-6 rounded bg-[#B0005A]"></div>
                </div>
                <h3 className="font-bold text-[16px] text-[#1a1a1a] mb-1">{lab.name}</h3>
                <p className="text-[13px] text-[#6b6b6b] mb-3">{lab.location}</p>
                <p className="text-[18px] font-bold text-[#B0005A]">{lab.price}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold">02 Equipment Selection</h2>
            <label className="flex items-center gap-2 text-[11px] tracking-[0.08em] uppercase text-[#6b6b6b] font-medium">
              <input
                type="checkbox"
                checked={equipmentEnabled}
                onChange={(e) => setEquipmentEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-[rgba(0,0,0,0.2)] text-[#B0005A] focus:ring-[#B0005A]/20"
              />
              Is it necessary to use equipment? (Optional)
            </label>
          </div>
          {equipmentEnabled && (
            <>
              <div className="grid grid-cols-2 gap-6 mb-6">
                {equipment.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedEquipment(item.name)}
                    className={`p-6 rounded-2xl text-left transition-all ${
                      selectedEquipment === item.name
                        ? 'bg-[#FAF8F4] border-2 border-[#B0005A] shadow-sm'
                        : 'bg-[#FAF8F4] border-2 border-transparent hover:border-[rgba(176,0,90,0.3)]'
                    }`}
                  >
                    <h3 className="font-bold text-[16px] text-[#1a1a1a] mb-1">{item.name}</h3>
                    <p className="text-[13px] text-[#6b6b6b] mb-3">{item.location}</p>
                    <p className="text-[18px] font-bold text-[#B0005A]">{item.price}</p>
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search other equipment..."
                  className="w-full pl-6 pr-12 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                />
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6b6b]" />
              </div>
            </>
          )}
        </section>

        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">03 Date & Time Allocation</h2>
          <div className="bg-[#FAF8F4] rounded-2xl p-8 grid grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <button className="w-8 h-8 rounded-lg bg-white hover:bg-[#F4F0E6] border border-[rgba(0,0,0,0.06)] flex items-center justify-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="font-bold text-[16px]">Apr 2026</h3>
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
            <div>
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
                <div className="mt-6 px-4 py-3 rounded-xl bg-[#A8E6CF] text-center">
                  <span className="text-[12px] font-semibold text-[#1a1a1a] uppercase tracking-wide">Slot Available</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">04 Usage Context</h2>
          <textarea
            placeholder="Briefly describe research objective..."
            rows={6}
            className="w-full px-6 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20 resize-none"
          />
        </section>

        <section>
          <h2 className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] font-semibold mb-6">05 Billing</h2>
          <div className="grid grid-cols-2 gap-6">
            <button
              onClick={() => setSelectedPayment('Online Payment')}
              className={`p-6 rounded-2xl flex items-center gap-4 transition-all ${
                selectedPayment === 'Online Payment'
                  ? 'bg-[#FAF8F4] border-2 border-[#B0005A] shadow-sm'
                  : 'bg-[#FAF8F4] border-2 border-transparent hover:border-[rgba(176,0,90,0.3)]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#F4E8F0] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-[#B0005A]" />
              </div>
              <span className="font-semibold text-[16px] text-[#1a1a1a]">Online Payment</span>
            </button>
            <button
              onClick={() => setSelectedPayment('Account Grant')}
              className={`p-6 rounded-2xl flex items-center gap-4 transition-all ${
                selectedPayment === 'Account Grant'
                  ? 'bg-[#FAF8F4] border-2 border-[#B0005A] shadow-sm'
                  : 'bg-[#FAF8F4] border-2 border-transparent hover:border-[rgba(176,0,90,0.3)]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#F4E8F0] flex items-center justify-center">
                <Wallet className="w-6 h-6 text-[#B0005A]" />
              </div>
              <span className="font-semibold text-[16px] text-[#1a1a1a]">Account Grant</span>
            </button>
          </div>
        </section>

        <div className="flex items-center justify-between pt-6 border-t border-[rgba(0,0,0,0.06)]">
          <div>
            <div className="text-[11px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-1">Est. Total</div>
            <div className="text-[36px] font-bold text-[#B0005A]">$85.00</div>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-[#6b6b6b] mb-4">24h cancellation policy applies</p>
            <button
              onClick={() => navigate('/booking-records')}
              className="px-12 py-4 rounded-full bg-[#B0005A] text-white font-semibold hover:bg-[#900048] transition-colors shadow-lg text-[16px]"
            >
              Confirm Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
