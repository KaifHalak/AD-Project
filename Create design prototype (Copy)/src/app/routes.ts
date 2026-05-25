import { createBrowserRouter } from 'react-router';
import { Layout } from './components/layout/Layout';
import { BookingRecords } from './components/pages/BookingRecords';
import { Equipment } from './components/pages/Equipment';
import { AddEquipment } from './components/pages/AddEquipment';
import { Bookings } from './components/pages/Bookings';
import { ReserveNew } from './components/pages/ReserveNew';
import { ReserveEquipment } from './components/pages/ReserveEquipment';
import { RescheduleBooking } from './components/pages/RescheduleBooking';
import { ModifyLab } from './components/pages/ModifyLab';
import { ModifyEquipment } from './components/pages/ModifyEquipment';
import { Conflict } from './components/pages/Conflict';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Equipment },
      { path: 'equipment', Component: Equipment },
      { path: 'add-equipment', Component: AddEquipment },
      { path: 'bookings', Component: Bookings },
      { path: 'booking-records', Component: BookingRecords },
      { path: 'reserve', Component: ReserveNew },
      { path: 'reserve-equipment', Component: ReserveEquipment },
      { path: 'reschedule', Component: RescheduleBooking },
      { path: 'modify-lab', Component: ModifyLab },
      { path: 'modify-equipment', Component: ModifyEquipment },
      { path: 'conflict', Component: Conflict },
    ],
  },
]);
