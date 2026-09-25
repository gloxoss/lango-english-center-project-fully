import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as alumniRsvpEvent } from '@/app/api/alumni/me/events/[id]/rsvp/route';
import { GET as alumniGetEvents } from '@/app/api/alumni/me/events/route';
import {
  POST as adminCreateEvent,
  DELETE as adminDeleteEvent,
  GET as adminGetEvents,
  PATCH as adminPatchEvent,
  PUT as adminUpdateEvent,
} from '@/app/api/students/alumni/events/route';
import { db } from '@/libs/DB';
import {
  alumniEventRsvps,
  alumniEvents,
  branches,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// Dynamic mock state for authenticated context
const authState = vi.hoisted(() => ({
  userId: '',
  tenantId: '',
  role: 'school_admin' as string,
  branchId: null as string | null,
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async (_req: any, allowedRoles?: string[]) => {
    if (allowedRoles && !allowedRoles.includes(authState.role)) {
      const { ApiError } = await import('@/libs/api/errors');
      throw new ApiError(403, 'FORBIDDEN', 'Accès interdit.');
    }
    return {
      userId: authState.userId,
      tenantId: authState.tenantId,
      role: authState.role,
      branchId: authState.branchId,
    };
  },
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: async () => undefined,
}));

const available = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!available)('Alumni Events Domain & Lifecycle Hardening', () => {
  // Test Tenants & Branches
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const branchA1 = randomUUID();
  const branchA2 = randomUUID();
  const branchB = randomUUID();

  // Cohorts (Session Years)
  const cohort2024 = randomUUID();
  const cohort2025 = randomUUID();

  // Users
  const adminAId = randomUUID();
  const alumnusA1Id = randomUUID(); // Cohort 2024, Branch A1
  const alumnusA2Id = randomUUID(); // Cohort 2024, Branch A1
  const alumnusA3Id = randomUUID(); // Cohort 2024, Branch A1
  const alumnusA4Id = randomUUID(); // Cohort 2024, Branch A1
  const alumnusA_OtherCohortId = randomUUID(); // Cohort 2025, Branch A2
  const alumnusBId = randomUUID(); // Tenant B
  const studentUserAId = randomUUID(); // Active student in Tenant A

  let testEventId: string;
  let limitedCapacityEventId: string;
  let cohortRestrictedEventId: string;
  let branchRestrictedEventId: string;

  beforeAll(async () => {
    // 1. Tenants & Branches
    await db.insert(tenants).values([
      { id: tenantA, name: 'Tenant Events A', slug: `tea-${tenantA.slice(0, 6)}` },
      { id: tenantB, name: 'Tenant Events B', slug: `teb-${tenantB.slice(0, 6)}` },
    ]);
    await db.insert(branches).values([
      { id: branchA1, tenantId: tenantA, name: 'Branch A1', code: `BA1-${branchA1.slice(0, 4)}` },
      { id: branchA2, tenantId: tenantA, name: 'Branch A2', code: `BA2-${branchA2.slice(0, 4)}` },
      { id: branchB, tenantId: tenantB, name: 'Branch B', code: `BB-${branchB.slice(0, 4)}` },
    ]);

    // 2. Cohorts
    await db.insert(sessionYears).values([
      { id: cohort2024, tenantId: tenantA, name: 'Promotion 2024', startDate: '2023-09-01', endDate: '2024-06-30' },
      { id: cohort2025, tenantId: tenantA, name: 'Promotion 2025', startDate: '2024-09-01', endDate: '2025-06-30' },
    ]);

    // 3. Admin & Alumni Users
    await db.insert(user).values([
      {
        id: adminAId,
        tenantId: tenantA,
        branchId: branchA1,
        name: 'Admin Events A',
        email: `admin-events-${adminAId.slice(0, 6)}@test.local`,
        role: 'school_admin',
        userStatus: 'active',
      },
      {
        id: alumnusA1Id,
        tenantId: tenantA,
        branchId: branchA1,
        graduationCohortSessionYearId: cohort2024,
        name: 'Alumnus A1 (2024, B1)',
        email: `alumnus-a1-${alumnusA1Id.slice(0, 6)}@test.local`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnusA2Id,
        tenantId: tenantA,
        branchId: branchA1,
        graduationCohortSessionYearId: cohort2024,
        name: 'Alumnus A2 (2024, B1)',
        email: `alumnus-a2-${alumnusA2Id.slice(0, 6)}@test.local`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnusA3Id,
        tenantId: tenantA,
        branchId: branchA1,
        graduationCohortSessionYearId: cohort2024,
        name: 'Alumnus A3 (2024, B1)',
        email: `alumnus-a3-${alumnusA3Id.slice(0, 6)}@test.local`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnusA4Id,
        tenantId: tenantA,
        branchId: branchA1,
        graduationCohortSessionYearId: cohort2024,
        name: 'Alumnus A4 (2024, B1)',
        email: `alumnus-a4-${alumnusA4Id.slice(0, 6)}@test.local`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnusA_OtherCohortId,
        tenantId: tenantA,
        branchId: branchA2,
        graduationCohortSessionYearId: cohort2025,
        name: 'Alumnus Other (2025, B2)',
        email: `alumnus-other-${alumnusA_OtherCohortId.slice(0, 6)}@test.local`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnusBId,
        tenantId: tenantB,
        branchId: branchB,
        name: 'Alumnus Tenant B',
        email: `alumnus-b-${alumnusBId.slice(0, 6)}@test.local`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: studentUserAId,
        tenantId: tenantA,
        name: 'Active Student A',
        email: `student-a-${studentUserAId.slice(0, 6)}@test.local`,
        role: 'student',
        userStatus: 'active',
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(alumniEventRsvps).where(eq(alumniEventRsvps.tenantId, tenantA));
    await db.delete(alumniEventRsvps).where(eq(alumniEventRsvps.tenantId, tenantB));
    await db.delete(alumniEvents).where(eq(alumniEvents.tenantId, tenantA));
    await db.delete(alumniEvents).where(eq(alumniEvents.tenantId, tenantB));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantA));
    await db.delete(branches).where(eq(branches.tenantId, tenantA));
    await db.delete(branches).where(eq(branches.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  function setAuth(userId: string, tenantId: string, role: string, branchId: string | null = null) {
    authState.userId = userId;
    authState.tenantId = tenantId;
    authState.role = role;
    authState.branchId = branchId;
  }

  // -------------------------------------------------------------
  // 1. Admin Event Creation, Update, Publish & Deletion Lifecycle
  // -------------------------------------------------------------
  describe('Admin Event Lifecycle & Management', () => {
    it('creates an event with capacity, audience scope, and attachment URL', async () => {
      setAuth(adminAId, tenantA, 'school_admin', branchA1);

      const req = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Gala Annuel des Anciens 2026',
          description: 'Soirée de retrouvailles annuelle pour les promotions de SchoolOS.',
          location: 'Grand Amphithéâtre, Campus Central',
          startsAt: '2026-11-20T19:00:00Z',
          endsAt: '2026-11-20T23:00:00Z',
          capacity: 100,
          attachmentUrl: 'https://cdn.schoolos.ma/events/gala-programme.pdf',
          isPublished: true,
        }),
      });

      const res = await adminCreateEvent(req);

      expect(res.status).toBe(201);

      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Gala Annuel des Anciens 2026');
      expect(json.data.capacity).toBe(100);
      expect(json.data.attachmentUrl).toBe('https://cdn.schoolos.ma/events/gala-programme.pdf');

      testEventId = json.data.id;
    });

    it('updates event details and capacity', async () => {
      setAuth(adminAId, tenantA, 'school_admin', branchA1);

      const req = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: testEventId,
          title: 'Gala Annuel des Anciens 2026 (Édition Prestige)',
          capacity: 150,
        }),
      });

      const res = await adminUpdateEvent(req);

      expect(res.status).toBe(200);

      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Gala Annuel des Anciens 2026 (Édition Prestige)');
      expect(json.data.capacity).toBe(150);
    });

    it('allows admin to cancel an event with an explicit reason', async () => {
      setAuth(adminAId, tenantA, 'school_admin', branchA1);

      const req = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: testEventId,
          isCancelled: true,
          cancellationReason: 'Travaux de rénovation imprévus dans le grand amphithéâtre.',
        }),
      });

      const res = await adminUpdateEvent(req);

      expect(res.status).toBe(200);

      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.isCancelled).toBe(true);
      expect(json.data.cancellationReason).toBe('Travaux de rénovation imprévus dans le grand amphithéâtre.');

      // Uncancel for remaining tests
      const restoreReq = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: testEventId,
          isCancelled: false,
          cancellationReason: null,
        }),
      });
      await adminUpdateEvent(restoreReq);
    });

    it('returns event detail with full attendees roster and statistics', async () => {
      setAuth(adminAId, tenantA, 'school_admin', branchA1);

      const req = new NextRequest(`http://localhost/api/students/alumni/events?eventId=${testEventId}`);
      const res = await adminGetEvents(req);

      expect(res.status).toBe(200);

      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.id).toBe(testEventId);
      expect(Array.isArray(json.data.attendees)).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 2. Audience Eligibility & Self-Service Visibility
  // -------------------------------------------------------------
  describe('Audience Eligibility & Self-Service Visibility', () => {
    beforeAll(async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      // Create an event targeted to Promotion 2024 only
      const resCohort = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Table Ronde Promo 2024',
            startsAt: '2026-10-15T18:00:00Z',
            targetCohortSessionYearId: cohort2024,
            isPublished: true,
          }),
        }),
      );
      cohortRestrictedEventId = (await resCohort.json()).data.id;

      // Create an event targeted to Branch A2 only
      const resBranch = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Networking Annexe A2',
            startsAt: '2026-10-20T18:00:00Z',
            targetBranchId: branchA2,
            isPublished: true,
          }),
        }),
      );
      branchRestrictedEventId = (await resBranch.json()).data.id;
    });

    it('unplublished draft event is invisible to alumni portal', async () => {
      setAuth(adminAId, tenantA, 'school_admin');
      const draftRes = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Événement Brouillon Secret',
            startsAt: '2026-12-01T10:00:00Z',
            isPublished: false,
          }),
        }),
      );
      const draftId = (await draftRes.json()).data.id;

      // Alumnus views upcoming events
      setAuth(alumnusA1Id, tenantA, 'alumni', branchA1);
      const viewRes = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));
      const viewJson = await viewRes.json();

      expect(viewJson.success).toBe(true);

      const foundDraft = (viewJson.data as any[]).some((e: any) => e.id === draftId);

      expect(foundDraft).toBe(false);
    });

    it('alumnus in target cohort sees cohort-restricted event; alumnus in different cohort does not', async () => {
      // Alumnus A1 is in Cohort 2024 -> should see 'Table Ronde Promo 2024'
      setAuth(alumnusA1Id, tenantA, 'alumni', branchA1);
      const resA1 = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));
      const jsonA1 = await resA1.json();

      expect((jsonA1.data as any[]).some((e: any) => e.id === cohortRestrictedEventId)).toBe(true);

      // Alumnus Other is in Cohort 2025 -> should NOT see 'Table Ronde Promo 2024'
      setAuth(alumnusA_OtherCohortId, tenantA, 'alumni', branchA2);
      const resOther = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));
      const jsonOther = await resOther.json();

      expect((jsonOther.data as any[]).some((e: any) => e.id === cohortRestrictedEventId)).toBe(false);
    });

    it('alumnus in target branch sees branch-restricted event; alumnus in other branch does not', async () => {
      // Alumnus Other is in Branch A2 -> should see 'Networking Annexe A2'
      setAuth(alumnusA_OtherCohortId, tenantA, 'alumni', branchA2);
      const resOther = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));
      const jsonOther = await resOther.json();

      expect((jsonOther.data as any[]).some((e: any) => e.id === branchRestrictedEventId)).toBe(true);

      // Alumnus A1 is in Branch A1 -> should NOT see 'Networking Annexe A2'
      setAuth(alumnusA1Id, tenantA, 'alumni', branchA1);
      const resA1 = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));
      const jsonA1 = await resA1.json();

      expect((jsonA1.data as any[]).some((e: any) => e.id === branchRestrictedEventId)).toBe(false);
    });

    it('rejects RSVP attempt if alumnus does not match audience rules', async () => {
      // Alumnus Other (Cohort 2025) tries to RSVP to Cohort 2024 event
      setAuth(alumnusA_OtherCohortId, tenantA, 'alumni', branchA2);

      const rsvpReq = new NextRequest(
        `http://localhost/api/alumni/me/events/${cohortRestrictedEventId}/rsvp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'going' }),
        },
      );
      const res = await alumniRsvpEvent(rsvpReq, { params: Promise.resolve({ id: cohortRestrictedEventId }) });

      expect(res.status).toBe(403);

      const json = await res.json();

      expect(json.error.code).toBe('NOT_ELIGIBLE');
    });
  });

  // -------------------------------------------------------------
  // 3. Capacity, Waitlist & Automatic Waitlist Promotion
  // -------------------------------------------------------------
  describe('Capacity, Sequential Waitlist & Auto-Promotion', () => {
    beforeAll(async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      // Create an event with strict capacity = 2
      const res = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Atelier Carrières Exclusif (Capacité 2)',
            startsAt: '2026-11-25T14:00:00Z',
            capacity: 2,
            isPublished: true,
          }),
        }),
      );
      limitedCapacityEventId = (await res.json()).data.id;
    });

    it('first two alumni receive confirmed spots (isWaitlisted: false)', async () => {
      // 1. Alumnus A1 RSVPs 'going'
      setAuth(alumnusA1Id, tenantA, 'alumni');
      const rsvp1 = await alumniRsvpEvent(
        new NextRequest(`http://localhost/api/alumni/me/events/${limitedCapacityEventId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'going' }),
        }),
        { params: Promise.resolve({ id: limitedCapacityEventId }) },
      );

      expect(rsvp1.status).toBe(200);

      const json1 = await rsvp1.json();

      expect(json1.data.status).toBe('going');
      expect(json1.data.isWaitlisted).toBe(false);
      expect(json1.data.waitlistPosition).toBeNull();

      // 2. Alumnus A2 RSVPs 'going'
      setAuth(alumnusA2Id, tenantA, 'alumni');
      const rsvp2 = await alumniRsvpEvent(
        new NextRequest(`http://localhost/api/alumni/me/events/${limitedCapacityEventId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'going' }),
        }),
        { params: Promise.resolve({ id: limitedCapacityEventId }) },
      );

      expect(rsvp2.status).toBe(200);

      const json2 = await rsvp2.json();

      expect(json2.data.status).toBe('going');
      expect(json2.data.isWaitlisted).toBe(false);
      expect(json2.data.waitlistPosition).toBeNull();
    });

    it('subsequent registrations are automatically placed on sequential waitlist', async () => {
      // 3. Alumnus A3 RSVPs 'going' -> Waitlist Position 1
      setAuth(alumnusA3Id, tenantA, 'alumni');
      const rsvp3 = await alumniRsvpEvent(
        new NextRequest(`http://localhost/api/alumni/me/events/${limitedCapacityEventId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'going' }),
        }),
        { params: Promise.resolve({ id: limitedCapacityEventId }) },
      );

      expect(rsvp3.status).toBe(200);

      const json3 = await rsvp3.json();

      expect(json3.data.status).toBe('going');
      expect(json3.data.isWaitlisted).toBe(true);
      expect(json3.data.waitlistPosition).toBe(1);

      // 4. Alumnus A4 RSVPs 'going' -> Waitlist Position 2
      setAuth(alumnusA4Id, tenantA, 'alumni');
      const rsvp4 = await alumniRsvpEvent(
        new NextRequest(`http://localhost/api/alumni/me/events/${limitedCapacityEventId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'going' }),
        }),
        { params: Promise.resolve({ id: limitedCapacityEventId }) },
      );

      expect(rsvp4.status).toBe(200);

      const json4 = await rsvp4.json();

      expect(json4.data.status).toBe('going');
      expect(json4.data.isWaitlisted).toBe(true);
      expect(json4.data.waitlistPosition).toBe(2);
    });

    it('self-service portal lists accurate metrics: totalConfirmed=2, totalWaitlist=2, isFull=true', async () => {
      setAuth(alumnusA3Id, tenantA, 'alumni');
      const res = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));
      const json = await res.json();
      const event = (json.data as any[]).find((e: any) => e.id === limitedCapacityEventId);

      expect(event).toBeDefined();
      expect(event.totalConfirmed).toBe(2);
      expect(event.totalWaitlist).toBe(2);
      expect(event.isFull).toBe(true);
      expect(event.myRsvpStatus).toBe('going');
      expect(event.myIsWaitlisted).toBe(true);
      expect(event.myWaitlistPosition).toBe(1);
    });

    it('canceling confirmed RSVP automatically promotes position 1 and re-indexes waitlist', async () => {
      // Alumnus A1 cancels their confirmed spot ('not_going')
      setAuth(alumnusA1Id, tenantA, 'alumni');
      const cancelRes = await alumniRsvpEvent(
        new NextRequest(`http://localhost/api/alumni/me/events/${limitedCapacityEventId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'not_going' }),
        }),
        { params: Promise.resolve({ id: limitedCapacityEventId }) },
      );

      expect(cancelRes.status).toBe(200);

      // Verify in DB:
      // Alumnus A3 should now be PROMOTED: isWaitlisted = false, waitlistPosition = null
      const [promotedA3] = await db
        .select()
        .from(alumniEventRsvps)
        .where(
          and(
            eq(alumniEventRsvps.eventId, limitedCapacityEventId),
            eq(alumniEventRsvps.alumnusId, alumnusA3Id),
          ),
        );

      expect(promotedA3!.isWaitlisted).toBe(false);
      expect(promotedA3!.waitlistPosition).toBeNull();
      expect(promotedA3!.status).toBe('going');

      // Alumnus A4 should now be shifted to waitlist position 1
      const [shiftedA4] = await db
        .select()
        .from(alumniEventRsvps)
        .where(
          and(
            eq(alumniEventRsvps.eventId, limitedCapacityEventId),
            eq(alumniEventRsvps.alumnusId, alumnusA4Id),
          ),
        );

      expect(shiftedA4!.isWaitlisted).toBe(true);
      expect(shiftedA4!.waitlistPosition).toBe(1);
    });

    it('rejects RSVP on cancelled event with HTTP 422', async () => {
      // Admin cancels the limited capacity event
      setAuth(adminAId, tenantA, 'school_admin');
      await adminUpdateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: limitedCapacityEventId,
            isCancelled: true,
            cancellationReason: 'Intervenant principal indisponible.',
          }),
        }),
      );

      // Alumnus attempts to RSVP
      setAuth(alumnusA1Id, tenantA, 'alumni');
      const res = await alumniRsvpEvent(
        new NextRequest(`http://localhost/api/alumni/me/events/${limitedCapacityEventId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'going' }),
        }),
        { params: Promise.resolve({ id: limitedCapacityEventId }) },
      );

      expect(res.status).toBe(422);

      const json = await res.json();

      expect(json.error.code).toBe('EVENT_CANCELLED');
    });
  });

  // -------------------------------------------------------------
  // 4. Live Check-in & Attendance Verification
  // -------------------------------------------------------------
  describe('Admin Live Check-in & Attendance', () => {
    it('allows admin to mark attendee as checked-in and toggles checked-in timestamp', async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      // Admin checks in Alumnus A2 for limited capacity event
      const checkInReq = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_in',
          eventId: limitedCapacityEventId,
          alumnusId: alumnusA2Id,
          checkedIn: true,
        }),
      });

      const res = await adminPatchEvent(checkInReq);

      expect(res.status).toBe(200);

      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.checkedIn).toBe(true);
      expect(json.data.checkedInAt).toBeDefined();

      // Verify in DB
      const [record] = await db
        .select()
        .from(alumniEventRsvps)
        .where(
          and(
            eq(alumniEventRsvps.eventId, limitedCapacityEventId),
            eq(alumniEventRsvps.alumnusId, alumnusA2Id),
          ),
        );

      expect(record!.checkedIn).toBe(true);
      expect(record!.checkedInAt).not.toBeNull();

      // Admin un-checks in
      const uncheckReq = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_in',
          eventId: limitedCapacityEventId,
          alumnusId: alumnusA2Id,
          checkedIn: false,
        }),
      });
      const uncheckRes = await adminPatchEvent(uncheckReq);

      expect(uncheckRes.status).toBe(200);

      const uncheckJson = await uncheckRes.json();

      expect(uncheckJson.data.checkedIn).toBe(false);
      expect(uncheckJson.data.checkedInAt).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // 5. Tenant Isolation, IDOR & Role Security Guards
  // -------------------------------------------------------------
  describe('Tenant Isolation, IDOR & Role Security Guards', () => {
    it('cross-tenant: Alumnus B in Tenant B cannot see Tenant A events', async () => {
      setAuth(alumnusBId, tenantB, 'alumni');
      const res = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));
      const json = await res.json();

      expect(json.success).toBe(true);
      expect((json.data as any[]).some((e: any) => e.id === testEventId)).toBe(false);
      expect((json.data as any[]).some((e: any) => e.id === limitedCapacityEventId)).toBe(false);
    });

    it('cross-tenant: Alumnus B in Tenant B cannot RSVP to Tenant A event (HTTP 404)', async () => {
      setAuth(alumnusBId, tenantB, 'alumni');
      const res = await alumniRsvpEvent(
        new NextRequest(`http://localhost/api/alumni/me/events/${testEventId}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'going' }),
        }),
        { params: Promise.resolve({ id: testEventId }) },
      );

      expect(res.status).toBe(404);

      const json = await res.json();

      expect(json.error.code).toBe('EVENT_NOT_FOUND');
    });

    it('cross-tenant: Admin in Tenant B cannot view or modify Tenant A event', async () => {
      const adminBId = randomUUID();
      await db.insert(user).values({
        id: adminBId,
        tenantId: tenantB,
        name: 'Admin B',
        email: `admin-b-${adminBId.slice(0, 6)}@test.local`,
        role: 'school_admin',
      });

      setAuth(adminBId, tenantB, 'school_admin');

      // Admin B tries to fetch Tenant A event
      const getReq = new NextRequest(`http://localhost/api/students/alumni/events?eventId=${testEventId}`);
      const getRes = await adminGetEvents(getReq);

      expect(getRes.status).toBe(404);

      // Admin B tries to delete Tenant A event
      const delReq = new NextRequest(`http://localhost/api/students/alumni/events?id=${testEventId}`, {
        method: 'DELETE',
      });
      const delRes = await adminDeleteEvent(delReq);

      expect(delRes.status).toBe(404);

      await db.delete(user).where(eq(user.id, adminBId));
    });

    it('role guard: active student cannot access alumni self-service events (HTTP 403)', async () => {
      setAuth(studentUserAId, tenantA, 'student');
      const res = await alumniGetEvents(new NextRequest('http://localhost/api/alumni/me/events'));

      expect(res.status).toBe(403);
    });

    it('role guard: active student cannot access admin events endpoint (HTTP 403)', async () => {
      setAuth(studentUserAId, tenantA, 'student');
      const res = await adminGetEvents(new NextRequest('http://localhost/api/students/alumni/events'));

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------
  // 6. Event Deletion Safety & Historical Preservation
  // -------------------------------------------------------------
  describe('Event Deletion Safety & Lifecycle Truth', () => {
    let draftUnusedId: string;
    let publishedZeroAttendeesId: string;
    let draftWithRsvpId: string;
    let eventWithCheckinId: string;

    beforeAll(async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      // 1. Unused draft event (isPublished: false, 0 RSVPs)
      const resDraft = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Draft Unused Event',
            startsAt: '2026-12-20T10:00:00Z',
            isPublished: false,
          }),
        }),
      );
      draftUnusedId = (await resDraft.json()).data.id;

      // 2. Published event with 0 attendees
      const resPublished = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Published Event Zero Attendees',
            startsAt: '2026-12-22T10:00:00Z',
            isPublished: true,
          }),
        }),
      );
      publishedZeroAttendeesId = (await resPublished.json()).data.id;

      // 3. Draft event with an RSVP
      const resDraftRsvp = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Draft Event With RSVP',
            startsAt: '2026-12-24T10:00:00Z',
            isPublished: false,
          }),
        }),
      );
      draftWithRsvpId = (await resDraftRsvp.json()).data.id;
      const nowIso = new Date().toISOString();
      await db.insert(alumniEventRsvps).values({
        tenantId: tenantA,
        eventId: draftWithRsvpId,
        alumnusId: alumnusA1Id,
        status: 'going',
        isWaitlisted: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // 4. Event with check-in history
      const resCheckin = await adminCreateEvent(
        new NextRequest('http://localhost/api/students/alumni/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Event With Check-in History',
            startsAt: '2026-12-26T10:00:00Z',
            isPublished: true,
          }),
        }),
      );
      eventWithCheckinId = (await resCheckin.json()).data.id;
      await db.insert(alumniEventRsvps).values({
        tenantId: tenantA,
        eventId: eventWithCheckinId,
        alumnusId: alumnusA2Id,
        status: 'going',
        isWaitlisted: false,
        checkedIn: true,
        checkedInAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });

    it('draft without attendees -> deletion allowed', async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      const delReq = new NextRequest(`http://localhost/api/students/alumni/events?id=${draftUnusedId}`, {
        method: 'DELETE',
      });
      const delRes = await adminDeleteEvent(delReq);

      expect(delRes.status).toBe(200);

      const json = await delRes.json();

      expect(json.success).toBe(true);

      // Verify event is completely removed from DB
      const [check] = await db.select().from(alumniEvents).where(eq(alumniEvents.id, draftUnusedId));

      expect(check).toBeUndefined();
    });

    it('published event -> destructive deletion refused (HTTP 409)', async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      const delReq = new NextRequest(`http://localhost/api/students/alumni/events?id=${publishedZeroAttendeesId}`, {
        method: 'DELETE',
      });
      const delRes = await adminDeleteEvent(delReq);

      expect(delRes.status).toBe(409);

      const json = await delRes.json();

      expect(json.error.code).toBe('CANNOT_DELETE_PUBLISHED_OR_USED_EVENT');

      // Verify event still exists in DB
      const [check] = await db.select().from(alumniEvents).where(eq(alumniEvents.id, publishedZeroAttendeesId));

      expect(check).toBeDefined();
    });

    it('event with RSVP -> destructive deletion refused (HTTP 409)', async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      const delReq = new NextRequest(`http://localhost/api/students/alumni/events?id=${draftWithRsvpId}`, {
        method: 'DELETE',
      });
      const delRes = await adminDeleteEvent(delReq);

      expect(delRes.status).toBe(409);

      const json = await delRes.json();

      expect(json.error.code).toBe('CANNOT_DELETE_PUBLISHED_OR_USED_EVENT');

      // Verify RSVP record still exists in DB
      const [rsvp] = await db
        .select()
        .from(alumniEventRsvps)
        .where(and(eq(alumniEventRsvps.eventId, draftWithRsvpId), eq(alumniEventRsvps.alumnusId, alumnusA1Id)));

      expect(rsvp).toBeDefined();
    });

    it('event with check-in -> destructive deletion refused (HTTP 409)', async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      const delReq = new NextRequest(`http://localhost/api/students/alumni/events?id=${eventWithCheckinId}`, {
        method: 'DELETE',
      });
      const delRes = await adminDeleteEvent(delReq);

      expect(delRes.status).toBe(409);

      const json = await delRes.json();

      expect(json.error.code).toBe('CANNOT_DELETE_PUBLISHED_OR_USED_EVENT');

      // Verify check-in record still exists in DB
      const [rsvp] = await db
        .select()
        .from(alumniEventRsvps)
        .where(and(eq(alumniEventRsvps.eventId, eventWithCheckinId), eq(alumniEventRsvps.alumnusId, alumnusA2Id)));

      expect(rsvp).toBeDefined();
      expect(rsvp?.checkedIn).toBe(true);
    });

    it('cancellation preserves RSVP/check-in history', async () => {
      setAuth(adminAId, tenantA, 'school_admin');

      // Cancel the event instead of deleting it
      const cancelReq = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eventWithCheckinId,
          isCancelled: true,
          cancellationReason: 'Archivage administratif officiel.',
        }),
      });
      const cancelRes = await adminUpdateEvent(cancelReq);

      expect(cancelRes.status).toBe(200);

      // Verify in DB that event is marked cancelled
      const [event] = await db.select().from(alumniEvents).where(eq(alumniEvents.id, eventWithCheckinId));

      expect(event?.isCancelled).toBe(true);
      expect(event?.cancellationReason).toBe('Archivage administratif officiel.');

      // Verify that RSVP and check-in history is fully preserved
      const [rsvp] = await db
        .select()
        .from(alumniEventRsvps)
        .where(and(eq(alumniEventRsvps.eventId, eventWithCheckinId), eq(alumniEventRsvps.alumnusId, alumnusA2Id)));

      expect(rsvp).toBeDefined();
      expect(rsvp?.status).toBe('going');
      expect(rsvp?.checkedIn).toBe(true);
      expect(rsvp?.checkedInAt).not.toBeNull();
    });

    it('wrong tenant cannot delete/cancel (HTTP 404)', async () => {
      const adminBId = randomUUID();
      await db.insert(user).values({
        id: adminBId,
        tenantId: tenantB,
        name: 'Admin Tenant B Deletion Test',
        email: `admin-b-del-${adminBId.slice(0, 6)}@test.local`,
        role: 'school_admin',
      });

      setAuth(adminBId, tenantB, 'school_admin');

      // Attempt to delete Tenant A event
      const delReq = new NextRequest(`http://localhost/api/students/alumni/events?id=${eventWithCheckinId}`, {
        method: 'DELETE',
      });
      const delRes = await adminDeleteEvent(delReq);

      expect(delRes.status).toBe(404);

      // Attempt to cancel Tenant A event
      const cancelReq = new NextRequest('http://localhost/api/students/alumni/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eventWithCheckinId,
          isCancelled: true,
          cancellationReason: 'Malicious cross-tenant cancellation.',
        }),
      });
      const cancelRes = await adminUpdateEvent(cancelReq);

      expect(cancelRes.status).toBe(404);

      await db.delete(user).where(eq(user.id, adminBId));
    });
  });
});
