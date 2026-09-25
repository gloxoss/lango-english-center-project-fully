// @ts-nocheck
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/libs/DB';
import {
  addonEntitlements,
  classes,
  classSections,
  classSubjects,
  liveClassInvitations,
  liveClassJoinGrants,
  liveClassParticipantEvents,
  liveClassProviderProfiles,
  liveClassSessions,
  studentPlacements,
  tenants,
  user,
} from '../src/models/Schema';
import { issueJoinGrant, redeemJoinGrant } from '../src/features/live-classrooms/services/join-service';
import { startLiveSession } from '../src/features/live-classrooms/services/session-service';
import { fork } from 'child_process';
import path from 'path';

// If running as a child process worker for Probe 3 or Probe 4
if (process.env.ADVERSARIAL_WORKER === '1') {
  const { tenantId, sessionId, token, userId, role } = JSON.parse(process.env.WORKER_PAYLOAD || '{}');
  const ctx = {
    userId,
    tenantId,
    role,
    name: 'Worker User',
    email: `${userId}@test.ma`,
    permissions: role === 'student' ? ['live.join'] : ['live.read'],
  };
  redeemJoinGrant(ctx, tenantId, sessionId, token)
    .then((res) => {
      console.log(JSON.stringify({ ok: true, url: res.url }));
      process.exit(0);
    })
    .catch((err) => {
      console.log(JSON.stringify({ ok: false, status: err.status, code: err.code, message: err.message }));
      process.exit(1);
    });
} else {
  runParentSuite();
}

async function runChildWorker(payload: any): Promise<{ ok: boolean; status?: number; code?: string; message?: string }> {
  return new Promise((resolve) => {
    const child = fork(__filename, [], {
      env: {
        ...process.env,
        ADVERSARIAL_WORKER: '1',
        WORKER_PAYLOAD: JSON.stringify(payload),
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    let stdout = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stdout += d.toString(); });

    child.on('close', () => {
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        const last = lines[lines.length - 1];
        resolve(JSON.parse(last));
      } catch {
        resolve({ ok: false, message: stdout.trim() });
      }
    });
  });
}

async function runParentSuite() {
  console.log('=== AUD-LIVE-01: Join Grant Anti-Replay Durability & Multi-Instance Verification ===\n');

  // 1. Resolve Atlas tenant and test accounts
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, 'atlas')).limit(1);
  if (!tenant) throw new Error('Atlas tenant not found');
  const tenantId = tenant.id;

  // Resolve student with existing active placement
  const [placement] = await db
    .select()
    .from(studentPlacements)
    .where(and(eq(studentPlacements.tenantId, tenantId), eq(studentPlacements.isCurrent, true)))
    .limit(1);
  if (!placement) throw new Error('No active student placement in Atlas');

  const [student] = await db
    .select()
    .from(user)
    .where(eq(user.id, placement.studentId))
    .limit(1);
  if (!student) throw new Error('Student not found');

  const [teacher] = await db
    .select()
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
    .limit(1);
  if (!teacher) throw new Error('Teacher not found');

  const [section] = await db
    .select()
    .from(classSections)
    .where(eq(classSections.id, placement.classSectionId))
    .limit(1);

  const [subject] = await db
    .select()
    .from(classSubjects)
    .where(eq(classSubjects.tenantId, tenantId))
    .limit(1);

  const [profile] = await db
    .select()
    .from(liveClassProviderProfiles)
    .where(and(eq(liveClassProviderProfiles.tenantId, tenantId), eq(liveClassProviderProfiles.enabled, true)))
    .limit(1);
  if (!profile) throw new Error('No provider profile');

  // Clean up any prior test sessions with this title
  await db.delete(liveClassSessions).where(eq(liveClassSessions.title, 'Adversarial Join Token Verification'));

  // Create an active live session for testing join tokens (status: live is joinable)
  const future = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  const startTime = future.toISOString().replace('T', ' ').slice(0, 19);
  const endTime = new Date(future.getTime() + 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const sessionId = crypto.randomUUID();

  await db.insert(liveClassSessions).values({
    id: sessionId,
    tenantId,
    providerProfileId: profile.id,
    teacherUserId: teacher.id,
    creatorUserId: teacher.id,
    classSectionId: section.id,
    classSubjectId: subject.id,
    title: 'Adversarial Join Token Verification',
    scheduledStart: startTime,
    scheduledEnd: endTime,
    status: 'live',
    providerMeetingId: `adv-meet-${sessionId.slice(0, 8)}`,
    policy: { recordSession: false, muteOnEntry: true, allowWebcam: true, guestAllowed: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.insert(liveClassInvitations).values({
    id: crypto.randomUUID(),
    tenantId,
    sessionId,
    userId: student.id,
    participantRole: 'student',
    joinEligible: true,
    createdAt: new Date().toISOString(),
  });

  const studentCtx = {
    userId: student.id,
    tenantId,
    role: 'student',
    name: student.name,
    email: student.email,
    permissions: ['live.join'],
  };

  console.log(`[SETUP] Created test live session ${sessionId} with student ${student.name} (${student.id})`);

  // --- PROBE 1 & 2: Single Use and Same-Process Replay ---
  console.log('\n--- PROBE 1: Issue unexpired join grant and redeem once ---');
  const grant1 = await issueJoinGrant(studentCtx, tenantId, sessionId);
  console.log(`[MINT] Issued token: expiresAt=${grant1.expiresAt}, role=${grant1.role}`);

  const redeem1 = await redeemJoinGrant(studentCtx, tenantId, sessionId, grant1.token);
  console.log(`[PASS] Probe 1: Redeemed successfully -> URL: ${redeem1.url.slice(0, 45)}...`);

  console.log('\n--- PROBE 2: Replay same token in same process ---');
  try {
    await redeemJoinGrant(studentCtx, tenantId, sessionId, grant1.token);
    console.error('[FAIL] Probe 2: Token was re-redeemed! Expected rejection.');
    process.exit(1);
  } catch (err: any) {
    if (err.status === 401 && err.code === 'JOIN_GRANT_REPLAYED') {
      console.log(`[PASS] Probe 2: Rejected same-process replay: status=${err.status}, code=${err.code}, message="${err.message}"`);
    } else {
      console.error(`[FAIL] Probe 2: Unexpected error: ${err.message}`);
      process.exit(1);
    }
  }

  // --- PROBE 3: Process Restart / Independent Process Replay ---
  console.log('\n--- PROBE 3: Replay same token in independent child process (Simulating App Restart) ---');
  const probe3Result = await runChildWorker({
    tenantId,
    sessionId,
    token: grant1.token,
    userId: student.id,
    role: 'student',
  });
  if (!probe3Result.ok && probe3Result.status === 401 && probe3Result.code === 'JOIN_GRANT_REPLAYED') {
    console.log(`[PASS] Probe 3: Rejected restart/new-process replay: status=${probe3Result.status}, code=${probe3Result.code}`);
  } else {
    console.error(`[FAIL] Probe 3: Failed to reject replay across process boundary:`, probe3Result);
    process.exit(1);
  }

  // --- PROBE 4: Concurrent Multi-Instance Race / Atomic Redemption ---
  console.log('\n--- PROBE 4: Multi-Instance Race: Concurrent Redemption Across Independent Instances ---');
  const grant2 = await issueJoinGrant(studentCtx, tenantId, sessionId);
  console.log(`[MINT] Issued second token for race condition test: ${grant2.token.slice(0, 30)}...`);

  // Launch two independent OS processes trying to redeem grant2 at the same exact time
  const [workerA, workerB] = await Promise.all([
    runChildWorker({ tenantId, sessionId, token: grant2.token, userId: student.id, role: 'student' }),
    runChildWorker({ tenantId, sessionId, token: grant2.token, userId: student.id, role: 'student' }),
  ]);

  console.log(`  Worker A response: ok=${workerA.ok}, status=${workerA.status || 200}, code=${workerA.code || 'SUCCESS'}`);
  console.log(`  Worker B response: ok=${workerB.ok}, status=${workerB.status || 200}, code=${workerB.code || 'SUCCESS'}`);

  const winners = [workerA, workerB].filter((w) => w.ok);
  const losers = [workerA, workerB].filter((w) => !w.ok);

  if (winners.length === 1 && losers.length === 1 && losers[0].code === 'JOIN_GRANT_REPLAYED') {
    console.log(`[PASS] Probe 4: Atomic concurrency preserved! Exactly 1 winner and 1 loser with JOIN_GRANT_REPLAYED.`);
  } else {
    console.error(`[FAIL] Probe 4: Race condition detected! winners=${winners.length}, losers=${losers.length}`);
    process.exit(1);
  }

  // --- PROBE 5: Security Boundary Checks ---
  console.log('\n--- PROBE 5: Preserved Security Boundaries ---');

  // 5a: Forged HMAC Signature
  const forgedToken = grant2.token.slice(0, -6) + 'abcdef';
  try {
    await redeemJoinGrant(studentCtx, tenantId, sessionId, forgedToken);
    console.error('[FAIL] 5a: Forged token was accepted!');
    process.exit(1);
  } catch (err: any) {
    if (err.status === 401 && err.code === 'JOIN_GRANT_INVALID') {
      console.log(`[PASS] 5a: Forged HMAC token rejected: ${err.message}`);
    } else {
      console.error(`[FAIL] 5a: Unexpected error for forged token: ${err.message}`);
      process.exit(1);
    }
  }

  // 5b: Cross-Tenant Session IDOR
  const fakeOtherTenantId = '5be685d1-27ef-4234-ad57-1e3f5826a540'; // Lango Center
  try {
    const grantOther = await issueJoinGrant(studentCtx, fakeOtherTenantId, sessionId);
    console.error('[FAIL] 5b: Cross-tenant join grant was issued!');
    process.exit(1);
  } catch (err: any) {
    if (err.status === 404) {
      console.log(`[PASS] 5b: Cross-tenant session lookup rejected with 404 Not Found`);
    } else {
      console.error(`[FAIL] 5b: Unexpected error: ${err.message}`);
      process.exit(1);
    }
  }

  // 5c: Join Ended Session
  const endedSessionId = crypto.randomUUID();
  await db.insert(liveClassSessions).values({
    id: endedSessionId,
    tenantId,
    providerProfileId: profile.id,
    teacherUserId: teacher.id,
    creatorUserId: teacher.id,
    classSectionId: section.id,
    classSubjectId: subject.id,
    title: 'Ended Session Test',
    scheduledStart: startTime.replace('T', ' ').slice(0, 19),
    scheduledEnd: endTime.replace('T', ' ').slice(0, 19),
    status: 'ended',
    policy: { recordSession: false, muteOnEntry: true, allowWebcam: true, guestAllowed: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  try {
    await issueJoinGrant(studentCtx, tenantId, endedSessionId);
    console.error('[FAIL] 5c: Issued join grant for ended session!');
    process.exit(1);
  } catch (err: any) {
    if (err.status === 409 && err.code === 'SESSION_ENDED') {
      console.log(`[PASS] 5c: Ended session rejected: ${err.message}`);
    } else {
      console.error(`[FAIL] 5c: Unexpected error for ended session: ${err.message}`);
      process.exit(1);
    }
  }

  // 5d: Uninvited / Non-placed student
  const unplacedCtx = {
    userId: 'unplaced-student-' + crypto.randomUUID(),
    tenantId,
    role: 'student',
    name: 'Unplaced Student',
    email: 'unplaced@test.ma',
    permissions: ['live.join'],
  };
  try {
    await issueJoinGrant(unplacedCtx, tenantId, sessionId);
    console.error('[FAIL] 5d: Unplaced student was issued a join grant!');
    process.exit(1);
  } catch (err: any) {
    if (err.status === 403 && err.code === 'STUDENT_NOT_PLACED') {
      console.log(`[PASS] 5d: Unplaced student rejected with 403 STUDENT_NOT_PLACED`);
    } else {
      console.error(`[FAIL] 5d: Unexpected error for unplaced student: ${err.message}`);
      process.exit(1);
    }
  }

  // 5e: Database Persistence Verification
  const [persistedRow] = await db
    .select()
    .from(liveClassJoinGrants)
    .where(and(eq(liveClassJoinGrants.sessionId, sessionId), eq(liveClassJoinGrants.userId, student.id)))
    .limit(1);

  console.log(`\n[DB VERIFICATION] live_class_join_grants row:`);
  console.log(`  id: ${persistedRow.id}`);
  console.log(`  tenantId: ${persistedRow.tenantId}`);
  console.log(`  nonceHash: ${persistedRow.nonceHash}`);
  console.log(`  expiresAt: ${persistedRow.expiresAt}`);
  console.log(`  redeemedAt: ${persistedRow.redeemedAt}`);
  console.log(`  isRedeemed: ${persistedRow.redeemedAt !== null}`);

  console.log('\n=== ALL ADVERSARIAL PROBES PASSED WITH 100% DURABILITY ===\n');
}
