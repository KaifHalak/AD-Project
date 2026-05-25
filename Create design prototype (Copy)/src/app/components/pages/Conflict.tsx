import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';

export function Conflict() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="bg-[#FFF0F5] rounded-[32px] p-12 shadow-sm border border-[rgba(208,84,123,0.15)]">
          <div className="flex gap-6 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4E8F0] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-[#D0547B]" />
            </div>
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-[#E6A8C4] text-[#1a1a1a] text-[10px] font-semibold tracking-wide uppercase mb-4">
                Booking Error
              </div>
              <h1 className="text-[40px] leading-[1.1] font-bold text-[#1a1a1a] mb-4">
                Scheduling Conflict
              </h1>
              <p className="text-[16px] text-[#6b6b6b] leading-relaxed max-w-lg">
                The selected time slot for this laboratory is already reserved by another researcher.
                Please choose a different time or view the full schedule to find an available opening.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-8 pt-8 border-t border-[rgba(0,0,0,0.06)]">
            <button
              onClick={() => navigate('/')}
              className="px-10 py-4 rounded-full bg-[#B0005A] text-white font-semibold hover:bg-[#900048] transition-colors shadow-lg text-[16px] flex items-center gap-3"
            >
              Back to Schedule
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
