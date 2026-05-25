import { Link, useLocation } from 'react-router';
import { LayoutDashboard, Microscope, Calendar, FileText } from 'lucide-react';

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/equipment', label: 'Equipment', icon: Microscope },
    { path: '/bookings', label: 'Book a Lab', icon: Calendar },
    { path: '/booking-records', label: 'Booking Records', icon: FileText },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#FAF8F4] border-r border-[rgba(0,0,0,0.06)] flex flex-col">
      <div className="p-6 border-b border-[rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B0005A] flex items-center justify-center">
            <Microscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-[15px] text-[#1a1a1a]">Scholarly Lab</div>
            <div className="text-[10px] tracking-[0.1em] text-[#6b6b6b] uppercase">Core Facility</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-colors ${
                isActive
                  ? 'bg-[#F4E8F0] text-[#B0005A]'
                  : 'text-[#6b6b6b] hover:bg-[#F4F0E6]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[14px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <Link
          to="/bookings"
          className="w-full flex items-center justify-center gap-2 bg-[#B0005A] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#900048] transition-colors shadow-sm"
        >
          <span className="text-xl">+</span>
          <span>Quick Book</span>
        </Link>
      </div>
    </aside>
  );
}
