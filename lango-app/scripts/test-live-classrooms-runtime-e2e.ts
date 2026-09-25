// @ts-nocheck
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/libs/DB';
import {
  addonEntitlements,
  attendance,
  attendanceRegisters,
  classSections,
  classSubjects,
  classes,
  liveClassAttendanceSummaries,
  liveClassInvitations,
  liveClassParticipantEvents,
  liveClassProviderProfiles,
  liveClassSessions,
  mediums,
  sections,
  subjectTeachers,
  subjects,
  tenants,
  user,
} from '../src/models/Schema';
import {
  liveClassRecordings,
} from '../src/features/live-classrooms/models/live-classrooms-schema';
import {
  attachmentTypes,
  digitalAssets,
} from '../src/features/attachments/models/attachments-schema';
import {
  createLiveSession,
  endLiveSession,
  loadSession,
  startLiveSession,
} from '../src/features/live-classrooms/services/session-service';
import {
  issueJoinGrant,
  redeemJoinGrant,
} from '../src/features/live-classrooms/services/join-service';
import {
  getSummaries,
  postAttendance,
  reconcileAttendance,
} from '../src/features/live-classrooms/services/attendance-service';
import {
  attachMaterial,
  detachMaterial,
  listSessionMaterials,
  listSessionRecordings,
} from '../src/features/live-classrooms/services/recording-service';
import {
  exportSessionReportsCsv,
  getOverview,
  listSessionReports,
} from '../src/features/live-classrooms/services/report-service';
import type { RequestContext } from '../src/libs/api/context';

interface TestStepResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestStepResult[] = [];

function record(step: string, passed: boolean, details: string) {
  const status = passed ? 'PASS' : 'FAIL';
  results.push({ step, status, details });
  console.log(`[${status}] ${step}: ${details}`);
  if (!passed) {
    throw new Error(`Step failed: ${step} - ${details}`);
  }
}

async function run() {
  console.log('=== AUD-LIVE-01: Runtime E2E Session Lifecycle & Security Audit ===\n');

  // 1. Resolve active tenant
  const [activeTenant] = await db.select().from(tenants).limit(1);
  if (!activeTenant) throw new Error('No tenant found in database');
  const tenantId = activeTenant.id;
  record('1. Resolve Active Tenant', true, `Tenant ${activeTenant.name} (${tenantId})`);

  // 2. Ensure live-classrooms addon is entitled
  const [existingEntitlement] = await db
    .select()
    .from(addonEntitlements)
    .where(
      and(
        eq(addonEntitlements.tenantId, tenantId),
        eq(addonEntitlements.addonId, 'live-classrooms')
      )
    )
    .limit(1);

  if (!existingEntitlement) {
    await db.insert(addonEntitlements).values({
      id: crypto.randomUUID(),
      tenantId,
      addonId: 'live-classrooms',
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    record('2. Addon Entitlement', true, 'Entitled live-classrooms addon for tenant');
  } else if (!existingEntitlement.isEnabled) {
    await db
      .update(addonEntitlements)
      .set({ isEnabled: true })
      .where(eq(addonEntitlements.id, existingEntitlement.id));
    record('2. Addon Entitlement', true, 'Enabled live-classrooms addon for tenant');
  } else {
    record('2. Addon Entitlement', true, 'live-classrooms addon already active');
  }

  // 3. Resolve or create Provider Profile (Dev provider)
  let [profile] = await db
    .select()
    .from(liveClassProviderProfiles)
    .where(
      and(
        eq(liveClassProviderProfiles.tenantId, tenantId),
        eq(liveClassProviderProfiles.enabled, true)
      )
    )
    .limit(1);

  if (!profile) {
    const profileId = crypto.randomUUID();
    await db.insert(liveClassProviderProfiles).values({
      id: profileId,
      tenantId,
      name: 'Deterministic Dev Classroom',
      providerType: 'dev',
      apiEndpoint: 'http://localhost:3114/api/mock-bbb',
      signingKey: 'dev-secret-signing-key-test-32chars!!',
      config: {},
      enabled: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    [profile] = await db
      .select()
      .from(liveClassProviderProfiles)
      .where(eq(liveClassProviderProfiles.id, profileId));
    record('3. Provider Profile', true, `Created dev provider profile (${profile.id})`);
  } else {
    record('3. Provider Profile', true, `Found active provider profile (${profile.name}, type=${profile.providerType})`);
  }

  // 4. Resolve Academic Roster (Teacher, Class Section, Class Subject, Students)
  const [teacher] = await db
    .select()
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
    .limit(1);
  if (!teacher) throw new Error('No teacher found in tenant');

  const [adminUser] = await db
    .select()
    .from(user)
    .where(and(eq(user.tenantId, tenantId), inArray(user.role, ['super_admin', 'school_admin'])))
    .limit(1);
  if (!adminUser) throw new Error('No admin user found in tenant');

  // Find a class section that has an associated classSubject
  let sectionRowId = '';
  let subjectRowId = '';

  const classSubjectPairs = await db
    .select({
      classSectionId: classSections.id,
      classSubjectId: classSubjects.id,
      classId: classSections.classId,
    })
    .from(classSections)
    .innerJoin(classSubjects, eq(classSections.classId, classSubjects.classId))
    .where(and(eq(classSections.tenantId, tenantId), eq(classSubjects.tenantId, tenantId)))
    .limit(1);

  if (classSubjectPairs.length > 0) {
    sectionRowId = classSubjectPairs[0]!.classSectionId;
    subjectRowId = classSubjectPairs[0]!.classSubjectId;
  } else {
    let [medium] = await db.select().from(mediums).where(eq(mediums.tenantId, tenantId)).limit(1);
    if (!medium) {
      const medId = crypto.randomUUID();
      await db.insert(mediums).values({
        id: medId,
        tenantId,
        name: 'Français',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      [medium] = await db.select().from(mediums).where(eq(mediums.id, medId));
    }

    let [existingSubject] = await db.select().from(subjects).where(eq(subjects.tenantId, tenantId)).limit(1);
    if (!existingSubject) {
      const subId = crypto.randomUUID();
      await db.insert(subjects).values({
        id: subId,
        tenantId,
        name: 'Anglais Général',
        code: 'ENG-101',
        mediumId: medium!.id,
        type: 'theory',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      [existingSubject] = await db.select().from(subjects).where(eq(subjects.id, subId));
    }
    const [section] = await db.select().from(classSections).where(eq(classSections.tenantId, tenantId)).limit(1);
    if (!section) throw new Error('No class section found in tenant');
    const newClassSubId = crypto.randomUUID();
    await db.insert(classSubjects).values({
      id: newClassSubId,
      tenantId,
      classId: section.classId,
      subjectId: existingSubject!.id,
      type: 'compulsory',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    sectionRowId = section.id;
    subjectRowId = newClassSubId;
  }
  const sectionRow = { id: sectionRowId };
  const classSubjectRow = { id: subjectRowId };

  // Find students in this class section
  const sectionStudents = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(
      and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.classSectionId, sectionRow.id)
      )
    )
    .limit(5);

  let studentA = sectionStudents[0];
  if (!studentA) {
    const [anyStudent] = await db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);
    if (anyStudent) {
      await db.update(user).set({ classSectionId: sectionRow.id }).where(eq(user.id, anyStudent.id));
      studentA = anyStudent;
    } else {
      const newStuId = crypto.randomUUID();
      await db.insert(user).values({
        id: newStuId,
        tenantId,
        email: `student.test.${Date.now()}@schoolos.test`,
        name: 'Élève Test Live',
        role: 'student',
        classSectionId: sectionRow.id,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      studentA = { id: newStuId, name: 'Élève Test Live', role: 'student' };
    }
  }

  record(
    '4. Academic Roster Resolution',
    true,
    `Teacher=${teacher.name}, Section=${sectionRow.id}, Subject=${classSubjectRow.id}, Student=${studentA.name}`
  );

  // Clean up any prior audit sessions with this title to avoid schedule overlap
  await db.delete(liveClassSessions).where(
    and(
      eq(liveClassSessions.tenantId, tenantId),
      eq(liveClassSessions.title, 'Séance Audit Live Classrooms E2E')
    )
  );

  // Clean up any prior period 0 attendance registers for this section to allow fresh posting
  await db.delete(attendanceRegisters).where(
    and(
      eq(attendanceRegisters.tenantId, tenantId),
      eq(attendanceRegisters.classSectionId, sectionRow.id),
      eq(attendanceRegisters.period, 0)
    )
  );
  await db.delete(attendance).where(
    and(
      eq(attendance.tenantId, tenantId),
      eq(attendance.classSectionId, sectionRow.id),
      eq(attendance.period, 0)
    )
  );

  // 5. Session Scheduling (Create Session via Service)
  const now = new Date();
  const startTime = new Date(now.getTime() - 15 * 60 * 1000); // 15 mins ago
  const endTime = new Date(now.getTime() + 45 * 60 * 1000); // 45 mins future
  const startIso = startTime.toISOString();
  const endIso = endTime.toISOString();

  const adminCtx: RequestContext = {
    tenantId,
    userId: adminUser.id,
    role: adminUser.role as any,
    permissions: ['live.manage', 'live.read', 'live.host', 'live.attendance.manage', 'live.recordings.manage', 'live.reports.read', 'live.export'],
  };

  const createdSession = await createLiveSession(
    adminCtx,
    tenantId,
    {
      providerProfileId: profile.id,
      classSectionId: sectionRow.id,
      classSubjectId: classSubjectRow.id,
      teacherUserId: teacher.id,
      title: 'Séance Audit Live Classrooms E2E',
      description: 'Validation en temps réel du cycle de vie des sessions virtuelles',
      scheduledStart: startIso,
      scheduledEnd: endIso,
      timezone: 'Africa/Casablanca',
      policy: {
        recordingEnabled: true,
        allowChat: true,
        muteOnEntry: true,
        guestAccess: false,
        maxParticipants: 50,
      },
      adminOverrideReason: 'Séance d\'audit automatisée',
    }
  );

  const sessionId = createdSession.id;
  record('5. Session Scheduling', !!sessionId, `Session created: id=${sessionId}, status=${createdSession.status}`);

  // 6. Audience Invitations (Explicit Roster Invitation)
  await db.insert(liveClassInvitations).values({
    id: crypto.randomUUID(),
    tenantId,
    sessionId,
    userId: studentA.id,
    participantRole: 'viewer',
    joinEligible: true,
    deliveryState: 'delivered',
    createdAt: new Date().toISOString(),
  });

  const invitations = await db
    .select()
    .from(liveClassInvitations)
    .where(
      and(
        eq(liveClassInvitations.tenantId, tenantId),
        eq(liveClassInvitations.sessionId, sessionId)
      )
    );
  const studentInvited = invitations.some((i) => i.userId === studentA.id);
  record(
    '6. Audience Invitations',
    studentInvited,
    `Generated ${invitations.length} invitations; student ${studentA.id} invited=${studentInvited}`
  );

  // 7. Start Session (Scheduled -> Live)
  const started = await startLiveSession(adminCtx, tenantId, sessionId);
  record('7. Start Session', started.status === 'live', `Session transitioned to status=${started.status}`);

  // 7b. Attempt to start again (State machine validation: should be idempotent or reject)
  try {
    const doubleStart = await startLiveSession(adminCtx, tenantId, sessionId);
    record('7b. State Machine (Double Start)', doubleStart.status === 'live', 'Idempotent start accepted');
  } catch (err: any) {
    record('7b. State Machine (Double Start)', true, `Handled properly: ${err.message}`);
  }

  // 8. Join Token Issuance (Student joins)
  const studentCtx: RequestContext = {
    tenantId,
    userId: studentA.id,
    role: 'student',
    permissions: ['live.join', 'live.read'],
  };

  const joinGrant = await issueJoinGrant(studentCtx, tenantId, sessionId);
  record(
    '8. Join Token Issuance',
    !!joinGrant.token,
    `Token issued for student: role=${joinGrant.role}, expiresAt=${joinGrant.expiresAt}`
  );

  // 9. Single-Use Token Redemption
  const redemption = await redeemJoinGrant(studentCtx, tenantId, sessionId, joinGrant.token);
  record('9. Single-Use Token Redemption', !!redemption.url, `Redeemed successfully: url=${redemption.url}, role=${redemption.role}`);

  // 10. Replay Prevention: Redeeming the exact same token again MUST fail
  let replayBlocked = false;
  try {
    await redeemJoinGrant(studentCtx, tenantId, sessionId, joinGrant.token);
  } catch (err: any) {
    replayBlocked = err.message.includes('REPLAY') || err.message.includes('utilisé') || err.code === 'JOIN_GRANT_REPLAYED' || err.status === 409 || err.status === 422;
    record(
      '10. Security: Anti-Replay Defense',
      replayBlocked,
      `Replay attempt rejected: ${err.message} (status=${err.status})`
    );
  }
  if (!replayBlocked) {
    record('10. Security: Anti-Replay Defense', false, 'CRITICAL: Replayed token was accepted!');
  }

  // 11. Security: Forged / Tampered Token
  let forgedBlocked = false;
  try {
    const forgedToken = joinGrant.token.slice(0, -6) + 'abcdef';
    await redeemJoinGrant(studentCtx, tenantId, sessionId, forgedToken);
  } catch (err: any) {
    forgedBlocked = true;
    record('11. Security: Forged Token Defense', true, `Forged token rejected: ${err.message}`);
  }
  if (!forgedBlocked) {
    record('11. Security: Forged Token Defense', false, 'CRITICAL: Forged token was accepted!');
  }

  // 12. Security: Cross-Tenant Isolation probe
  const foreignTenantId = crypto.randomUUID();
  let crossTenantBlocked = false;
  try {
    const foreignCtx: RequestContext = {
      tenantId: foreignTenantId,
      userId: crypto.randomUUID(),
      role: 'student',
      permissions: ['live.join'],
    };
    await issueJoinGrant(foreignCtx, foreignTenantId, sessionId);
  } catch (err: any) {
    crossTenantBlocked = true;
    record('12. Security: Cross-Tenant Isolation', true, `Cross-tenant access prevented: ${err.message}`);
  }
  if (!crossTenantBlocked) {
    record('12. Security: Cross-Tenant Isolation', false, 'CRITICAL: Cross-tenant access succeeded!');
  }

  // 13. Telemetry & In-Session Events
  const joinEventTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const reconnectEventTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const leaveEventTime = new Date(now.getTime() - 1 * 60 * 1000).toISOString();

  await db.insert(liveClassParticipantEvents).values([
    {
      id: crypto.randomUUID(),
      tenantId,
      sessionId,
      providerEventId: `dev-ev-join-${Date.now()}`,
      providerProfileId: profile.id,
      userId: studentA.id,
      eventType: 'joined',
      participantRole: 'viewer',
      providerTimestamp: joinEventTime,
      processingStatus: 'processed',
      createdAt: joinEventTime,
    },
    {
      id: crypto.randomUUID(),
      tenantId,
      sessionId,
      providerEventId: `dev-ev-rec-${Date.now()}`,
      providerProfileId: profile.id,
      userId: studentA.id,
      eventType: 'reconnect',
      participantRole: 'viewer',
      providerTimestamp: reconnectEventTime,
      processingStatus: 'processed',
      createdAt: reconnectEventTime,
    },
    {
      id: crypto.randomUUID(),
      tenantId,
      sessionId,
      providerEventId: `dev-ev-leave-${Date.now()}`,
      providerProfileId: profile.id,
      userId: studentA.id,
      eventType: 'left',
      participantRole: 'viewer',
      providerTimestamp: leaveEventTime,
      processingStatus: 'processed',
      createdAt: leaveEventTime,
    },
  ]);
  record('13. Telemetry Events Recorded', true, 'Inserted joined, reconnect, left events into immutable participant events');

  // 14. End Session (Live -> Ended)
  const ended = await endLiveSession(adminCtx, tenantId, sessionId);
  record('14. End Session', ended.status === 'ended', `Session ended: status=${ended.status}`);

  // 15. State Machine: Prevent Joining an Ended Session
  let joinEndedBlocked = false;
  try {
    await issueJoinGrant(studentCtx, tenantId, sessionId);
  } catch (err: any) {
    joinEndedBlocked = true;
    record('15. State Machine: Join Ended Session', true, `Join ended session rejected: ${err.message}`);
  }
  if (!joinEndedBlocked) {
    record('15. State Machine: Join Ended Session', false, 'Allowed joining an ended session!');
  }

  // 16. Attendance Reconciliation
  const reconciled = await reconcileAttendance(adminCtx, tenantId, sessionId, { note: 'Auto-reconciliation audit' });
  record(
    '16. Attendance Reconciliation',
    reconciled.length > 0,
    `Reconciled ${reconciled.length} attendees. Student status=${reconciled.find((r) => r.userId === studentA.id)?.status}`
  );

  // 17. Post Attendance to Core Register (REGISTER_PERIOD = 0)
  const postResult = await postAttendance(adminCtx, tenantId, sessionId, { note: 'Report audit live' });
  record(
    '17. Post Attendance to Register',
    postResult.posted >= 1,
    `Posted ${postResult.posted} attendance records to core attendance register (skipped=${postResult.skipped})`
  );

  // 18. Idempotency of Attendance Posting: Double post must return NOTHING_TO_POST or 0
  let doublePostHandled = false;
  try {
    const secondPost = await postAttendance(adminCtx, tenantId, sessionId, {});
    doublePostHandled = secondPost.posted === 0;
    record(
      '18. Idempotency: Double Post Defense',
      doublePostHandled,
      `Double post returned posted=0 (idempotent no-op)`
    );
  } catch (err: any) {
    doublePostHandled = err.message.includes('NOTHING_TO_POST') || err.status === 422 || err.status === 409;
    record('18. Idempotency: Double Post Defense', doublePostHandled, `Double post rejected: ${err.message}`);
  }

  // 19. Verify Core Attendance Table Row
  const coreAttendanceRows = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.tenantId, tenantId),
        eq(attendance.studentId, studentA.id),
        eq(attendance.classSectionId, sectionRow.id),
        eq(attendance.period, 0)
      )
    );
  record(
    '19. Core Attendance Persistence',
    coreAttendanceRows.length > 0,
    `Found core attendance row: status=${coreAttendanceRows[0]?.status}, period=${coreAttendanceRows[0]?.period}`
  );

  // 20. Materials Linkage via Attachments Book integration
  let [anyAsset] = await db
    .select({ id: digitalAssets.id })
    .from(digitalAssets)
    .where(and(eq(digitalAssets.tenantId, tenantId), eq(digitalAssets.status, 'published')))
    .limit(1);

  if (!anyAsset) {
    let [attType] = await db.select().from(attachmentTypes).where(eq(attachmentTypes.tenantId, tenantId)).limit(1);
    if (!attType) {
      const typeId = crypto.randomUUID();
      await db.insert(attachmentTypes).values({
        id: typeId,
        tenantId,
        name: 'Documents de cours',
        code: `DOCS_${Date.now()}`,
        allowedMimeFamilies: ['document', 'pdf'],
        maxSizeBytes: 10485760,
        studentVisible: true,
        downloadable: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      [attType] = await db.select().from(attachmentTypes).where(eq(attachmentTypes.id, typeId));
    }
    const assetId = crypto.randomUUID();
    await db.insert(digitalAssets).values({
      id: assetId,
      tenantId,
      title: 'Support Cours Virtuel PDF',
      attachmentTypeId: attType!.id,
      ownerId: adminUser.id,
      status: 'published',
      downloadable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    anyAsset = { id: assetId };
  }

  const attached = await attachMaterial(adminCtx, tenantId, sessionId, anyAsset.id);
  const materials = await listSessionMaterials(tenantId, sessionId);
  record('20. Materials Attachment', materials.some((m) => m.assetId === anyAsset!.id), `Attached material: title=${attached.title}`);

  await detachMaterial(adminCtx, tenantId, sessionId, anyAsset.id);
  const materialsAfter = await listSessionMaterials(tenantId, sessionId);
  record('20b. Materials Detachment', !materialsAfter.some((m) => m.assetId === anyAsset!.id), 'Detached material cleanly');

  // 21. Recordings Linkage
  const recordingId = crypto.randomUUID();
  await db.insert(liveClassRecordings).values({
    id: recordingId,
    tenantId,
    sessionId,
    providerRecordingId: `rec-audit-${Date.now()}`,
    state: 'ready',
    playbackUrl: 'https://storage.schoolos.test/recordings/audit-session.mp4',
    downloadUrl: 'https://storage.schoolos.test/recordings/audit-session.mp4',
    durationSeconds: 1800,
    createdBy: adminUser.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const recordings = await listSessionRecordings(tenantId, sessionId);
  record('21. Recording Linkage', recordings.length > 0, `Recording created: state=${recordings[0]?.state}, duration=${recordings[0]?.durationSeconds}s`);

  // 22. Reports Engine Probes: Overview, Session List, CSV Export
  const overview = await getOverview(tenantId, {});
  record(
    '22. Reports Engine (Overview)',
    overview.totalSessions >= 1,
    `Overview: totalSessions=${overview.totalSessions}, totalHours=${overview.totalDurationMinutes / 60}h, averagePresence=${overview.averagePresenceRate}%`
  );

  const sessionReports = await listSessionReports(tenantId, {});
  record(
    '23. Reports Engine (Session Reports)',
    sessionReports.length >= 1,
    `Session reports returned ${sessionReports.length} sessions (first title=${sessionReports[0]?.title})`
  );

  const csv = await exportSessionReportsCsv(tenantId, {});
  record(
    '24. Reports Engine (CSV Export)',
    csv.includes('Titre') || csv.includes('Date'),
    `CSV export generated successfully (${csv.length} bytes)`
  );

  // 25. Timezone Integrity Check (Africa/Casablanca display vs UTC persistence)
  const [loadedSession] = await db.select().from(liveClassSessions).where(eq(liveClassSessions.id, sessionId));
  const tzMatch = loadedSession?.timezone === 'Africa/Casablanca';
  record(
    '25. Timezone Verification',
    tzMatch,
    `Session timezone stored as ${loadedSession?.timezone}; start=${loadedSession?.scheduledStart}, end=${loadedSession?.scheduledEnd}`
  );

  console.log('\n=== ALL 25 RUNTIME E2E AUDIT STEPS PASSED SUCCESSFULLY ===\n');

  return { sessionId, studentId: studentA.id, teacherId: teacher.id, tenantId };
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E Audit Execution Failed:', err);
    process.exit(1);
  });
