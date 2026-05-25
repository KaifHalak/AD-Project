import { Search, Microscope, TestTube, Activity, ChevronDown, Check, MapPin, GraduationCap } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';

export function Equipment() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['all']);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(['all']);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  const courses = [
    { id: 'software-engineering', name: 'Software Engineering' },
    { id: 'mechanical', name: 'Mechanical Engineering' },
    { id: 'electrical', name: 'Electrical Engineering' },
    { id: 'chemical', name: 'Chemical Engineering' },
  ];

  const locations = [
    { id: 'mjiit', name: 'MJIIT' },
    { id: 'razak-tower', name: 'Razak Tower' },
    { id: 'building-a', name: 'Building A' },
    { id: 'building-b', name: 'Building B' },
  ];

  const equipment = [
    { name: 'Mass Spectrometer', id: 'MS-A4521', course: 'chemical', location: 'mjiit', room: 'Room 204', price: '$120/hr', description: 'High-precision analytical instrument for chemical analysis', status: 'available', icon: Activity },
    { name: 'Ultra Centrifuge', id: 'UC-B7832', course: 'chemical', location: 'building-b', room: 'Room 105', price: '$85/hr', description: 'High-speed centrifuge for sample separation', status: 'in-use', icon: Activity },
    { name: 'Cryostat Microtome', id: 'CM-A9214', course: 'mechanical', location: 'razak-tower', room: 'Room 312', price: '$95/hr', description: 'Precision cutting tool for microscopy samples', status: 'available', icon: TestTube },
    { name: 'Electron Microscope', id: 'EM-C5673', course: 'mechanical', location: 'mjiit', room: 'Room 201', price: '$200/hr', description: 'Advanced imaging for nanoscale materials', status: 'maintenance', icon: Microscope },
    { name: 'Flow Cytometer', id: 'FC-B4392', course: 'software-engineering', location: 'building-b', room: 'Room 208', price: '$110/hr', description: 'Cell analysis and sorting system', status: 'available', icon: Activity },
    { name: 'CO2 Incubator', id: 'CI-A7651', course: 'chemical', location: 'building-a', room: 'Room 115', price: '$45/hr', description: 'Controlled environment chamber for cell culture', status: 'in-use', icon: TestTube },
    { name: '3D Printer', id: '3DP-M8234', course: 'mechanical', location: 'razak-tower', room: 'Room 401', price: '$60/hr', description: 'Industrial-grade additive manufacturing system', status: 'available', icon: Microscope },
    { name: 'Oscilloscope', id: 'OSC-E3421', course: 'electrical', location: 'mjiit', room: 'Room 150', price: '$35/hr', description: 'Digital signal analysis equipment', status: 'available', icon: Activity },
  ];

  const toggleCourse = (courseId: string) => {
    if (courseId === 'all') {
      setSelectedCourses(['all']);
    } else {
      setSelectedCourses(prev => {
        const withoutAll = prev.filter(id => id !== 'all');
        if (withoutAll.includes(courseId)) {
          const newSelection = withoutAll.filter(id => id !== courseId);
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          const newSelection = [...withoutAll, courseId];
          return newSelection.length === courses.length ? ['all'] : newSelection;
        }
      });
    }
  };

  const toggleLocation = (locationId: string) => {
    if (locationId === 'all') {
      setSelectedLocations(['all']);
    } else {
      setSelectedLocations(prev => {
        const withoutAll = prev.filter(id => id !== 'all');
        if (withoutAll.includes(locationId)) {
          const newSelection = withoutAll.filter(id => id !== locationId);
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          const newSelection = [...withoutAll, locationId];
          return newSelection.length === locations.length ? ['all'] : newSelection;
        }
      });
    }
  };

  const getCourseLabel = () => {
    if (selectedCourses.includes('all')) return 'All Courses';
    const count = selectedCourses.length;
    return count === 1 ? courses.find(c => c.id === selectedCourses[0])?.name : `${count} Courses`;
  };

  const getLocationLabel = () => {
    if (selectedLocations.includes('all')) return 'All Locations';
    const count = selectedLocations.length;
    return count === 1 ? locations.find(l => l.id === selectedLocations[0])?.name : `${count} Locations`;
  };

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourses.includes('all') || selectedCourses.includes(item.course);
    const matchesLocation = selectedLocations.includes('all') || selectedLocations.includes(item.location);
    return matchesSearch && matchesCourse && matchesLocation;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-[#A8E6CF] text-[#1a1a1a]';
      case 'in-use':
        return 'bg-[#E6A8C4] text-[#1a1a1a]';
      case 'maintenance':
        return 'bg-[#F4D19B] text-[#1a1a1a]';
      default:
        return 'bg-[#E8E4DA] text-[#1a1a1a]';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
        setIsCourseDropdownOpen(false);
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.15em] uppercase text-[#6b6b6b] mb-3">Laboratory Booking</div>
        <h1 className="text-[48px] leading-[1.1] font-bold text-[#1a1a1a] mb-6">
          Equipment Catalog
        </h1>
      </div>

      <div className="mb-8 flex gap-4 items-center">
        <div className="relative flex-1 max-w-2xl">
          <input
            type="text"
            placeholder="Search by equipment name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-6 pr-12 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B0005A]/20"
          />
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6b6b]" />
        </div>

        <div className="relative" ref={courseDropdownRef}>
          <button
            onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
            className="px-5 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-white transition-colors flex items-center gap-3 min-w-[200px] justify-between"
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#6b6b6b]" />
              <span>{getCourseLabel()}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isCourseDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isCourseDropdownOpen && (
            <div className="absolute top-full mt-2 right-0 w-[280px] bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-lg z-50 py-2">
              <button
                onClick={() => toggleCourse('all')}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedCourses.includes('all') ? 'bg-[#B0005A] border-[#B0005A]' : 'border-[rgba(0,0,0,0.2)]'
                }`}>
                  {selectedCourses.includes('all') && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-[14px] font-semibold text-[#1a1a1a]">All Courses</span>
              </button>
              <div className="border-t border-[rgba(0,0,0,0.06)] my-2"></div>
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => toggleCourse(course.id)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedCourses.includes(course.id) && !selectedCourses.includes('all')
                      ? 'bg-[#B0005A] border-[#B0005A]'
                      : 'border-[rgba(0,0,0,0.2)]'
                  }`}>
                    {selectedCourses.includes(course.id) && !selectedCourses.includes('all') && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <span className="text-[14px] text-[#1a1a1a]">{course.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={locationDropdownRef}>
          <button
            onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
            className="px-5 py-4 rounded-2xl bg-[#FAF8F4] border border-[rgba(0,0,0,0.06)] text-sm font-semibold text-[#1a1a1a] hover:bg-white transition-colors flex items-center gap-3 min-w-[200px] justify-between"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#6b6b6b]" />
              <span>{getLocationLabel()}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isLocationDropdownOpen && (
            <div className="absolute top-full mt-2 right-0 w-[280px] bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-lg z-50 py-2">
              <button
                onClick={() => toggleLocation('all')}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedLocations.includes('all') ? 'bg-[#B0005A] border-[#B0005A]' : 'border-[rgba(0,0,0,0.2)]'
                }`}>
                  {selectedLocations.includes('all') && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-[14px] font-semibold text-[#1a1a1a]">All Locations</span>
              </button>
              <div className="border-t border-[rgba(0,0,0,0.06)] my-2"></div>
              {locations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => toggleLocation(location.id)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#F4F0E6] transition-colors text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedLocations.includes(location.id) && !selectedLocations.includes('all')
                      ? 'bg-[#B0005A] border-[#B0005A]'
                      : 'border-[rgba(0,0,0,0.2)]'
                  }`}>
                    {selectedLocations.includes(location.id) && !selectedLocations.includes('all') && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <span className="text-[14px] text-[#1a1a1a]">{location.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 text-[13px] text-[#6b6b6b]">
        Showing {filteredEquipment.length} equipment{filteredEquipment.length !== 1 ? 's' : ''}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {filteredEquipment.map((item, index) => {
          const Icon = item.icon;
          const locationName = locations.find(l => l.id === item.location)?.name || item.location;
          const courseName = courses.find(c => c.id === item.course)?.name || item.course;

          return (
            <Link
              key={index}
              to={`/reserve-equipment?id=${item.id}&name=${encodeURIComponent(item.name)}`}
              className="bg-[#FAF8F4] rounded-[24px] p-6 border border-[rgba(0,0,0,0.04)] hover:shadow-lg hover:border-[#B0005A]/20 transition-all block"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-[#F4E8F0] flex items-center justify-center">
                  <Icon className="w-7 h-7 text-[#B0005A]" />
                </div>
                <span className={`px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase ${getStatusColor(item.status)}`}>
                  {item.status.replace('-', ' ')}
                </span>
              </div>

              <h3 className="font-bold text-[18px] text-[#1a1a1a] mb-1">{item.name}</h3>
              <p className="text-[11px] text-[#6b6b6b] mb-3">ID: {item.id}</p>

              <p className="text-[13px] text-[#6b6b6b] mb-4 line-clamp-2">{item.description}</p>

              <div className="space-y-2 mb-4 pb-4 border-b border-[rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2 text-[12px]">
                  <GraduationCap className="w-3.5 h-3.5 text-[#6b6b6b]" />
                  <span className="text-[#1a1a1a]">{courseName}</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <MapPin className="w-3.5 h-3.5 text-[#6b6b6b]" />
                  <span className="text-[#1a1a1a]">{locationName} - {item.room}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] tracking-[0.1em] uppercase text-[#6b6b6b] mb-1">Est. Price</div>
                  <div className="text-[20px] font-bold text-[#B0005A]">{item.price}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filteredEquipment.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[16px] text-[#6b6b6b]">No equipment found matching your filters.</p>
        </div>
      )}
    </div>
  );
}
