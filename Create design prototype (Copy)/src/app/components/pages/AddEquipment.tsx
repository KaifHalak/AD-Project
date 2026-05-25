import { Upload, Microscope } from 'lucide-react';
import { useNavigate } from 'react-router';

export function AddEquipment() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">Laboratory Booking</div>
        <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a]">
          Add New Equipment
        </h1>
      </div>

      <div className="grid grid-cols-[2fr,1fr] gap-8">
        <div className="bg-[#FAF8F4] rounded-[28px] p-8 shadow-sm border border-[rgba(0,0,0,0.04)]">
          <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-6">Equipment Information</h2>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Equipment Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mass Spectrometer"
                  className="w-full px-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.05)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Model / Serial Number
                </label>
                <input
                  type="text"
                  placeholder="e.g., MS-A4521"
                  className="w-full px-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.05)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Laboratory Location
                </label>
                <select className="w-full px-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.05)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20">
                  <option>Select location</option>
                  <option>Building A, Floor 1</option>
                  <option>Building A, Floor 2</option>
                  <option>Building B, Floor 3</option>
                  <option>Building C, Floor 2</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                  Category
                </label>
                <select className="w-full px-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.05)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20">
                  <option>Select category</option>
                  <option>Microscopy</option>
                  <option>Spectroscopy</option>
                  <option>Centrifugation</option>
                  <option>Incubation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.12em] uppercase text-[#6b6b6b] mb-2 font-semibold">
                Acquisition Date
              </label>
              <input
                type="date"
                className="w-full px-4 py-3 rounded-xl bg-[#F8F6F2] border border-[rgba(0,0,0,0.05)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-8 pt-6 border-t border-[rgba(0,0,0,0.06)]">
            <button
              onClick={() => navigate('/equipment')}
              className="px-6 py-2.5 rounded-xl text-[#6b6b6b] hover:bg-[#F4F0E6] transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => navigate('/equipment')}
              className="px-8 py-3 rounded-full bg-[#B0005A] text-white font-semibold hover:bg-[#900048] transition-colors shadow-sm"
            >
              Save Equipment
            </button>
          </div>
        </div>

        <div>
          <div className="bg-[#FAF8F4] rounded-[28px] p-8 shadow-sm border border-[rgba(0,0,0,0.04)] text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F4E8F0] flex items-center justify-center mx-auto mb-6">
              <Upload className="w-8 h-8 text-[#B0005A]" />
            </div>
            <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-2">Technical Documentation</h3>
            <p className="text-[13px] text-[#6b6b6b] mb-6">
              Upload PDF manual or calibration sheets (Max 25MB)
            </p>
            <button className="px-6 py-3 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-[#F4F0E6] transition-colors">
              Browse Files
            </button>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="w-24 h-24 rounded-2xl bg-[#F4E8F0] flex items-center justify-center">
              <Microscope className="w-12 h-12 text-[#B0005A]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
