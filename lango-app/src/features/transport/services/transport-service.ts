import { and, count, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  transportCrewAssignments,
  transportFareLinks,
  transportIncidents,
  transportIncidentActions,
  transportPolicies,
  transportRiderEvents,
  transportRoutes,
  transportRouteStops,
  transportRouteVersions,
  transportStops,
  transportStudentAllocations,
  transportTripRosterSnapshots,
  transportTrips,
  transportVehicleDocuments,
  transportVehicles,
} from '@/features/transport/models/transport-schema';
import {
  guardianStudents,
  guardians,
  user,
} from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';

// ---------------------------------------------------------------------------
// Pure Validation & Helper Logic (Unit Testable)
// ---------------------------------------------------------------------------

export function validateCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return true;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function calculateSegmentCapacity(
  vehicleCapacity: number,
  activeAllocations: number,
  marginPercent: number = 0,
): { available: number; maxAllowed: number; isOverbooked: boolean } {
  const maxAllowed = Math.floor(vehicleCapacity * (1 + marginPercent / 100));
  const available = Math.max(0, maxAllowed - activeAllocations);
  return {
    available,
    maxAllowed,
    isOverbooked: activeAllocations > maxAllowed,
  };
}

export function doTimeRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 < end2 && start2 < end1;
}

export function sanitizeDriverProfile<T extends Record<string, any>>(employee: T): { id: string; name: string | null; email: string | null; phone: string | null; role: string | null } {
  return {
    id: employee.id,
    name: employee.name ?? null,
    email: employee.email ?? null,
    phone: employee.phone ?? null,
    role: employee.role ?? null,
  };
}

export function sanitizeIncidentForSelfService<T extends Record<string, any>>(incident: T): Partial<T> {
  const {
    safeguardingRedactedNotes,
    assignedResponderUserId,
    internalNotes,
    ...publicIncident
  } = incident;
  return publicIncident as Partial<T>;
}

// ---------------------------------------------------------------------------
// Database Service Layer
// ---------------------------------------------------------------------------

export const TransportService = {
  // --- Vehicles ---
  async getVehicles(tenantId: string, branchId?: string) {
    const conditions = [eq(transportVehicles.tenantId, tenantId)];
    if (branchId) {
      conditions.push(eq(transportVehicles.branchId, branchId));
    }
    return db
      .select()
      .from(transportVehicles)
      .where(and(...conditions))
      .orderBy(transportVehicles.vehicleCode);
  },

  async getVehicleById(tenantId: string, vehicleId: string) {
    const [row] = await db
      .select()
      .from(transportVehicles)
      .where(and(eq(transportVehicles.id, vehicleId), eq(transportVehicles.tenantId, tenantId)))
      .limit(1);
    return row || null;
  },

  async createVehicle(tenantId: string, data: any) {
    if (data.capacity !== undefined && Number(data.capacity) <= 0) {
      throw new ApiError(400, 'INVALID_CAPACITY', 'La capacité du véhicule doit être strictement positive.');
    }

    const [existingCode] = await db
      .select({ id: transportVehicles.id })
      .from(transportVehicles)
      .where(
        and(
          eq(transportVehicles.tenantId, tenantId),
          eq(transportVehicles.vehicleCode, data.vehicleCode),
        ),
      )
      .limit(1);

    if (existingCode) {
      throw new ApiError(409, 'DUPLICATE_VEHICLE_CODE', 'Un véhicule avec ce code existe déjà.');
    }

    const [vehicle] = await db
      .insert(transportVehicles)
      .values({
        tenantId,
        branchId: data.branchId || null,
        vehicleCode: data.vehicleCode,
        registrationNumber: data.registrationNumber,
        capacity: data.capacity,
        vehicleType: data.vehicleType || 'bus',
        makeModel: data.makeModel || null,
        status: data.status || 'active',
        insuranceExpiry: data.insuranceExpiry || null,
        inspectionExpiry: data.inspectionExpiry || null,
      })
      .returning();

    if (!vehicle) {
      throw new ApiError(500, 'VEHICLE_CREATION_FAILED', 'Erreur lors de la création du véhicule.');
    }

    return vehicle;
  },

  async updateVehicle(tenantId: string, vehicleId: string, data: any) {
    const existing = await this.getVehicleById(tenantId, vehicleId);
    if (!existing) {
      throw new ApiError(404, 'VEHICLE_NOT_FOUND', 'Véhicule introuvable.');
    }

    if (data.capacity !== undefined && Number(data.capacity) <= 0) {
      throw new ApiError(400, 'INVALID_CAPACITY', 'La capacité du véhicule doit être strictement positive.');
    }

    const [updated] = await db
      .update(transportVehicles)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transportVehicles.id, vehicleId), eq(transportVehicles.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ApiError(500, 'VEHICLE_UPDATE_FAILED', 'Erreur lors de la mise à jour du véhicule.');
    }

    return updated;
  },

  async deleteVehicle(tenantId: string, vehicleId: string) {
    const existing = await this.getVehicleById(tenantId, vehicleId);
    if (!existing) {
      throw new ApiError(404, 'VEHICLE_NOT_FOUND', 'Véhicule introuvable.');
    }

    // Lifecycle Preservation Check: Archive instead of hard-delete if referenced in routes or trips
    const [assignedRoute] = await db
      .select({ id: transportRoutes.id })
      .from(transportRoutes)
      .where(and(eq(transportRoutes.tenantId, tenantId), eq(transportRoutes.assignedVehicleId, vehicleId)))
      .limit(1);

    const [assignedTrip] = await db
      .select({ id: transportTrips.id })
      .from(transportTrips)
      .where(and(eq(transportTrips.tenantId, tenantId), eq(transportTrips.vehicleId, vehicleId)))
      .limit(1);

    if (assignedRoute || assignedTrip) {
      const [archived] = await db
        .update(transportVehicles)
        .set({ status: 'retired', updatedAt: new Date().toISOString() })
        .where(and(eq(transportVehicles.id, vehicleId), eq(transportVehicles.tenantId, tenantId)))
        .returning();
      return { success: true, archived: true, vehicle: archived };
    }

    await db
      .delete(transportVehicles)
      .where(and(eq(transportVehicles.id, vehicleId), eq(transportVehicles.tenantId, tenantId)));

    return { success: true };
  },

  // --- Drivers & Crew ---
  async getDrivers(tenantId: string) {
    const staffMembers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      })
      .from(user)
      .where(
        and(
          eq(user.tenantId, tenantId as any),
          inArray(user.role, ['teacher' as any, 'guard' as any, 'receptionist' as any, 'school_admin' as any]),
        ),
      );

    return staffMembers.map(s => sanitizeDriverProfile(s));
  },

  // --- Stops ---
  async getStops(tenantId: string, branchId?: string) {
    const conditions = [eq(transportStops.tenantId, tenantId)];
    if (branchId) {
      conditions.push(eq(transportStops.branchId, branchId));
    }
    return db
      .select()
      .from(transportStops)
      .where(and(...conditions))
      .orderBy(transportStops.stopCode);
  },

  async getStopById(tenantId: string, stopId: string) {
    const [stop] = await db
      .select()
      .from(transportStops)
      .where(and(eq(transportStops.id, stopId), eq(transportStops.tenantId, tenantId)))
      .limit(1);
    return stop || null;
  },

  async createStop(tenantId: string, data: any) {
    if (!validateCoordinates(data.latitude, data.longitude)) {
      throw new ApiError(400, 'INVALID_COORDINATES', 'Les coordonnées latitude/longitude sont invalides.');
    }
    if (data.geofenceRadiusMeters !== undefined && Number(data.geofenceRadiusMeters) <= 0) {
      throw new ApiError(400, 'INVALID_GEOFENCE', 'Le rayon de géorepérage doit être strictement positif.');
    }

    const [created] = await db
      .insert(transportStops)
      .values({
        tenantId,
        branchId: data.branchId || null,
        stopCode: data.stopCode,
        stopName: data.stopName,
        address: data.address || null,
        latitude: data.latitude !== undefined && data.latitude !== null ? String(data.latitude) : null,
        longitude: data.longitude !== undefined && data.longitude !== null ? String(data.longitude) : null,
        geofenceRadiusMeters: data.geofenceRadiusMeters || 50,
        status: data.status || 'active',
        accessibilityNotes: data.notes || null,
      })
      .returning();

    if (!created) {
      throw new ApiError(500, 'STOP_CREATION_FAILED', 'Erreur lors de la création de l\'arrêt.');
    }

    return created;
  },

  async updateStop(tenantId: string, stopId: string, data: any) {
    const existing = await this.getStopById(tenantId, stopId);
    if (!existing) {
      throw new ApiError(404, 'STOP_NOT_FOUND', 'Arrêt introuvable.');
    }

    if (data.latitude !== undefined || data.longitude !== undefined) {
      const lat = data.latitude !== undefined ? data.latitude : existing.latitude;
      const lng = data.longitude !== undefined ? data.longitude : existing.longitude;
      if (!validateCoordinates(lat, lng)) {
        throw new ApiError(400, 'INVALID_COORDINATES', 'Les coordonnées latitude/longitude sont invalides.');
      }
    }

    const [updated] = await db
      .update(transportStops)
      .set({
        ...data,
        latitude: data.latitude !== undefined && data.latitude !== null ? String(data.latitude) : existing.latitude,
        longitude: data.longitude !== undefined && data.longitude !== null ? String(data.longitude) : existing.longitude,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transportStops.id, stopId), eq(transportStops.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ApiError(500, 'STOP_UPDATE_FAILED', 'Erreur lors de la mise à jour de l\'arrêt.');
    }

    return updated;
  },

  async deleteStop(tenantId: string, stopId: string) {
    const existing = await this.getStopById(tenantId, stopId);
    if (!existing) {
      throw new ApiError(404, 'STOP_NOT_FOUND', 'Arrêt introuvable.');
    }

    await db
      .delete(transportStops)
      .where(and(eq(transportStops.id, stopId), eq(transportStops.tenantId, tenantId)));

    return { success: true };
  },

  // --- Routes & Route Versioning ---
  async getRoutes(tenantId: string, branchId?: string) {
    const conditions = [eq(transportRoutes.tenantId, tenantId)];
    if (branchId) {
      conditions.push(eq(transportRoutes.branchId, branchId));
    }
    return db
      .select()
      .from(transportRoutes)
      .where(and(...conditions))
      .orderBy(transportRoutes.routeCode);
  },

  async getRouteById(tenantId: string, routeId: string) {
    const [route] = await db
      .select()
      .from(transportRoutes)
      .where(and(eq(transportRoutes.id, routeId), eq(transportRoutes.tenantId, tenantId)))
      .limit(1);

    if (!route) return null;

    let stops: any[] = [];
    if (route.activeVersionId) {
      stops = await db
        .select({
          id: transportRouteStops.id,
          stopId: transportRouteStops.stopId,
          stopSequence: transportRouteStops.stopSequence,
          plannedArrivalTime: transportRouteStops.plannedArrivalTime,
          plannedDepartureTime: transportRouteStops.plannedDepartureTime,
          pickupAllowed: transportRouteStops.pickupAllowed,
          dropoffAllowed: transportRouteStops.dropoffAllowed,
          stopName: transportStops.stopName,
          stopCode: transportStops.stopCode,
        })
        .from(transportRouteStops)
        .innerJoin(transportStops, eq(transportRouteStops.stopId, transportStops.id))
        .where(
          and(
            eq(transportRouteStops.tenantId, tenantId),
            eq(transportRouteStops.versionId, route.activeVersionId),
          ),
        )
        .orderBy(transportRouteStops.stopSequence);
    }

    return { ...route, stops };
  },

  async createRoute(tenantId: string, data: any) {
    // Validate Route Stops Invariants if provided
    if (Array.isArray(data.stops) && data.stops.length > 0) {
      if (data.stops.length < 2) {
        throw new ApiError(400, 'INVALID_ROUTE_STOPS', 'Un itinéraire doit comporter au moins 2 arrêts.');
      }
      for (let i = 0; i < data.stops.length; i++) {
        const s = data.stops[i];
        if (!s.stopId) {
          throw new ApiError(400, 'MISSING_STOP_ID', `L'arrêt à l'index ${i} est incomplet.`);
        }
      }
    }

    // Atomic Creation Transaction
    return db.transaction(async (tx) => {
      const [createdRoute] = await tx
        .insert(transportRoutes)
        .values({
          tenantId,
          branchId: data.branchId || null,
          routeCode: data.routeCode,
          routeName: data.routeName,
          serviceDirection: data.serviceDirection || 'bidirectional',
          assignedVehicleId: data.assignedVehicleId || null,
          status: data.status || 'active',
        })
        .returning();

      if (!createdRoute) {
        throw new ApiError(500, 'ROUTE_CREATION_FAILED', 'Erreur lors de la création de la ligne.');
      }

      const [version] = await tx
        .insert(transportRouteVersions)
        .values({
          tenantId,
          routeId: createdRoute.id,
          versionNumber: 1,
          effectiveStartDate: data.effectiveStartDate || new Date().toISOString().split('T')[0]!,
          distanceKm: data.distanceKm !== undefined ? String(data.distanceKm) : null,
          durationMinutes: data.durationMinutes || null,
          status: 'published',
        })
        .returning();

      if (!version) {
        throw new ApiError(500, 'VERSION_CREATION_FAILED', 'Erreur lors de la création de la version de ligne.');
      }

      if (Array.isArray(data.stops) && data.stops.length > 0) {
        for (let i = 0; i < data.stops.length; i++) {
          const s = data.stops[i];
          const [stop] = await tx
            .select()
            .from(transportStops)
            .where(and(eq(transportStops.id, s.stopId), eq(transportStops.tenantId, tenantId)))
            .limit(1);

          if (!stop) {
            throw new ApiError(404, 'STOP_NOT_FOUND', `L'arrêt ${s.stopId} est introuvable.`);
          }
          await tx.insert(transportRouteStops).values({
            tenantId,
            versionId: version.id,
            stopId: s.stopId,
            stopSequence: i + 1,
            plannedArrivalTime: s.plannedArrivalTime || null,
            plannedDepartureTime: s.plannedDepartureTime || null,
            dwellTimeSeconds: s.dwellTimeSeconds || 60,
            pickupAllowed: s.pickupAllowed !== undefined ? s.pickupAllowed : true,
            dropoffAllowed: s.dropoffAllowed !== undefined ? s.dropoffAllowed : true,
          });
        }
      }

      const [updatedRoute] = await tx
        .update(transportRoutes)
        .set({ activeVersionId: version.id })
        .where(and(eq(transportRoutes.id, createdRoute.id), eq(transportRoutes.tenantId, tenantId)))
        .returning();

      if (!updatedRoute) {
        throw new ApiError(500, 'ROUTE_UPDATE_FAILED', 'Erreur lors de la liaison de la version.');
      }

      let stops: any[] = [];
      if (updatedRoute.activeVersionId) {
        stops = await tx
          .select({
            id: transportRouteStops.id,
            stopId: transportRouteStops.stopId,
            stopSequence: transportRouteStops.stopSequence,
            plannedArrivalTime: transportRouteStops.plannedArrivalTime,
            plannedDepartureTime: transportRouteStops.plannedDepartureTime,
            pickupAllowed: transportRouteStops.pickupAllowed,
            dropoffAllowed: transportRouteStops.dropoffAllowed,
            stopName: transportStops.stopName,
            stopCode: transportStops.stopCode,
          })
          .from(transportRouteStops)
          .innerJoin(transportStops, eq(transportRouteStops.stopId, transportStops.id))
          .where(
            and(
              eq(transportRouteStops.tenantId, tenantId),
              eq(transportRouteStops.versionId, updatedRoute.activeVersionId),
            ),
          )
          .orderBy(transportRouteStops.stopSequence);
      }

      return { ...updatedRoute, stops };
    });
  },

  async updateRoute(tenantId: string, routeId: string, data: any) {
    const existing = await this.getRouteById(tenantId, routeId);
    if (!existing) {
      throw new ApiError(404, 'ROUTE_NOT_FOUND', 'Itinéraire introuvable.');
    }

    const [updated] = await db
      .update(transportRoutes)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(transportRoutes.id, routeId), eq(transportRoutes.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ApiError(500, 'ROUTE_UPDATE_FAILED', 'Erreur lors de la mise à jour de l\'itinéraire.');
    }

    return updated;
  },

  async deleteRoute(tenantId: string, routeId: string) {
    const existing = await this.getRouteById(tenantId, routeId);
    if (!existing) {
      throw new ApiError(404, 'ROUTE_NOT_FOUND', 'Itinéraire introuvable.');
    }

    // Lifecycle Preservation Check: Archive instead of hard-delete if referenced in allocations or trips
    const [hasAllocations] = await db
      .select({ id: transportStudentAllocations.id })
      .from(transportStudentAllocations)
      .where(and(eq(transportStudentAllocations.tenantId, tenantId), eq(transportStudentAllocations.routeId, routeId)))
      .limit(1);

    const [hasTrips] = await db
      .select({ id: transportTrips.id })
      .from(transportTrips)
      .where(and(eq(transportTrips.tenantId, tenantId), eq(transportTrips.routeId, routeId)))
      .limit(1);

    if (hasAllocations || hasTrips) {
      const [archived] = await db
        .update(transportRoutes)
        .set({ status: 'archived', updatedAt: new Date().toISOString() })
        .where(and(eq(transportRoutes.id, routeId), eq(transportRoutes.tenantId, tenantId)))
        .returning();
      return { success: true, archived: true, route: archived };
    }

    await db
      .delete(transportRoutes)
      .where(and(eq(transportRoutes.id, routeId), eq(transportRoutes.tenantId, tenantId)));

    return { success: true };
  },

  // --- Student Allocations ---
  async getAllocations(tenantId: string, options?: { studentId?: string; routeId?: string; status?: string }) {
    const conditions = [eq(transportStudentAllocations.tenantId, tenantId)];
    if (options?.studentId) {
      conditions.push(eq(transportStudentAllocations.studentId, options.studentId));
    }
    if (options?.routeId) {
      conditions.push(eq(transportStudentAllocations.routeId, options.routeId));
    }
    if (options?.status) {
      conditions.push(eq(transportStudentAllocations.status, options.status as any));
    }

    const rows = await db
      .select({
        allocation: transportStudentAllocations,
        student: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        route: {
          id: transportRoutes.id,
          routeName: transportRoutes.routeName,
          routeCode: transportRoutes.routeCode,
        },
      })
      .from(transportStudentAllocations)
      .innerJoin(user, and(eq(transportStudentAllocations.studentId, user.id), eq(user.tenantId, tenantId as any)))
      .innerJoin(transportRoutes, and(eq(transportStudentAllocations.routeId, transportRoutes.id), eq(transportRoutes.tenantId, tenantId)))
      .where(and(...conditions))
      .orderBy(transportStudentAllocations.createdAt);

    return rows;
  },

  async allocateStudent(tenantId: string, data: any) {
    // Centralized Invariants & Atomic Segment Capacity Check
    return db.transaction(async (tx) => {
      // 1. Verify Student exists in tenant
      const [student] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, data.studentId), eq(user.tenantId, tenantId as any)))
        .limit(1);

      if (!student) {
        throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable dans cet établissement.');
      }

      // 2. Verify Route exists in tenant & lock row for concurrent capacity check
      const [route] = await tx
        .select()
        .from(transportRoutes)
        .where(and(eq(transportRoutes.id, data.routeId), eq(transportRoutes.tenantId, tenantId)))
        .limit(1)
        .for('update');

      if (!route) {
        throw new ApiError(404, 'ROUTE_NOT_FOUND', 'Itinéraire introuvable dans cet établissement.');
      }

      if (!route.activeVersionId) {
        throw new ApiError(400, 'NO_ACTIVE_ROUTE_VERSION', 'L\'itinéraire n\'a pas de version active publiée.');
      }

      // 3. Centralized Invariants: Verify Stops and Stop Sequence Ordering
      const versionStops = await tx
        .select()
        .from(transportRouteStops)
        .where(
          and(
            eq(transportRouteStops.tenantId, tenantId),
            eq(transportRouteStops.versionId, route.activeVersionId),
          ),
        )
        .orderBy(transportRouteStops.stopSequence);

      const pickupStop = versionStops.find(s => s.stopId === data.pickupStopId);
      const dropoffStop = versionStops.find(s => s.stopId === data.dropoffStopId);

      if (!pickupStop) {
        throw new ApiError(400, 'INVALID_PICKUP_STOP', 'L\'arrêt de prise en charge n\'appartient pas à l\'itinéraire.');
      }
      if (!dropoffStop) {
        throw new ApiError(400, 'INVALID_DROPOFF_STOP', 'L\'arrêt de dépose n\'appartient pas à l\'itinéraire.');
      }
      if (pickupStop.pickupAllowed === false) {
        throw new ApiError(400, 'PICKUP_NOT_ALLOWED', 'La prise en charge n\'est pas autorisée à cet arrêt.');
      }
      if (dropoffStop.dropoffAllowed === false) {
        throw new ApiError(400, 'DROPOFF_NOT_ALLOWED', 'La dépose n\'est pas autorisée à cet arrêt.');
      }
      if (pickupStop.stopSequence >= dropoffStop.stopSequence) {
        throw new ApiError(400, 'INVALID_STOP_SEQUENCE', 'L\'arrêt de prise en charge doit précéder l\'arrêt de dépose.');
      }

      // 4. Overlap Check for existing active student allocations
      const direction = data.direction || 'morning';
      const activeStudentAllocations = await tx
        .select()
        .from(transportStudentAllocations)
        .where(
          and(
            eq(transportStudentAllocations.tenantId, tenantId),
            eq(transportStudentAllocations.studentId, data.studentId),
            eq(transportStudentAllocations.status, 'active'),
          ),
        );

      const hasConflict = activeStudentAllocations.some((alloc) => {
        if (alloc.direction === 'both' || direction === 'both' || alloc.direction === direction) {
          const start1 = alloc.effectiveStartDate;
          const end1 = alloc.effectiveEndDate || '9999-12-31';
          const start2 = data.effectiveStartDate || new Date().toISOString().split('T')[0]!;
          const end2 = data.effectiveEndDate || '9999-12-31';
          return doTimeRangesOverlap(start1, end1, start2, end2);
        }
        return false;
      });

      if (hasConflict) {
        throw new ApiError(409, 'OVERLAPPING_ALLOCATION', 'L\'élève a déjà une affectation active pour cette période.');
      }

      // 5. Interval Segment Capacity Check (P1-1)
      const allocStatus = data.status || 'active';
      if (allocStatus === 'active' && route.assignedVehicleId) {
        const [vehicle] = await tx
          .select()
          .from(transportVehicles)
          .where(and(eq(transportVehicles.id, route.assignedVehicleId), eq(transportVehicles.tenantId, tenantId)))
          .limit(1)
          .for('update');

        if (vehicle) {
          const routeAllocations = await tx
            .select()
            .from(transportStudentAllocations)
            .where(
              and(
                eq(transportStudentAllocations.tenantId, tenantId),
                eq(transportStudentAllocations.routeId, data.routeId),
                eq(transportStudentAllocations.status, 'active'),
              ),
            );

          // Calculate peak occupancy across the specific requested stop sequence intervals
          const reqPickupSeq = pickupStop.stopSequence;
          const reqDropoffSeq = dropoffStop.stopSequence;

          for (let seg = reqPickupSeq; seg < reqDropoffSeq; seg++) {
            let activeOnSegment = 0;
            for (const alloc of routeAllocations) {
              const allocPickup = versionStops.find(s => s.stopId === alloc.pickupStopId);
              const allocDropoff = versionStops.find(s => s.stopId === alloc.dropoffStopId);
              const pSeq = allocPickup ? allocPickup.stopSequence : 1;
              const dSeq = allocDropoff ? allocDropoff.stopSequence : versionStops.length;

              if (pSeq <= seg && dSeq > seg) {
                activeOnSegment++;
              }
            }

            const { isOverbooked } = calculateSegmentCapacity(vehicle.capacity, activeOnSegment + 1);
            if (isOverbooked) {
              throw new ApiError(409, 'CAPACITY_EXCEEDED', 'La capacité maximale du véhicule pour cet itinéraire est atteinte.');
            }
          }
        }
      }

      // 6. Commit Allocation inside Transaction
      const [created] = await tx
        .insert(transportStudentAllocations)
        .values({
          tenantId,
          studentId: data.studentId,
          routeId: data.routeId,
          pickupStopId: data.pickupStopId,
          dropoffStopId: data.dropoffStopId,
          direction,
          effectiveStartDate: data.effectiveStartDate || new Date().toISOString().split('T')[0]!,
          effectiveEndDate: data.effectiveEndDate || null,
          serviceDays: data.serviceDays || null,
          assistanceNotes: data.assistanceNotes || null,
          status: data.status || 'active',
          fareReferenceId: data.fareReferenceId || null,
        })
        .returning();

      if (!created) {
        throw new ApiError(500, 'ALLOCATION_FAILED', 'Erreur lors de la création de l\'affectation.');
      }

      return created;
    });
  },

  async updateAllocation(tenantId: string, id: string, data: any) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(transportStudentAllocations)
        .where(and(eq(transportStudentAllocations.id, id), eq(transportStudentAllocations.tenantId, tenantId)))
        .limit(1)
        .for('update');

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Affectation introuvable.');
      }

      const targetStatus = data.status ?? existing.status;
      const targetRouteId = data.routeId ?? existing.routeId;
      const targetPickupStopId = data.pickupStopId ?? existing.pickupStopId;
      const targetDropoffStopId = data.dropoffStopId ?? existing.dropoffStopId;
      const targetStartDate = data.effectiveStartDate ?? existing.effectiveStartDate;
      const targetEndDate = data.effectiveEndDate !== undefined ? data.effectiveEndDate : existing.effectiveEndDate;
      const targetDirection = data.direction ?? existing.direction;

      if (targetStatus === 'active') {
        const [route] = await tx
          .select()
          .from(transportRoutes)
          .where(and(eq(transportRoutes.id, targetRouteId), eq(transportRoutes.tenantId, tenantId)))
          .limit(1)
          .for('update');

        if (!route) {
          throw new ApiError(404, 'ROUTE_NOT_FOUND', 'Itinéraire introuvable dans cet établissement.');
        }
        if (!route.activeVersionId) {
          throw new ApiError(400, 'NO_ACTIVE_ROUTE_VERSION', 'L\'itinéraire n\'a pas de version active publiée.');
        }

        const versionStops = await tx
          .select()
          .from(transportRouteStops)
          .where(
            and(
              eq(transportRouteStops.tenantId, tenantId),
              eq(transportRouteStops.versionId, route.activeVersionId),
            ),
          )
          .orderBy(transportRouteStops.stopSequence);

        const pickupStop = versionStops.find(s => s.stopId === targetPickupStopId);
        const dropoffStop = versionStops.find(s => s.stopId === targetDropoffStopId);

        if (!pickupStop) {
          throw new ApiError(400, 'INVALID_PICKUP_STOP', 'L\'arrêt de prise en charge n\'appartient pas à l\'itinéraire.');
        }
        if (!dropoffStop) {
          throw new ApiError(400, 'INVALID_DROPOFF_STOP', 'L\'arrêt de dépose n\'appartient pas à l\'itinéraire.');
        }
        if (pickupStop.pickupAllowed === false) {
          throw new ApiError(400, 'PICKUP_NOT_ALLOWED', 'La prise en charge n\'est pas autorisée à cet arrêt.');
        }
        if (dropoffStop.dropoffAllowed === false) {
          throw new ApiError(400, 'DROPOFF_NOT_ALLOWED', 'La dépose n\'est pas autorisée à cet arrêt.');
        }
        if (pickupStop.stopSequence >= dropoffStop.stopSequence) {
          throw new ApiError(400, 'INVALID_STOP_SEQUENCE', 'L\'arrêt de prise en charge doit précéder l\'arrêt de dépose.');
        }

        const activeStudentAllocations = await tx
          .select()
          .from(transportStudentAllocations)
          .where(
            and(
              eq(transportStudentAllocations.tenantId, tenantId),
              eq(transportStudentAllocations.studentId, existing.studentId),
              eq(transportStudentAllocations.status, 'active'),
            ),
          );

        const hasConflict = activeStudentAllocations.some((alloc) => {
          if (alloc.id === id) return false;
          if (alloc.direction === 'both' || targetDirection === 'both' || alloc.direction === targetDirection) {
            const start1 = alloc.effectiveStartDate;
            const end1 = alloc.effectiveEndDate || '9999-12-31';
            const start2 = targetStartDate;
            const end2 = targetEndDate || '9999-12-31';
            return doTimeRangesOverlap(start1, end1, start2, end2);
          }
          return false;
        });

        if (hasConflict) {
          throw new ApiError(409, 'OVERLAPPING_ALLOCATION', 'L\'élève a déjà une affectation active pour cette période.');
        }

        if (route.assignedVehicleId) {
          const [vehicle] = await tx
            .select()
            .from(transportVehicles)
            .where(and(eq(transportVehicles.id, route.assignedVehicleId), eq(transportVehicles.tenantId, tenantId)))
            .limit(1)
            .for('update');

          if (vehicle) {
            const routeAllocations = await tx
              .select()
              .from(transportStudentAllocations)
              .where(
                and(
                  eq(transportStudentAllocations.tenantId, tenantId),
                  eq(transportStudentAllocations.routeId, targetRouteId),
                  eq(transportStudentAllocations.status, 'active'),
                ),
              );

            const reqPickupSeq = pickupStop.stopSequence;
            const reqDropoffSeq = dropoffStop.stopSequence;

            for (let seg = reqPickupSeq; seg < reqDropoffSeq; seg++) {
              let activeOnSegment = 0;
              for (const alloc of routeAllocations) {
                if (alloc.id === id && existing.status === 'active') {
                  continue;
                }
                const allocPickup = versionStops.find(s => s.stopId === alloc.pickupStopId);
                const allocDropoff = versionStops.find(s => s.stopId === alloc.dropoffStopId);
                const pSeq = allocPickup ? allocPickup.stopSequence : 1;
                const dSeq = allocDropoff ? allocDropoff.stopSequence : versionStops.length;

                if (pSeq <= seg && dSeq > seg) {
                  activeOnSegment++;
                }
              }

              const { isOverbooked } = calculateSegmentCapacity(vehicle.capacity, activeOnSegment + 1);
              if (isOverbooked) {
                throw new ApiError(409, 'CAPACITY_EXCEEDED', 'La capacité maximale du véhicule pour cet itinéraire est atteinte.');
              }
            }
          }
        }
      }

      const [updated] = await tx
        .update(transportStudentAllocations)
        .set({
          ...data,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(transportStudentAllocations.id, id), eq(transportStudentAllocations.tenantId, tenantId)))
        .returning();

      return updated;
    });
  },

  // --- Trips ---
  async getTrips(tenantId: string, options?: { date?: string; branchId?: string }) {
    const conditions = [eq(transportTrips.tenantId, tenantId)];
    if (options?.date) {
      conditions.push(eq(transportTrips.serviceDate, options.date));
    }
    if (options?.branchId) {
      conditions.push(eq(transportTrips.branchId, options.branchId));
    }
    const rows = await db
      .select({
        trip: transportTrips,
        route: {
          routeName: transportRoutes.routeName,
          routeCode: transportRoutes.routeCode,
        },
        vehicle: {
          vehicleCode: transportVehicles.vehicleCode,
          registrationNumber: transportVehicles.registrationNumber,
        },
      })
      .from(transportTrips)
      .innerJoin(transportRoutes, and(eq(transportTrips.routeId, transportRoutes.id), eq(transportRoutes.tenantId, tenantId)))
      .leftJoin(transportVehicles, and(eq(transportTrips.vehicleId, transportVehicles.id), eq(transportVehicles.tenantId, tenantId)))
      .where(and(...conditions))
      .orderBy(transportTrips.serviceDate, transportTrips.plannedStartTime);

    return rows;
  },

  async generateTrip(tenantId: string, data: any) {
    return db.transaction(async (tx) => {
      const [route] = await tx
        .select()
        .from(transportRoutes)
        .where(and(eq(transportRoutes.id, data.routeId), eq(transportRoutes.tenantId, tenantId)))
        .limit(1);

      if (!route || !route.activeVersionId) {
        throw new ApiError(400, 'NO_ACTIVE_ROUTE_VERSION', 'L\'itinéraire n\'a pas de version active publiée.');
      }

      const serviceDate = data.serviceDate || new Date().toISOString().split('T')[0]!;
      const direction = data.direction || 'pickup';

      const [existingTrip] = await tx
        .select({ id: transportTrips.id, status: transportTrips.status })
        .from(transportTrips)
        .where(
          and(
            eq(transportTrips.tenantId, tenantId),
            eq(transportTrips.routeId, data.routeId),
            eq(transportTrips.serviceDate, serviceDate),
            eq(transportTrips.direction, direction),
          ),
        )
        .limit(1);

      if (existingTrip && existingTrip.status !== 'cancelled') {
        throw new ApiError(409, 'TRIP_ALREADY_EXISTS', 'Un trajet existe déjà pour cet itinéraire, cette date et cette direction.');
      }

      const vehicleId = data.vehicleId || route.assignedVehicleId;

      const [trip] = await tx
        .insert(transportTrips)
        .values({
          tenantId,
          branchId: route.branchId || null,
          routeId: data.routeId,
          routeVersionId: route.activeVersionId,
          serviceDate,
          direction,
          plannedStartTime: data.plannedStartTime || null,
          plannedEndTime: data.plannedEndTime || null,
          vehicleId: vehicleId || null,
          driverId: data.driverId || null,
          attendantId: data.attendantId || null,
          status: 'scheduled',
        })
        .returning();

      if (!trip) {
        throw new ApiError(500, 'TRIP_CREATION_FAILED', 'Erreur lors de la création du trajet.');
      }

      const allocations = await tx
        .select()
        .from(transportStudentAllocations)
        .where(
          and(
            eq(transportStudentAllocations.tenantId, tenantId),
            eq(transportStudentAllocations.routeId, data.routeId),
            eq(transportStudentAllocations.status, 'active'),
            lte(transportStudentAllocations.effectiveStartDate, serviceDate),
            or(
              sql`${transportStudentAllocations.effectiveEndDate} IS NULL`,
              gte(transportStudentAllocations.effectiveEndDate, serviceDate),
            ),
          ),
        );

      for (const alloc of allocations) {
        if (alloc.direction === 'both' || alloc.direction === direction || (direction === 'pickup' && alloc.direction === 'morning') || (direction === 'dropoff' && alloc.direction === 'afternoon')) {
          await tx.insert(transportTripRosterSnapshots).values({
            tenantId,
            tripId: trip.id,
            studentId: alloc.studentId,
            pickupStopId: alloc.pickupStopId,
            dropoffStopId: alloc.dropoffStopId,
            direction: alloc.direction,
            allocatedStatus: 'allocated',
          });
        }
      }

      return trip;
    });
  },

  async startTrip(tenantId: string, tripId: string) {
    const [updated] = await db
      .update(transportTrips)
      .set({
        status: 'in_progress',
        actualStartTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(transportTrips.id, tripId),
          eq(transportTrips.tenantId, tenantId),
          eq(transportTrips.status, 'scheduled'),
        ),
      )
      .returning();

    if (!updated) {
      throw new ApiError(400, 'INVALID_TRIP_STATE', 'Le trajet ne peut pas être démarré (introuvable ou non programmé).');
    }

    return updated;
  },

  async completeTrip(tenantId: string, tripId: string) {
    const [updated] = await db
      .update(transportTrips)
      .set({
        status: 'completed',
        actualEndTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(transportTrips.id, tripId),
          eq(transportTrips.tenantId, tenantId),
          eq(transportTrips.status, 'in_progress'),
        ),
      )
      .returning();

    if (!updated) {
      throw new ApiError(400, 'INVALID_TRIP_STATE', 'Le trajet ne peut pas être clôturé (introuvable ou non en cours).');
    }

    return updated;
  },

  // --- Boarding Evidence ---
  async recordRiderEvent(tenantId: string, data: any) {
    if (data.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(transportRiderEvents)
        .where(
          and(
            eq(transportRiderEvents.tenantId, tenantId),
            eq(transportRiderEvents.idempotencyKey, data.idempotencyKey),
          ),
        )
        .limit(1);

      if (existing) {
        const matchesPayload =
          existing.tripId === data.tripId &&
          existing.studentId === data.studentId &&
          existing.stopId === data.stopId &&
          existing.eventType === data.eventType;

        if (!matchesPayload) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Un pointage différent existe déjà avec cette clé d\'idempotence.');
        }
        return existing;
      }
    }

    try {
      return await db.transaction(async (tx) => {
        // 1. Rider Event Trip State Transition Check (P1-7)
        const [trip] = await tx
          .select({ status: transportTrips.status, routeVersionId: transportTrips.routeVersionId })
          .from(transportTrips)
          .where(and(eq(transportTrips.id, data.tripId), eq(transportTrips.tenantId, tenantId)))
          .limit(1);

        if (!trip) {
          throw new ApiError(404, 'TRIP_NOT_FOUND', 'Trajet introuvable.');
        }

        if (trip.status !== 'boarding' && trip.status !== 'in_progress') {
          throw new ApiError(400, 'INVALID_TRIP_STATE', 'Les pointages ne sont autorisés que pendant un trajet en cours ou en cours d\'embarquement.');
        }

        // 2. Operational Stop Check: Stop must belong to Trip Route Version
        const [routeStop] = await tx
          .select({ id: transportRouteStops.id })
          .from(transportRouteStops)
          .where(
            and(
              eq(transportRouteStops.tenantId, tenantId),
              eq(transportRouteStops.versionId, trip.routeVersionId),
              eq(transportRouteStops.stopId, data.stopId),
            ),
          )
          .limit(1);

        if (!routeStop) {
          throw new ApiError(400, 'STOP_NOT_IN_ROUTE', 'L\'arrêt ne fait pas partie de l\'itinéraire de ce trajet.');
        }

        // 3. Check Roster Membership
        const [rosterEntry] = await tx
          .select()
          .from(transportTripRosterSnapshots)
          .where(
            and(
              eq(transportTripRosterSnapshots.tenantId, tenantId),
              eq(transportTripRosterSnapshots.tripId, data.tripId),
              eq(transportTripRosterSnapshots.studentId, data.studentId),
            ),
          )
          .limit(1);

        if (!rosterEntry) {
          throw new ApiError(422, 'NOT_ON_ROSTER', 'L\'élève ne figure pas sur la liste des passagers de ce trajet.');
        }

        // 4. Alighted (Dropoff) before Boarding check (P0-2 & Vocabulary Harmonization)
        if (data.eventType === 'alighted') {
          const [boardedEvent] = await tx
            .select()
            .from(transportRiderEvents)
            .where(
              and(
                eq(transportRiderEvents.tenantId, tenantId),
                eq(transportRiderEvents.tripId, data.tripId),
                eq(transportRiderEvents.studentId, data.studentId),
                eq(transportRiderEvents.eventType, 'boarded'),
              ),
            )
            .limit(1);

          if (!boardedEvent && !data.exceptionReason) {
            throw new ApiError(400, 'DROPOFF_BEFORE_BOARDING', 'Une descente ne peut pas être enregistrée avant la montée sans dérogation motivée.');
          }
        }

        // 5. Insert Rider Event
        const [recorded] = await tx
          .insert(transportRiderEvents)
          .values({
            tenantId,
            tripId: data.tripId,
            studentId: data.studentId,
            stopId: data.stopId,
            eventType: data.eventType,
            verificationMethod: data.verificationMethod || 'qr_scan',
            actorUserId: data.actorUserId,
            deviceId: data.deviceId || null,
            exceptionReason: data.exceptionReason || null,
            idempotencyKey: data.idempotencyKey || null,
          })
          .returning();

        if (!recorded) {
          throw new ApiError(500, 'RIDER_EVENT_FAILED', 'Erreur lors de l\'enregistrement du pointage.');
        }

        return recorded;
      });
    } catch (err: any) {
      if (data.idempotencyKey && (err.code === '23505' || String(err.message).includes('idempotency'))) {
        const [existing] = await db
          .select()
          .from(transportRiderEvents)
          .where(
            and(
              eq(transportRiderEvents.tenantId, tenantId),
              eq(transportRiderEvents.idempotencyKey, data.idempotencyKey),
            ),
          )
          .limit(1);

        if (existing) {
          const matchesPayload =
            existing.tripId === data.tripId &&
            existing.studentId === data.studentId &&
            existing.stopId === data.stopId &&
            existing.eventType === data.eventType;

          if (!matchesPayload) {
            throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Un pointage différent existe déjà avec cette clé d\'idempotence.');
          }
          return existing;
        }
      }
      throw err;
    }
  },

  // --- Incidents & Safeguarding ---
  async getIncidents(tenantId: string, userRole?: string) {
    const rows = await db
      .select()
      .from(transportIncidents)
      .where(eq(transportIncidents.tenantId, tenantId))
      .orderBy(transportIncidents.createdAt);

    const isAuthorizedForSafeguarding = userRole === 'school_admin' || userRole === 'super_admin';
    if (!isAuthorizedForSafeguarding) {
      return rows.map(r => sanitizeIncidentForSelfService(r));
    }
    return rows;
  },

  async createIncident(tenantId: string, data: any) {
    const [created] = await db
      .insert(transportIncidents)
      .values({
        tenantId,
        tripId: data.tripId || null,
        vehicleId: data.vehicleId || null,
        driverId: data.driverId || null,
        incidentType: data.incidentType,
        severity: data.severity || 'medium',
        status: 'open',
        reportedByUserId: data.reportedByUserId,
        assignedResponderUserId: data.assignedResponderUserId || null,
        title: data.title,
        description: data.description || null,
        safeguardingRedactedNotes: data.safeguardingRedactedNotes || null,
      })
      .returning();

    if (!created) {
      throw new ApiError(500, 'INCIDENT_CREATION_FAILED', 'Erreur lors de la création du signalement.');
    }

    return created;
  },

  // --- Self-Service Projections ---
  async getGuardianTransportView(tenantId: string, guardianUserId: string) {
    const [guardianRecord] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(
        and(
          eq(guardians.tenantId, tenantId as any),
          or(
            eq(guardians.userId, guardianUserId as any),
            eq(guardians.id, guardianUserId as any),
          ),
        ),
      )
      .limit(1);

    const guardianIdToQuery = guardianRecord ? guardianRecord.id : guardianUserId;

    const linkedStudents = await db
      .select({ studentId: guardianStudents.studentId })
      .from(guardianStudents)
      .where(and(eq(guardianStudents.tenantId, tenantId as any), eq(guardianStudents.guardianId, guardianIdToQuery as any)));

    const studentIds = linkedStudents.map(s => s.studentId);
    if (studentIds.length === 0) {
      return [];
    }

    const allocations = await db
      .select({
        allocation: transportStudentAllocations,
        student: {
          id: user.id,
          name: user.name,
        },
        route: {
          routeName: transportRoutes.routeName,
          routeCode: transportRoutes.routeCode,
        },
      })
      .from(transportStudentAllocations)
      .innerJoin(user, and(eq(transportStudentAllocations.studentId, user.id), eq(user.tenantId, tenantId as any)))
      .innerJoin(transportRoutes, and(eq(transportStudentAllocations.routeId, transportRoutes.id), eq(transportRoutes.tenantId, tenantId)))
      .where(
        and(
          eq(transportStudentAllocations.tenantId, tenantId),
          inArray(transportStudentAllocations.studentId, studentIds),
        ),
      );

    return allocations;
  },

  async getStudentTransportView(tenantId: string, studentUserId: string) {
    const allocations = await db
      .select({
        allocation: transportStudentAllocations,
        route: {
          routeName: transportRoutes.routeName,
          routeCode: transportRoutes.routeCode,
        },
      })
      .from(transportStudentAllocations)
      .innerJoin(transportRoutes, and(eq(transportStudentAllocations.routeId, transportRoutes.id), eq(transportRoutes.tenantId, tenantId)))
      .where(
        and(
          eq(transportStudentAllocations.tenantId, tenantId),
          eq(transportStudentAllocations.studentId, studentUserId),
        ),
      );

    return allocations;
  },
};
