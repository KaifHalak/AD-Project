import { Outlet, Link, useLocation } from 'react-router';
import { User, Microscope, Calendar, FileText } from 'lucide-react';

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/equipment', label: 'Equipment', icon: Microscope },
    { path: '/bookings', label: 'Book a Lab', icon: Calendar },
    { path: '/booking-records', label: 'Booking Records', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#F4F0E6]">
      <header className="sticky top-0 z-10 bg-[#FAF8F4] border-b border-[rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-12 py-4">
          <div className="flex items-center gap-12">
            <Link to="/equipment" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B0005A] flex items-center justify-center">
                <Microscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-[15px] text-[#1a1a1a]">Scholarly Lab</div>
                <div className="text-[10px] tracking-[0.1em] text-[#6b6b6b] uppercase">Core Facility</div>
              </div>
            </Link>

            <nav className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-[#F4E8F0] text-[#B0005A]'
                        : 'text-[#6b6b6b] hover:bg-[#F4F0E6]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[14px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E8D4F0] flex items-center justify-center">
              <User className="w-5 h-5 text-[#B0005A]" />
            </div>
            <span className="text-sm font-medium text-[#1a1a1a]">User Name</span>
          </div>
        </div>
      </header>
      <main className="p-12">
        <Outlet />
      </main>
    </div>
  );
}
