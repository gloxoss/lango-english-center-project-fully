// Hostel inventory service — CRUD for residences, zones, categories, rooms and
// beds, plus the derived occupancy board read model. Every foreign id is
// re-verified as `WHERE id = ? AND tenantId = ?` (multi-tenant boundary).
//
// Occupancy is NEVER a manually-edited counter: it is derived here from the
// effective-dated hostel_allocations rows whose range covers today.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { branches, employeeProfiles, user } from '@/models/Schema';
import { firstRow } from '@/features/hostel/server/db-utils';
import {
  hostelAllocations,
  hostelBeds,
  hostelRoomCategories,
  hostelRooms,
  hostels,
  hostelZones,
} from '@/features/hostel/models/hostel-schema';
import type {
  BedOccupancy,
  Hostel,
  HostelBed,
  HostelBoard,
  HostelRoom,
  HostelStatus,
  RoomOccupancy,
} from '@/features/hostel/model/types';

// ---------------------------------------------------------------------------
// Date helpers (allocation ranges are half-open [start, end), ISO 'YYYY-MM-DD')
// ---------------------------------------------------------------------------

export function dateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Tenant re-verification of foreign ids
// ---------------------------------------------------------------------------

async function verifyBranch(tenantId: string, branchId?: string | null) {
  if (!branchId) return;
  const [row] = await db.select({ id: branches.id }).from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_BRANCH', 'La succursale choisie n\'existe pas dans cet établissement.');
}

async function verifyWarden(tenantId: string, employeeId?: string | null) {
  if (!employeeId) return;
  const [row] = await db.select({ id: employeeProfiles.id }).from(employeeProfiles)
    .where(and(eq(employeeProfiles.id, employeeId), eq(employeeProfiles.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_WARDEN', 'Le référent (employé) choisi n\'existe pas dans cet établissement.');
}

export async function requireHostel(tenantId: string, hostelId: string) {
  const [row] = await db.select({ id: hostels.id }).from(hostels)
    .where(and(eq(hostels.id, hostelId), eq(hostels.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Résidence introuvable.');
  return row;
}

async function verifyHostel(tenantId: string, hostelId?: string | null) {
  if (!hostelId) return;
  await requireHostel(tenantId, hostelId);
}

async function verifyZone(tenantId: string, zoneId?: string | null, hostelId?: string | null) {
  if (!zoneId) return;
  const conds = [eq(hostelZones.id, zoneId), eq(hostelZones.tenantId, tenantId)];
  if (hostelId) conds.push(eq(hostelZones.hostelId, hostelId));
  const [row] = await db.select({ id: hostelZones.id }).from(hostelZones)
    .where(and(...conds)).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_ZONE', 'La zone choisie n\'existe pas dans cet établissement.');
}

async function verifyCategory(tenantId: string, categoryId?: string | null) {
  if (!categoryId) return;
  const [row] = await db.select({ id: hostelRoomCategories.id }).from(hostelRoomCategories)
    .where(and(eq(hostelRoomCategories.id, categoryId), eq(hostelRoomCategories.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_CATEGORY', 'La catégorie de chambre choisie n\'existe pas dans cet établissement.');
}

async function verifyRoom(tenantId: string, roomId?: string | null) {
  if (!roomId) return;
  const [row] = await db.select({ id: hostelRooms.id }).from(hostelRooms)
    .where(and(eq(hostelRooms.id, roomId), eq(hostelRooms.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(422, 'INVALID_ROOM', 'La chambre choisie n\'existe pas dans cet établissement.');
}

// ---------------------------------------------------------------------------
// Residences
// ---------------------------------------------------------------------------

export async function listHostels(tenantId: string, branchId?: string | null) {
  const conds = [eq(hostels.tenantId, tenantId)];
  if (branchId) conds.push(eq(hostels.branchId, branchId));
  return db
    .select({
      id: hostels.id,
      branchId: hostels.branchId,
      code: hostels.code,
      name: hostels.name,
      address: hostels.address,
      phone: hostels.phone,
      email: hostels.email,
      genderPolicy: hostels.genderPolicy,
      ageMin: hostels.ageMin,
      ageMax: hostels.ageMax,
      wardenEmployeeId: hostels.wardenEmployeeId,
      emergencyContactName: hostels.emergencyContactName,
      emergencyContactPhone: hostels.emergencyContactPhone,
      capacity: hostels.capacity,
      status: hostels.status,
      createdAt: hostels.createdAt,
      updatedAt: hostels.updatedAt,
      branchName: branches.name,
    })
    .from(hostels)
    .leftJoin(branches, eq(hostels.branchId, branches.id))
    .where(and(...conds))
    .orderBy(asc(hostels.name));
}

export async function getHostel(tenantId: string, hostelId: string) {
  const [hostel] = await db
    .select({
      id: hostels.id,
      branchId: hostels.branchId,
      code: hostels.code,
      name: hostels.name,
      address: hostels.address,
      phone: hostels.phone,
      email: hostels.email,
      genderPolicy: hostels.genderPolicy,
      ageMin: hostels.ageMin,
      ageMax: hostels.ageMax,
      policySnapshot: hostels.policySnapshot,
      wardenEmployeeId: hostels.wardenEmployeeId,
      emergencyContactName: hostels.emergencyContactName,
      emergencyContactPhone: hostels.emergencyContactPhone,
      capacity: hostels.capacity,
      status: hostels.status,
      createdAt: hostels.createdAt,
      updatedAt: hostels.updatedAt,
      branchName: branches.name,
    })
    .from(hostels)
    .leftJoin(branches, eq(hostels.branchId, branches.id))
    .where(and(eq(hostels.id, hostelId), eq(hostels.tenantId, tenantId)))
    .limit(1);
  if (!hostel) throw new ApiError(404, 'NOT_FOUND', 'Résidence introuvable.');
  return hostel;
}

export async function createHostel(tenantId: string, data: {
  branchId?: string | null;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  genderPolicy?: string;
  ageMin?: number | null;
  ageMax?: number | null;
  policySnapshot?: unknown;
  wardenEmployeeId?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  status?: string;
}) {
  await verifyBranch(tenantId, data.branchId ?? null);
  await verifyWarden(tenantId, data.wardenEmployeeId ?? null);
  const row = firstRow(await db.insert(hostels).values({
    tenantId,
    branchId: data.branchId ?? null,
    code: data.code,
    name: data.name,
    address: data.address ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    genderPolicy: data.genderPolicy ?? 'mixed',
    ageMin: data.ageMin ?? null,
    ageMax: data.ageMax ?? null,
    policySnapshot: data.policySnapshot ?? null,
    wardenEmployeeId: data.wardenEmployeeId ?? null,
    emergencyContactName: data.emergencyContactName ?? null,
    emergencyContactPhone: data.emergencyContactPhone ?? null,
    status: data.status ?? 'active',
  }).returning());
  return row;
}

export async function updateHostel(tenantId: string, hostelId: string, data: {
  branchId?: string | null;
  code?: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  genderPolicy?: string;
  ageMin?: number | null;
  ageMax?: number | null;
  policySnapshot?: unknown;
  wardenEmployeeId?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  status?: string;
}) {
  await requireHostel(tenantId, hostelId);
  if (data.branchId !== undefined) await verifyBranch(tenantId, data.branchId);
  if (data.wardenEmployeeId !== undefined) await verifyWarden(tenantId, data.wardenEmployeeId);
  const row = firstRow(await db.update(hostels)
    .set({
      ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.genderPolicy !== undefined ? { genderPolicy: data.genderPolicy } : {}),
      ...(data.ageMin !== undefined ? { ageMin: data.ageMin } : {}),
      ...(data.ageMax !== undefined ? { ageMax: data.ageMax } : {}),
      ...(data.policySnapshot !== undefined ? { policySnapshot: data.policySnapshot } : {}),
      ...(data.wardenEmployeeId !== undefined ? { wardenEmployeeId: data.wardenEmployeeId } : {}),
      ...(data.emergencyContactName !== undefined ? { emergencyContactName: data.emergencyContactName } : {}),
      ...(data.emergencyContactPhone !== undefined ? { emergencyContactPhone: data.emergencyContactPhone } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(hostels.id, hostelId), eq(hostels.tenantId, tenantId)))
    .returning());
  return row;
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

export async function listZones(tenantId: string, hostelId?: string | null) {
  const conds = [eq(hostelZones.tenantId, tenantId)];
  if (hostelId) conds.push(eq(hostelZones.hostelId, hostelId));
  return db.select().from(hostelZones)
    .where(and(...conds)).orderBy(asc(hostelZones.name));
}

export async function createZone(tenantId: string, data: {
  hostelId: string;
  parentZoneId?: string | null;
  zoneType?: string;
  code?: string | null;
  name: string;
  curfewTime?: string | null;
  rollCallTime?: string | null;
  visitorHours?: unknown;
  emergencyAssemblyPoint?: string | null;
  chargePolicyOverride?: unknown;
  status?: string;
}) {
  await requireHostel(tenantId, data.hostelId);
  if (data.parentZoneId) await verifyZone(tenantId, data.parentZoneId, data.hostelId);
  const row = firstRow(await db.insert(hostelZones).values({
    tenantId,
    hostelId: data.hostelId,
    parentZoneId: data.parentZoneId ?? null,
    zoneType: data.zoneType ?? 'floor',
    code: data.code ?? null,
    name: data.name,
    curfewTime: data.curfewTime ?? null,
    rollCallTime: data.rollCallTime ?? null,
    visitorHours: data.visitorHours ?? null,
    emergencyAssemblyPoint: data.emergencyAssemblyPoint ?? null,
    chargePolicyOverride: data.chargePolicyOverride ?? null,
    status: data.status ?? 'active',
  }).returning());
  return row;
}

export async function updateZone(tenantId: string, zoneId: string, data: {
  parentZoneId?: string | null;
  zoneType?: string;
  code?: string | null;
  name?: string;
  curfewTime?: string | null;
  rollCallTime?: string | null;
  visitorHours?: unknown;
  emergencyAssemblyPoint?: string | null;
  chargePolicyOverride?: unknown;
  status?: string;
}) {
  const [zone] = await db.select({ hostelId: hostelZones.hostelId }).from(hostelZones)
    .where(and(eq(hostelZones.id, zoneId), eq(hostelZones.tenantId, tenantId))).limit(1);
  if (!zone) throw new ApiError(404, 'NOT_FOUND', 'Zone introuvable.');
  if (data.parentZoneId !== undefined) await verifyZone(tenantId, data.parentZoneId, zone.hostelId);
  const row = firstRow(await db.update(hostelZones)
    .set({
      ...(data.parentZoneId !== undefined ? { parentZoneId: data.parentZoneId } : {}),
      ...(data.zoneType !== undefined ? { zoneType: data.zoneType } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.curfewTime !== undefined ? { curfewTime: data.curfewTime } : {}),
      ...(data.rollCallTime !== undefined ? { rollCallTime: data.rollCallTime } : {}),
      ...(data.visitorHours !== undefined ? { visitorHours: data.visitorHours } : {}),
      ...(data.emergencyAssemblyPoint !== undefined ? { emergencyAssemblyPoint: data.emergencyAssemblyPoint } : {}),
      ...(data.chargePolicyOverride !== undefined ? { chargePolicyOverride: data.chargePolicyOverride } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(hostelZones.id, zoneId), eq(hostelZones.tenantId, tenantId)))
    .returning());
  return row;
}

// ---------------------------------------------------------------------------
// Room categories
// ---------------------------------------------------------------------------

export async function listRoomCategories(tenantId: string) {
  return db.select().from(hostelRoomCategories)
    .where(eq(hostelRoomCategories.tenantId, tenantId))
    .orderBy(asc(hostelRoomCategories.priority), asc(hostelRoomCategories.name));
}

export async function createRoomCategory(tenantId: string, data: {
  name: string;
  code: string;
  defaultCapacity?: number | null;
  amenities?: unknown;
  eligibleGenderPolicy?: string;
  eligibleCohortIds?: string[] | null;
  baseCharge?: string;
  depositAmount?: string;
  priority?: number;
  isAccessible?: boolean;
  status?: string;
}) {
  const row = firstRow(await db.insert(hostelRoomCategories).values({
    tenantId,
    name: data.name,
    code: data.code,
    defaultCapacity: data.defaultCapacity ?? null,
    amenities: data.amenities ?? null,
    eligibleGenderPolicy: data.eligibleGenderPolicy ?? 'mixed',
    eligibleCohortIds: data.eligibleCohortIds ?? null,
    baseCharge: data.baseCharge ?? '0',
    depositAmount: data.depositAmount ?? '0',
    priority: data.priority ?? 0,
    isAccessible: data.isAccessible ?? false,
    status: data.status ?? 'active',
  }).returning());
  return row;
}

export async function updateRoomCategory(tenantId: string, categoryId: string, data: {
  name?: string;
  code?: string;
  defaultCapacity?: number | null;
  amenities?: unknown;
  eligibleGenderPolicy?: string;
  eligibleCohortIds?: string[] | null;
  baseCharge?: string;
  depositAmount?: string;
  priority?: number;
  isAccessible?: boolean;
  status?: string;
}) {
  await verifyCategory(tenantId, categoryId);
  const row = firstRow(await db.update(hostelRoomCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.defaultCapacity !== undefined ? { defaultCapacity: data.defaultCapacity } : {}),
      ...(data.amenities !== undefined ? { amenities: data.amenities } : {}),
      ...(data.eligibleGenderPolicy !== undefined ? { eligibleGenderPolicy: data.eligibleGenderPolicy } : {}),
      ...(data.eligibleCohortIds !== undefined ? { eligibleCohortIds: data.eligibleCohortIds } : {}),
      ...(data.baseCharge !== undefined ? { baseCharge: data.baseCharge } : {}),
      ...(data.depositAmount !== undefined ? { depositAmount: data.depositAmount } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.isAccessible !== undefined ? { isAccessible: data.isAccessible } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(hostelRoomCategories.id, categoryId), eq(hostelRoomCategories.tenantId, tenantId)))
    .returning());
  return row;
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function listRooms(tenantId: string, opts?: { hostelId?: string; zoneId?: string; categoryId?: string }) {
  const conds = [eq(hostelRooms.tenantId, tenantId)];
  if (opts?.hostelId) conds.push(eq(hostelRooms.hostelId, opts.hostelId));
  if (opts?.zoneId) conds.push(eq(hostelRooms.zoneId, opts.zoneId));
  if (opts?.categoryId) conds.push(eq(hostelRooms.categoryId, opts.categoryId));
  return db
    .select({
      id: hostelRooms.id,
      hostelId: hostelRooms.hostelId,
      zoneId: hostelRooms.zoneId,
      categoryId: hostelRooms.categoryId,
      code: hostelRooms.code,
      name: hostelRooms.name,
      isAccessible: hostelRooms.isAccessible,
      facilities: hostelRooms.facilities,
      responsibleEmployeeId: hostelRooms.responsibleEmployeeId,
      status: hostelRooms.status,
      createdAt: hostelRooms.createdAt,
      updatedAt: hostelRooms.updatedAt,
      zoneName: hostelZones.name,
      categoryName: hostelRoomCategories.name,
    })
    .from(hostelRooms)
    .leftJoin(hostelZones, eq(hostelRooms.zoneId, hostelZones.id))
    .leftJoin(hostelRoomCategories, eq(hostelRooms.categoryId, hostelRoomCategories.id))
    .where(and(...conds))
    .orderBy(asc(hostelRooms.code));
}

export async function createRoom(tenantId: string, data: {
  hostelId: string;
  zoneId?: string | null;
  categoryId?: string | null;
  code: string;
  name?: string | null;
  isAccessible?: boolean;
  facilities?: unknown;
  responsibleEmployeeId?: string | null;
  status?: string;
}) {
  await requireHostel(tenantId, data.hostelId);
  await verifyZone(tenantId, data.zoneId ?? null, data.hostelId);
  await verifyCategory(tenantId, data.categoryId ?? null);
  await verifyWarden(tenantId, data.responsibleEmployeeId ?? null);
  const row = firstRow(await db.insert(hostelRooms).values({
    tenantId,
    hostelId: data.hostelId,
    zoneId: data.zoneId ?? null,
    categoryId: data.categoryId ?? null,
    code: data.code,
    name: data.name ?? null,
    isAccessible: data.isAccessible ?? false,
    facilities: data.facilities ?? null,
    responsibleEmployeeId: data.responsibleEmployeeId ?? null,
    status: data.status ?? 'active',
  }).returning());
  return row;
}

export async function updateRoom(tenantId: string, roomId: string, data: {
  zoneId?: string | null;
  categoryId?: string | null;
  code?: string;
  name?: string | null;
  isAccessible?: boolean;
  facilities?: unknown;
  responsibleEmployeeId?: string | null;
  status?: string;
}) {
  const [room] = await db.select({ hostelId: hostelRooms.hostelId }).from(hostelRooms)
    .where(and(eq(hostelRooms.id, roomId), eq(hostelRooms.tenantId, tenantId))).limit(1);
  if (!room) throw new ApiError(404, 'NOT_FOUND', 'Chambre introuvable.');
  if (data.zoneId !== undefined) await verifyZone(tenantId, data.zoneId, room.hostelId);
  if (data.categoryId !== undefined) await verifyCategory(tenantId, data.categoryId);
  if (data.responsibleEmployeeId !== undefined) await verifyWarden(tenantId, data.responsibleEmployeeId);
  const row = firstRow(await db.update(hostelRooms)
    .set({
      ...(data.zoneId !== undefined ? { zoneId: data.zoneId } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.isAccessible !== undefined ? { isAccessible: data.isAccessible } : {}),
      ...(data.facilities !== undefined ? { facilities: data.facilities } : {}),
      ...(data.responsibleEmployeeId !== undefined ? { responsibleEmployeeId: data.responsibleEmployeeId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(hostelRooms.id, roomId), eq(hostelRooms.tenantId, tenantId)))
    .returning());
  return row;
}

// ---------------------------------------------------------------------------
// Beds
// ---------------------------------------------------------------------------

export async function listBeds(tenantId: string, opts?: { roomId?: string; status?: string }) {
  const conds = [eq(hostelBeds.tenantId, tenantId)];
  if (opts?.roomId) conds.push(eq(hostelBeds.roomId, opts.roomId));
  if (opts?.status) conds.push(eq(hostelBeds.status, opts.status));
  return db.select().from(hostelBeds).where(and(...conds)).orderBy(asc(hostelBeds.code));
}

export async function createBed(tenantId: string, data: {
  roomId: string;
  code: string;
  isAccessible?: boolean;
  status?: string;
  notes?: string | null;
}) {
  await verifyRoom(tenantId, data.roomId);
  const row = firstRow(await db.insert(hostelBeds).values({
    tenantId,
    roomId: data.roomId,
    code: data.code,
    isAccessible: data.isAccessible ?? false,
    status: data.status ?? 'active',
    notes: data.notes ?? null,
  }).returning());
  return row;
}

export async function updateBed(tenantId: string, bedId: string, data: {
  code?: string;
  isAccessible?: boolean;
  status?: string;
  notes?: string | null;
}) {
  await requireBed(tenantId, bedId);
  const row = firstRow(await db.update(hostelBeds)
    .set({
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.isAccessible !== undefined ? { isAccessible: data.isAccessible } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(hostelBeds.id, bedId), eq(hostelBeds.tenantId, tenantId)))
    .returning());
  return row;
}

export async function requireBed(tenantId: string, bedId: string) {
  const [row] = await db.select({ id: hostelBeds.id }).from(hostelBeds)
    .where(and(eq(hostelBeds.id, bedId), eq(hostelBeds.tenantId, tenantId))).limit(1);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Lit introuvable.');
  return row;
}

/**
 * Transition a bed to/from out_of_service (T9).
 * Setting out_of_service with an overlapping active allocation is refused and
 * the affected allocations are enumerated so the caller can shorten/transfer
 * them first. Active = state in (reserved, checked_in) AND range covers today.
 */
export async function setBedStatus(tenantId: string, bedId: string, status: string, actorId: string) {
  await requireBed(tenantId, bedId);
  const today = dateString();

  const active = await db
    .select({
      id: hostelAllocations.id,
      state: hostelAllocations.state,
      effectiveStartDate: hostelAllocations.effectiveStartDate,
      effectiveEndDate: hostelAllocations.effectiveEndDate,
    })
    .from(hostelAllocations)
    .where(and(
      eq(hostelAllocations.tenantId, tenantId),
      eq(hostelAllocations.bedId, bedId),
      sql`${hostelAllocations.state} IN ('reserved', 'checked_in')`,
      sql`${hostelAllocations.effectiveStartDate} <= ${today}`,
      sql`${hostelAllocations.effectiveEndDate} > ${today}`,
    ));

  if (status === 'out_of_service' && active.length > 0) {
    throw new ApiError(409, 'BED_HAS_ACTIVE_ALLOCATION',
      `Ce lit a ${active.length} affectation(s) active(s). Terminez-les ou transférez-les avant la mise hors service.`);
  }

  const row = firstRow(await db.update(hostelBeds)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(hostelBeds.id, bedId), eq(hostelBeds.tenantId, tenantId)))
    .returning());
  return row;
}

// ---------------------------------------------------------------------------
// Board read model (derived occupancy — never a stored counter)
// ---------------------------------------------------------------------------

export async function getBoard(tenantId: string, opts?: { hostelId?: string }): Promise<HostelBoard[]> {
  const hostelConds = [eq(hostels.tenantId, tenantId)];
  if (opts?.hostelId) hostelConds.push(eq(hostels.id, opts.hostelId));
  const hostelsList = await db.select().from(hostels).where(and(...hostelConds)).orderBy(asc(hostels.name));
  if (hostelsList.length === 0) return [];

  const hostelIds = hostelsList.map(h => h.id);

  const rooms = await db.select().from(hostelRooms).where(inArray(hostelRooms.hostelId, hostelIds));
  const zones = await db.select().from(hostelZones).where(inArray(hostelZones.hostelId, hostelIds));
  const categories = await db.select().from(hostelRoomCategories).where(eq(hostelRoomCategories.tenantId, tenantId));
  const roomIds = rooms.map(r => r.id);
  const beds = roomIds.length ? await db.select().from(hostelBeds).where(inArray(hostelBeds.roomId, roomIds)) : [];

  const bedIds = beds.map(b => b.id);
  const today = dateString();
  const allocations = bedIds.length
    ? await db
        .select({
          id: hostelAllocations.id,
          bedId: hostelAllocations.bedId,
          studentId: hostelAllocations.studentId,
          state: hostelAllocations.state,
          effectiveStartDate: hostelAllocations.effectiveStartDate,
          effectiveEndDate: hostelAllocations.effectiveEndDate,
          studentName: user.name,
        })
        .from(hostelAllocations)
        .leftJoin(user, eq(hostelAllocations.studentId, user.id))
        .where(and(
          eq(hostelAllocations.tenantId, tenantId),
          inArray(hostelAllocations.bedId, bedIds),
          sql`${hostelAllocations.state} IN ('reserved', 'checked_in')`,
          sql`${hostelAllocations.effectiveStartDate} <= ${today}`,
          sql`${hostelAllocations.effectiveEndDate} > ${today}`,
        ))
    : [];

  const zoneByName = new Map(zones.map(z => [z.id, z.name]));
  const catByCode = new Map(categories.map(c => [c.id, c.code]));

  const bedsByRoom = new Map<string, HostelBed[]>();
  for (const bed of beds) {
    const list = bedsByRoom.get(bed.roomId) ?? [];
    list.push(bed as HostelBed);
    bedsByRoom.set(bed.roomId, list);
  }

  const roomsByHostel = new Map<string, HostelRoom[]>();
  for (const room of rooms) {
    const list = roomsByHostel.get(room.hostelId) ?? [];
    list.push(room as HostelRoom);
    roomsByHostel.set(room.hostelId, list);
  }

  const allocByBed = new Map<string, typeof allocations>();
  for (const a of allocations) {
    const list = allocByBed.get(a.bedId) ?? [];
    list.push(a);
    allocByBed.set(a.bedId, list);
  }

  return hostelsList.map((hostel) => {
    const hostelRoomsList = roomsByHostel.get(hostel.id) ?? [];
    const roomOccupancies: RoomOccupancy[] = hostelRoomsList.map((room) => {
      const roomBeds = bedsByRoom.get(room.id) ?? [];
      const usableBeds = roomBeds.filter(b => b.status !== 'archived').length;
      let occupiedBeds = 0;
      let reservedBeds = 0;
      const bedOccupancies: BedOccupancy[] = roomBeds
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((bed) => {
          const active = (allocByBed.get(bed.id) ?? [])[0];
          let occ: BedOccupancy = {
            bed,
            allocationId: null,
            studentId: null,
            studentName: null,
            state: null,
          };
          if (active) {
            const state = active.state === 'checked_in' ? 'checked_in' : 'reserved';
            if (state === 'checked_in') occupiedBeds += 1;
            else reservedBeds += 1;
            occ = {
              bed,
              allocationId: active.id,
              studentId: active.studentId,
              studentName: active.studentName,
              state,
            };
          }
          return occ;
        });

      const occupancyRate = usableBeds > 0 ? occupiedBeds / usableBeds : 0;
      return {
        room,
        categoryCode: room.categoryId ? catByCode.get(room.categoryId) ?? null : null,
        zoneName: room.zoneId ? zoneByName.get(room.zoneId) ?? null : null,
        totalBeds: roomBeds.length,
        usableBeds,
        occupiedBeds,
        reservedBeds,
        availableBeds: Math.max(0, usableBeds - occupiedBeds - reservedBeds),
        occupancyRate,
        beds: bedOccupancies,
      };
    });

    const usableBeds = roomOccupancies.reduce((sum, r) => sum + r.usableBeds, 0);
    const occupiedBeds = roomOccupancies.reduce((sum, r) => sum + r.occupiedBeds, 0);
    const reservedBeds = roomOccupancies.reduce((sum, r) => sum + r.reservedBeds, 0);
    const totalBeds = roomOccupancies.reduce((sum, r) => sum + r.totalBeds, 0);

    return {
      hostelId: hostel.id,
      hostelCode: hostel.code,
      hostelName: hostel.name,
      status: hostel.status as HostelStatus,
      genderPolicy: hostel.genderPolicy as Hostel['genderPolicy'],
      capacity: usableBeds,
      totalBeds,
      usableBeds,
      occupiedBeds,
      reservedBeds,
      availableBeds: Math.max(0, usableBeds - occupiedBeds - reservedBeds),
      occupancyRate: usableBeds > 0 ? occupiedBeds / usableBeds : 0,
      rooms: roomOccupancies,
    };
  });
}
