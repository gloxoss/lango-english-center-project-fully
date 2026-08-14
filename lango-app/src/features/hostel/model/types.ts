// Hostel Management add-on — shared domain types (v1 = phases 0-3).
// These mirror the Drizzle schema (src/features/hostel/models/hostel-schema.ts)
// with JSON-friendly shapes for the API layer and UI.

export type HostelStatus = 'active' | 'inactive' | 'archived';
export type ZoneStatus = 'active' | 'archived';
export type RoomStatus = 'active' | 'inactive' | 'out_of_service' | 'archived';
export type BedStatus = 'active' | 'out_of_service' | 'archived';

export type Hostel = {
  id: string;
  tenantId: string;
  branchId: string | null;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  genderPolicy: 'mixed' | 'male_only' | 'female_only';
  ageMin: number | null;
  ageMax: number | null;
  policySnapshot: unknown;
  wardenEmployeeId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  capacity: number;
  status: HostelStatus;
  createdAt: string;
  updatedAt: string;
};

export type HostelZone = {
  id: string;
  tenantId: string;
  hostelId: string;
  parentZoneId: string | null;
  zoneType: 'building' | 'floor' | 'wing' | 'zone';
  code: string | null;
  name: string;
  curfewTime: string | null;
  rollCallTime: string | null;
  visitorHours: unknown;
  emergencyAssemblyPoint: string | null;
  chargePolicyOverride: unknown;
  status: ZoneStatus;
  createdAt: string;
  updatedAt: string;
};

export type HostelRoomCategory = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  defaultCapacity: number | null;
  amenities: unknown;
  eligibleGenderPolicy: 'mixed' | 'male_only' | 'female_only';
  eligibleCohortIds: string[] | null;
  baseCharge: string;
  depositAmount: string;
  priority: number;
  isAccessible: boolean;
  status: ZoneStatus;
  createdAt: string;
  updatedAt: string;
};

export type HostelRoom = {
  id: string;
  tenantId: string;
  hostelId: string;
  zoneId: string | null;
  categoryId: string | null;
  code: string;
  name: string | null;
  isAccessible: boolean;
  facilities: unknown;
  responsibleEmployeeId: string | null;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
};

export type HostelBed = {
  id: string;
  tenantId: string;
  roomId: string;
  code: string;
  isAccessible: boolean;
  status: BedStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// Derived occupancy — computed from effective-dated allocations, never stored.
export type BedOccupancy = {
  bed: HostelBed;
  allocationId: string | null;
  studentId: string | null;
  studentName: string | null;
  state: 'reserved' | 'checked_in' | null;
};

export type RoomOccupancy = {
  room: HostelRoom;
  categoryCode: string | null;
  zoneName: string | null;
  totalBeds: number;
  usableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  availableBeds: number;
  occupancyRate: number; // occupied / usable, 0..1
  beds: BedOccupancy[];
};

// Board read model — GET /api/addons/hostel/board
export type HostelBoard = {
  hostelId: string;
  hostelCode: string;
  hostelName: string;
  status: HostelStatus;
  genderPolicy: Hostel['genderPolicy'];
  capacity: number; // usable bed count (recomputed, never a manual counter)
  totalBeds: number;
  usableBeds: number;
  occupiedBeds: number; // checked_in
  reservedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  rooms: RoomOccupancy[];
};
