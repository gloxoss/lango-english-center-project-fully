/**
 * Shapes for the Salles screen. These mirror `/api/academics/rooms` exactly.
 *
 * There is deliberately no MOCK_ROOMS constant any more: the screen used to
 * seed itself with four invented rooms and keep them on screen when the fetch
 * failed, so an admin could not tell a real empty registry from a broken one.
 */

export type RoomOccupancy = 'Occupied' | 'Available' | 'Maintenance';

export type RoomScheduleSlot = {
  time: string;
  course: string;
  startTime: string;
  endTime: string;
};

export type RoomItem = {
  id: string;
  name: string;
  code: string | null;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  roomType: string | null;
  equipment: string[];
  status: 'available' | 'maintenance';
  isActive: boolean;
  /** Derived server-side from the timetable; never stored. */
  occupancyStatus: RoomOccupancy;
  currentClass: string | null;
  schedule: RoomScheduleSlot[];
};

export const ROOM_TYPES = ['Classroom', 'Laboratory', 'Amphitheater', 'Computer Lab'] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<string, string> = {
  'Classroom': 'Salle de cours',
  'Laboratory': 'Laboratoire',
  'Amphitheater': 'Amphithéâtre',
  'Computer Lab': 'Salle Informatique',
};

export const OCCUPANCY_LABELS: Record<RoomOccupancy, string> = {
  Occupied: 'Occupée',
  Available: 'Libre',
  Maintenance: 'Maintenance',
};

/**
 * Share of the 08:00-18:00 teaching day that the registry's rooms are booked
 * for. Replaces the hardcoded "68%" the KPI card used to print regardless of
 * the data. Returns null when there are no rooms, so the card can say so
 * instead of dividing by zero and rendering NaN.
 */
export const TEACHING_DAY_MINUTES = 10 * 60;

export function utilizationRate(rooms: RoomItem[]): number | null {
  if (rooms.length === 0) {
    return null;
  }

  const bookedMinutes = rooms.reduce((total, room) => {
    return total + room.schedule.reduce((mins, slot) => mins + slotMinutes(slot), 0);
  }, 0);

  return Math.round((bookedMinutes / (rooms.length * TEACHING_DAY_MINUTES)) * 100);
}

function slotMinutes(slot: RoomScheduleSlot): number {
  const start = toMinutes(slot.startTime);
  const end = toMinutes(slot.endTime);
  return end > start ? end - start : 0;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}
