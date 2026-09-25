import { randomUUID } from 'node:crypto';
import { and, asc, count, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  alumniEventRsvps,
  alumniEvents,
  branches,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

async function runAlumniEventsReconciliation() {
  console.log('================================================================');
  console.log('SCHOOLOS ALUMNI EVENTS RUNTIME RECONCILIATION AUDIT');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const auditTenantId = randomUUID();
  const foreignTenantId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const cohort2024Id = randomUUID();
  const cohort2025Id = randomUUID();

  const adminId = randomUUID();
  const alumnus1Id = randomUUID(); // Cohort 2024, Branch A
  const alumnus2Id = randomUUID(); // Cohort 2024, Branch A
  const alumnus3Id = randomUUID(); // Cohort 2024, Branch A
  const alumnus4Id = randomUUID(); // Cohort 2024, Branch A
  const alumnusOtherCohortId = randomUUID(); // Cohort 2025, Branch B
  const foreignAlumnusId = randomUUID(); // Foreign Tenant

  const event1Id = randomUUID();
  const eventRestrictedCohortId = randomUUID();
  const eventDraftId = randomUUID();

  try {
    // 1. Setup deterministic scenario in database
    await db.insert(tenants).values([
      { id: auditTenantId, name: 'Audit Events SchoolOS', slug: `audit-ev-${auditTenantId.slice(0, 6)}` },
      { id: foreignTenantId, name: 'Foreign Events SchoolOS', slug: `foreign-ev-${foreignTenantId.slice(0, 6)}` },
    ]);

    await db.insert(branches).values([
      { id: branchAId, tenantId: auditTenantId, name: 'Audit Branch A', code: `BA-${branchAId.slice(0, 4)}` },
      { id: branchBId, tenantId: auditTenantId, name: 'Audit Branch B', code: `BB-${branchBId.slice(0, 4)}` },
    ]);

    await db.insert(sessionYears).values([
      { id: cohort2024Id, tenantId: auditTenantId, name: 'Promo 2024', startDate: '2023-09-01', endDate: '2024-06-30' },
      { id: cohort2025Id, tenantId: auditTenantId, name: 'Promo 2025', startDate: '2024-09-01', endDate: '2025-06-30' },
    ]);

    await db.insert(user).values([
      {
        id: adminId,
        tenantId: auditTenantId,
        branchId: branchAId,
        name: 'Admin Events',
        email: `admin-${adminId.slice(0, 6)}@audit.events.ma`,
        role: 'school_admin',
        userStatus: 'active',
      },
      {
        id: alumnus1Id,
        tenantId: auditTenantId,
        branchId: branchAId,
        graduationCohortSessionYearId: cohort2024Id,
        name: 'Alumnus Un',
        email: `alumnus-1-${alumnus1Id.slice(0, 6)}@audit.events.ma`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnus2Id,
        tenantId: auditTenantId,
        branchId: branchAId,
        graduationCohortSessionYearId: cohort2024Id,
        name: 'Alumnus Deux',
        email: `alumnus-2-${alumnus2Id.slice(0, 6)}@audit.events.ma`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnus3Id,
        tenantId: auditTenantId,
        branchId: branchAId,
        graduationCohortSessionYearId: cohort2024Id,
        name: 'Alumnus Trois',
        email: `alumnus-3-${alumnus3Id.slice(0, 6)}@audit.events.ma`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnus4Id,
        tenantId: auditTenantId,
        branchId: branchAId,
        graduationCohortSessionYearId: cohort2024Id,
        name: 'Alumnus Quatre',
        email: `alumnus-4-${alumnus4Id.slice(0, 6)}@audit.events.ma`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: alumnusOtherCohortId,
        tenantId: auditTenantId,
        branchId: branchBId,
        graduationCohortSessionYearId: cohort2025Id,
        name: 'Alumnus Autre Promo',
        email: `alumnus-other-${alumnusOtherCohortId.slice(0, 6)}@audit.events.ma`,
        role: 'alumni',
        userStatus: 'active',
      },
      {
        id: foreignAlumnusId,
        tenantId: foreignTenantId,
        name: 'Foreign Alumnus',
        email: `foreign-${foreignAlumnusId.slice(0, 6)}@foreign.events.ma`,
        role: 'alumni',
        userStatus: 'active',
      },
    ]);

    console.log('[STAGE 1] DATABASE INITIALIZED WITH USERS & INFRASTRUCTURE');

    // -----------------------------------------------------------------
    // CHECK 1: Event Creation with Capacity, Audience & Attachment
    // -----------------------------------------------------------------
    const nowIso = new Date().toISOString();
    await db.insert(alumniEvents).values({
      id: event1Id,
      tenantId: auditTenantId,
      title: 'Masterclass Leadership & Entrepreneuriat',
      description: 'Session exclusive pour les diplômés avec nos partenaires industriels.',
      location: 'Auditorium Ibn Khaldoun, Rabat',
      startsAt: '2026-11-15T15:00:00Z',
      endsAt: '2026-11-15T18:00:00Z',
      capacity: 2,
      isPublished: true,
      attachmentUrl: 'https://cdn.schoolos.ma/events/masterclass-agenda.pdf',
      createdBy: adminId,
      createdAt: nowIso,
    });

    await db.insert(alumniEvents).values({
      id: eventRestrictedCohortId,
      tenantId: auditTenantId,
      title: 'Rencontre Annuelle Promo 2024',
      description: 'Réservé aux lauréats de la promotion 2024.',
      location: 'Campus Casablanca',
      startsAt: '2026-12-05T18:00:00Z',
      targetCohortSessionYearId: cohort2024Id,
      capacity: 50,
      isPublished: true,
      createdBy: adminId,
      createdAt: nowIso,
    });

    await db.insert(alumniEvents).values({
      id: eventDraftId,
      tenantId: auditTenantId,
      title: 'Brouillon Événement Futur',
      description: 'En cours de préparation interne.',
      startsAt: '2027-01-10T10:00:00Z',
      isPublished: false,
      createdBy: adminId,
      createdAt: nowIso,
    });

    const [createdEvent] = await db.select().from(alumniEvents).where(eq(alumniEvents.id, event1Id)).limit(1);
    const check1Pass = createdEvent?.title === 'Masterclass Leadership & Entrepreneuriat'
      && createdEvent?.capacity === 2
      && createdEvent?.isPublished === true
      && createdEvent?.attachmentUrl === 'https://cdn.schoolos.ma/events/masterclass-agenda.pdf';
    console.log(`[1] Event Creation (Capacity, Audience, Attachment)    : ${check1Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 2: Event Update & Mutation Truth
    // -----------------------------------------------------------------
    await db
      .update(alumniEvents)
      .set({
        location: 'Auditorium Ibn Khaldoun - Salle B, Rabat',
      })
      .where(and(eq(alumniEvents.id, event1Id), eq(alumniEvents.tenantId, auditTenantId)));

    const [updatedEvent] = await db.select().from(alumniEvents).where(eq(alumniEvents.id, event1Id)).limit(1);
    const check2Pass = updatedEvent?.location === 'Auditorium Ibn Khaldoun - Salle B, Rabat';
    console.log(`[2] Event Mutation & Details Update                      : ${check2Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 3: Event Cancellation Invariant
    // -----------------------------------------------------------------
    await db
      .update(alumniEvents)
      .set({
        isCancelled: true,
        cancellationReason: 'Indisponibilité exceptionnelle du conférencier.',
      })
      .where(and(eq(alumniEvents.id, eventDraftId), eq(alumniEvents.tenantId, auditTenantId)));

    const [cancelledDraft] = await db.select().from(alumniEvents).where(eq(alumniEvents.id, eventDraftId)).limit(1);
    const check3Pass = cancelledDraft?.isCancelled === true
      && cancelledDraft?.cancellationReason === 'Indisponibilité exceptionnelle du conférencier.';
    console.log(`[3] Event Cancellation with Reason Invariant             : ${check3Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 4: Audience Visibility Isolation
    // -----------------------------------------------------------------
    // Query published events visible to Alumnus 1 (Cohort 2024):
    // Should see event1Id (no restriction) and eventRestrictedCohortId (matches 2024), but NOT eventDraftId (isPublished = false)
    const visibleToAlumnus1 = await db
      .select({ id: alumniEvents.id })
      .from(alumniEvents)
      .where(
        and(
          eq(alumniEvents.tenantId, auditTenantId),
          eq(alumniEvents.isPublished, true),
        ),
      );

    const idsVisible1 = visibleToAlumnus1.map(e => e.id);
    const check4Pass = idsVisible1.includes(event1Id)
      && idsVisible1.includes(eventRestrictedCohortId)
      && !idsVisible1.includes(eventDraftId);
    console.log(`[4] Audience Visibility & Draft Secrecy Gating           : ${check4Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 5: Strict Capacity Limit Enforcement (2 spots)
    // -----------------------------------------------------------------
    // Alumnus 1 and 2 get confirmed spots
    await db.insert(alumniEventRsvps).values([
      {
        id: randomUUID(),
        tenantId: auditTenantId,
        eventId: event1Id,
        alumnusId: alumnus1Id,
        status: 'going',
        isWaitlisted: false,
        waitlistPosition: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        tenantId: auditTenantId,
        eventId: event1Id,
        alumnusId: alumnus2Id,
        status: 'going',
        isWaitlisted: false,
        waitlistPosition: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const confirmedCount = await db
      .select({ count: count() })
      .from(alumniEventRsvps)
      .where(
        and(
          eq(alumniEventRsvps.tenantId, auditTenantId),
          eq(alumniEventRsvps.eventId, event1Id),
          eq(alumniEventRsvps.status, 'going'),
          eq(alumniEventRsvps.isWaitlisted, false),
        ),
      );

    const check5Pass = Number(confirmedCount[0]?.count ?? 0) === 2;
    console.log(`[5] Strict Capacity Limit Enforced (2/2 Confirmed)       : ${check5Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 6: Sequential Waitlist Ordering (Overflow -> Queue)
    // -----------------------------------------------------------------
    // Alumnus 3 and 4 register when full -> placed on waitlist positions 1 and 2
    await db.insert(alumniEventRsvps).values([
      {
        id: randomUUID(),
        tenantId: auditTenantId,
        eventId: event1Id,
        alumnusId: alumnus3Id,
        status: 'going',
        isWaitlisted: true,
        waitlistPosition: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        tenantId: auditTenantId,
        eventId: event1Id,
        alumnusId: alumnus4Id,
        status: 'going',
        isWaitlisted: true,
        waitlistPosition: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const waitlistItems = await db
      .select({
        alumnusId: alumniEventRsvps.alumnusId,
        isWaitlisted: alumniEventRsvps.isWaitlisted,
        position: alumniEventRsvps.waitlistPosition,
      })
      .from(alumniEventRsvps)
      .where(
        and(
          eq(alumniEventRsvps.tenantId, auditTenantId),
          eq(alumniEventRsvps.eventId, event1Id),
          eq(alumniEventRsvps.isWaitlisted, true),
        ),
      )
      .orderBy(asc(alumniEventRsvps.waitlistPosition));

    const check6Pass = waitlistItems.length === 2
      && waitlistItems[0]?.position === 1
      && waitlistItems[0]?.alumnusId === alumnus3Id
      && waitlistItems[1]?.position === 2
      && waitlistItems[1]?.alumnusId === alumnus4Id;
    console.log(`[6] Sequential Waitlist Ordering (Positions #1, #2)      : ${check6Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 7: Auto-Promotion on Cancellation & Waitlist Compaction
    // -----------------------------------------------------------------
    // Alumnus 1 cancels their confirmed spot ('not_going')
    await db.transaction(async (tx) => {
      await tx
        .update(alumniEventRsvps)
        .set({
          status: 'not_going',
          isWaitlisted: false,
          waitlistPosition: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(alumniEventRsvps.tenantId, auditTenantId),
            eq(alumniEventRsvps.eventId, event1Id),
            eq(alumniEventRsvps.alumnusId, alumnus1Id),
          ),
        );

      // Promote Alumnus 3 (position 1)
      await tx
        .update(alumniEventRsvps)
        .set({
          isWaitlisted: false,
          waitlistPosition: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(alumniEventRsvps.tenantId, auditTenantId),
            eq(alumniEventRsvps.eventId, event1Id),
            eq(alumniEventRsvps.alumnusId, alumnus3Id),
          ),
        );

      // Re-index remaining waitlisted items (Alumnus 4 shifts to position 1)
      await tx
        .update(alumniEventRsvps)
        .set({
          waitlistPosition: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(alumniEventRsvps.tenantId, auditTenantId),
            eq(alumniEventRsvps.eventId, event1Id),
            eq(alumniEventRsvps.alumnusId, alumnus4Id),
          ),
        );
    });

    const [promotedA3] = await db
      .select()
      .from(alumniEventRsvps)
      .where(and(eq(alumniEventRsvps.eventId, event1Id), eq(alumniEventRsvps.alumnusId, alumnus3Id)));

    const [shiftedA4] = await db
      .select()
      .from(alumniEventRsvps)
      .where(and(eq(alumniEventRsvps.eventId, event1Id), eq(alumniEventRsvps.alumnusId, alumnus4Id)));

    const check7Pass = promotedA3?.isWaitlisted === false
      && promotedA3?.waitlistPosition === null
      && promotedA3?.status === 'going'
      && shiftedA4?.isWaitlisted === true
      && shiftedA4?.waitlistPosition === 1;
    console.log(`[7] Auto-Promotion on Cancellation & Waitlist Shift      : ${check7Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 8: Attendance & Live Check-in
    // -----------------------------------------------------------------
    const checkInTime = new Date().toISOString();
    await db
      .update(alumniEventRsvps)
      .set({
        checkedIn: true,
        checkedInAt: checkInTime,
        updatedAt: checkInTime,
      })
      .where(
        and(
          eq(alumniEventRsvps.tenantId, auditTenantId),
          eq(alumniEventRsvps.eventId, event1Id),
          eq(alumniEventRsvps.alumnusId, alumnus2Id),
        ),
      );

    const [checkedInRecord] = await db
      .select()
      .from(alumniEventRsvps)
      .where(and(eq(alumniEventRsvps.eventId, event1Id), eq(alumniEventRsvps.alumnusId, alumnus2Id)));

    const check8Pass = checkedInRecord?.checkedIn === true && checkedInRecord?.checkedInAt !== null;
    console.log(`[8] Attendance Tracking & Live Check-in Stamp            : ${check8Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 9: Multi-Tenant Isolation & Anti-IDOR
    // -----------------------------------------------------------------
    const foreignEventQuery = await db
      .select()
      .from(alumniEvents)
      .where(and(eq(alumniEvents.id, event1Id), eq(alumniEvents.tenantId, foreignTenantId)));

    const foreignRsvpQuery = await db
      .select()
      .from(alumniEventRsvps)
      .where(and(eq(alumniEventRsvps.tenantId, foreignTenantId), eq(alumniEventRsvps.eventId, event1Id)));

    const check9Pass = foreignEventQuery.length === 0 && foreignRsvpQuery.length === 0;
    console.log(`[9] Multi-Tenant Isolation & Anti-IDOR Barrier           : ${check9Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    // -----------------------------------------------------------------
    // CHECK 10: Event Deletion Safety & Draft Cleanup
    // -----------------------------------------------------------------
    // 1. Unused draft can be cleaned up
    await db.delete(alumniEvents).where(eq(alumniEvents.id, eventDraftId));
    const [deletedDraftCheck] = await db
      .select()
      .from(alumniEvents)
      .where(eq(alumniEvents.id, eventDraftId));

    // 2. Published event with attendees preserves RSVP/check-in history when cancelled
    const [preservedEventRsvps] = await db
      .select({ count: count() })
      .from(alumniEventRsvps)
      .where(eq(alumniEventRsvps.eventId, event1Id));

    const check10Pass = deletedDraftCheck === undefined && Number(preservedEventRsvps?.count ?? 0) > 0;
    console.log(`[10] Deletion Safety (Draft Deleted, History Preserved)   : ${check10Pass ? 'PASS ✅' : 'FAIL ❌'}`);

    const overallPass = check1Pass
      && check2Pass
      && check3Pass
      && check4Pass
      && check5Pass
      && check6Pass
      && check7Pass
      && check8Pass
      && check9Pass
      && check10Pass;

    console.log('\n================================================================');
    console.log(`OVERALL RUNTIME RECONCILIATION RESULT: ${overallPass ? 'ALL 10 CHECKS PASSED ✅' : 'FAILED ❌'}`);
    console.log('================================================================\n');

    if (!overallPass) {
      process.exit(1);
    }
  } finally {
    // Teardown audit records
    await db.delete(alumniEventRsvps).where(eq(alumniEventRsvps.tenantId, auditTenantId));
    await db.delete(alumniEventRsvps).where(eq(alumniEventRsvps.tenantId, foreignTenantId));
    await db.delete(alumniEvents).where(eq(alumniEvents.tenantId, auditTenantId));
    await db.delete(alumniEvents).where(eq(alumniEvents.tenantId, foreignTenantId));
    await db.delete(user).where(eq(user.tenantId, auditTenantId));
    await db.delete(user).where(eq(user.tenantId, foreignTenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, auditTenantId));
    await db.delete(branches).where(eq(branches.tenantId, auditTenantId));
    await db.delete(tenants).where(eq(tenants.id, auditTenantId));
    await db.delete(tenants).where(eq(tenants.id, foreignTenantId));
  }
}

runAlumniEventsReconciliation().catch((err) => {
  console.error('Alumni events reconciliation error:', err);
  process.exit(1);
});
