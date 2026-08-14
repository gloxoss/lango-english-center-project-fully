// Live acceptance verification for Broadcast Messaging (Phase 4 backend).
// Hits the running dev server (:3002) with real sessions and verifies real DB
// rows: connections (masked secrets), templates (versioned publish), segments,
// campaigns (preview / approve / snapshot / worker / report / export),
// consent/suppression exclusions, idempotency, scheduling/cancel, bounce+retry,
// cross-tenant isolation, forbidden-field projection, and the provider webhook.
// Run: node scripts/verify-broadcast.mjs
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const body = await res.json().catch(() => ({}));
  if (!setCookies) throw new Error(`sign-in for ${email} returned no cookie (${res.status} ${JSON.stringify(body).slice(0, 200)})`);
  return { cookie: setCookies, body };
}

async function api(cookie, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

const PASSWORD = 'Admin123!';
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const runId = randomUUID().slice(0, 8);
const mark = `[verify-${runId}]`;
const tag = `vfy-${runId}`;
const schedTag = `vfy-sched-${runId}`;

// Best-effort read of the webhook HMAC secret (same resolution as the route).
function webhookSecret() {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const get = (k) => env.split('\n').map((l) => l.trim()).find((l) => l.startsWith(k + '='))?.split('=').slice(1).join('=');
    return get('WEBHOOK_SIGNING_KEY') || get('BETTER_AUTH_SECRET') || null;
  } catch { return null; }
}

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', PASSWORD); // Atlas school_admin
  const langoAdmin = await signIn('admin@lango.ma', PASSWORD); // Lango school_admin
  console.log('→ signed in as Atlas admin and Lango admin\n');

  const b = (p) => `/api/addons/broadcast/${p}`;

  // ------------------------------------------------------------------ cleanup
  await pool.query(`DELETE FROM communication_delivery_events WHERE tenant_id=$1 AND campaign_id IN
    (SELECT id FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_deliveries WHERE tenant_id=$1 AND campaign_id IN
    (SELECT id FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_campaign_recipients WHERE tenant_id=$1 AND campaign_id IN
    (SELECT id FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_automation_recipients WHERE tenant_id=$1 AND run_id IN
    (SELECT id FROM communication_automation_runs WHERE tenant_id=$1 AND automation_id IN
      (SELECT id FROM communication_automations WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS]);
  await pool.query(`DELETE FROM communication_automation_runs WHERE tenant_id=$1 AND automation_id IN
    (SELECT id FROM communication_automations WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_automations WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_template_versions WHERE tenant_id=$1 AND template_id IN
    (SELECT id FROM communication_templates WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_templates WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_segments WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_connections WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_suppressions WHERE tenant_id=$1 AND reason LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_consents WHERE tenant_id=$1 AND source='verify'`, [ATLAS]);
  await pool.query(`DELETE FROM inquiry_follow_ups WHERE tenant_id=$1 AND inquiry_id IN
    (SELECT id FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM "user" WHERE tenant_id=$1 AND email LIKE 'vfy-bday-%'`, [ATLAS]);

  let r;
  const ids = {};

  // =================================================================
  // 1. Connections — secrets encrypted at rest, masked on read, testable
  // =================================================================
  r = await api(admin.cookie, b('connections'), {
    method: 'POST', body: { channel: 'sms', name: `Vfy Conn ${mark}`, provider: 'test', config: { apiKey: 'sk-test-123456', sender: 'LANGO' } },
  });
  check('POST connection → 201', r.status === 201 && r.json?.data?.id, `status ${r.status}`);
  ids.conn = r.json?.data?.id;
  check('connection config masks apiKey', r.json?.data?.config?.apiKey === '••••••••' && r.json?.data?.config?.sender === 'LANGO',
    JSON.stringify(r.json?.data?.config));
  check('connection config never returns plaintext secret', !JSON.stringify(r.json?.data?.config).includes('sk-test-123456'), '');

  r = await api(admin.cookie, b(`connections/${ids.conn}/test`), { method: 'POST' });
  check('POST connection test → ok', r.status === 200 && r.json?.data?.ok === true, `status ${r.status} ${r.json?.data?.message}`);

  r = await api(admin.cookie, b('connections'));
  check('GET connections lists masked secret', r.status === 200 && r.json?.data?.some((c) => c.id === ids.conn && c.config?.apiKey === '••••••••'),
    `count ${r.json?.data?.length}`);

  // =================================================================
  // 2. Templates — versioned, publish immutable
  // =================================================================
  r = await api(admin.cookie, b('templates'), {
    method: 'POST', body: { name: `Vfy Tpl ${mark}`, channel: 'sms', category: 'general',
      initial: { subject: 'Chers parents', bodyText: 'Bonjour {{firstName}}, rappel de rentrée le 1er septembre.' } },
  });
  check('POST template → 201', r.status === 201 && r.json?.data?.template?.id && r.json?.data?.version?.id, `status ${r.status}`);
  ids.tpl = r.json?.data?.template?.id;
  ids.tplVer1 = r.json?.data?.version?.id;
  check('template auto-extracts variables', Array.isArray(r.json?.data?.version?.variableSchema) && r.json?.data?.version?.variableSchema?.some((v) => v.name === 'firstName'),
    JSON.stringify(r.json?.data?.version?.variableSchema));

  r = await api(admin.cookie, b(`templates/${ids.tpl}/versions/${ids.tplVer1}/publish`), { method: 'POST' });
  check('publish version → 200', r.status === 200 && r.json?.data?.status === 'published', `status ${r.status}`);
  r = await api(admin.cookie, b(`templates/${ids.tpl}/versions/${ids.tplVer1}/publish`), { method: 'POST' });
  check('re-publish same version → 422 ALREADY_PUBLISHED', r.status === 422 && r.json?.error?.code === 'ALREADY_PUBLISHED',
    `status ${r.status} code ${r.json?.error?.code}`);

  r = await api(admin.cookie, b(`templates/${ids.tpl}/versions`), {
    method: 'POST', body: { bodyText: '{{firstName}}, deuxième version.' } });
  ids.tplVer2 = r.json?.data?.id;
  r = await api(admin.cookie, b(`templates/${ids.tpl}/versions/${ids.tplVer2}/publish`), { method: 'POST' });
  check('publish v2 downgrades v1 to draft (one published max)', r.status === 200,
    `v2 ${r.json?.data?.status}`);
  r = await api(admin.cookie, b(`templates/${ids.tpl}/versions`));
  const publishedCount = r.json?.data?.filter((v) => v.status === 'published').length;
  check('exactly one published version', publishedCount === 1, `published ${publishedCount}`);

  // =================================================================
  // 3. Segments — inquiry-based with unique tag (deterministic counts)
  // =================================================================
  const mkInquiry = async (name, phone, email, extra = {}) => {
    const rr = await api(admin.cookie, '/api/crm/inquiries', {
      method: 'POST', body: { contactName: `${name} ${mark}`, phone, email, source: 'web', tags: [tag], ...extra } });
    return rr.json?.data?.id;
  };
  ids.p1 = await mkInquiry('P1 Sent', '+212 6 61 00 00 01', `p1.${runId}@verify.ma`);
  ids.p2 = await mkInquiry('P2 Delivered', '0661DELIVERED01', `p2.${runId}@verify.ma`);
  ids.p3 = await mkInquiry('P3 NoConsent', '+212 6 61 00 00 03', `p3.${runId}@verify.ma`);
  ids.p4 = await mkInquiry('P4 Suppressed', '+212 6 61 00 00 04', `p4.${runId}@verify.ma`);
  ids.p5 = await mkInquiry('P5 EmailOnly', undefined, `p5.${runId}@verify.ma`);
  check('created 5 test inquiries', Boolean(ids.p1 && ids.p2 && ids.p3 && ids.p4 && ids.p5), '');

  // consent revoke for P3 (sms), suppression for P4 (sms)
  r = await api(admin.cookie, b('consents'), {
    method: 'POST', body: { recipientKind: 'inquiry', recipientId: ids.p3, channel: 'sms', granted: false, source: 'verify' } });
  check('revoke consent for P3 → ok', r.status === 200, `status ${r.status}`);
  r = await api(admin.cookie, b('suppressions'), {
    method: 'POST', body: { recipientKind: 'inquiry', recipientId: ids.p4, channel: 'sms', reason: `[verify-${runId}]` } });
  check('add suppression for P4 → 201', r.status === 201, `status ${r.status}`);

  r = await api(admin.cookie, b('segments'), {
    method: 'POST', body: { name: `Vfy Seg ${mark}`, description: 'verify', definition: { kind: 'inquiry', filters: { tag } } } });
  check('POST segment → 201 with member count', r.status === 201 && r.json?.data?.id && r.json?.data?.memberCount === 5,
    `status ${r.status} count ${r.json?.data?.memberCount}`);
  ids.seg = r.json?.data?.id;

  r = await api(admin.cookie, b('segments'));
  check('GET segments lists the segment', r.status === 200 && r.json?.data?.some((s) => s.id === ids.seg), `count ${r.json?.data?.length}`);

  // =================================================================
  // 4. Campaign — preview exclusions, approve snapshot, worker, report
  // =================================================================
  r = await api(admin.cookie, b('campaigns'), {
    method: 'POST', body: {
      name: `Vfy Campaign ${mark}`, channel: 'sms', connectionId: ids.conn, segmentId: ids.seg,
      bodyText: 'Bonjour, message de vérification broadcast.', idempotencyKey: `vfy-${runId}-key`,
    },
  });
  check('POST campaign → 201', r.status === 201 && r.json?.data?.id, `status ${r.status}`);
  ids.campaign = r.json?.data?.id;

  r = await api(admin.cookie, b('campaigns'), {
    method: 'POST', body: {
      name: `Vfy Campaign Dup ${mark}`, channel: 'sms', connectionId: ids.conn, segmentId: ids.seg,
      bodyText: 'doublon', idempotencyKey: `vfy-${runId}-key`,
    },
  });
  check('replay with same idempotency key returns SAME campaign', r.status === 201 && r.json?.data?.id === ids.campaign,
    `id ${r.json?.data?.id}`);

  r = await api(admin.cookie, b(`campaigns/${ids.campaign}/preview`), { method: 'POST' });
  const t = r.json?.data;
  check('preview counts match (targeted 5, invalid 1, consent 1, suppression 1, enqueued 2)',
    r.status === 200 && t?.targeted === 5 && t?.invalid === 1 && t?.consentExcluded === 1 && t?.suppressionExcluded === 1 && t?.enqueued === 2,
    JSON.stringify(t));

  r = await api(admin.cookie, b(`campaigns/${ids.campaign}/approve`), { method: 'POST' });
  check('approve → queued with snapshot counts', r.status === 200 && r.json?.data?.campaign?.status === 'queued'
    && r.json?.data?.campaign?.enqueuedCount === 2, `status ${r.status} ${r.json?.data?.campaign?.status}`);

  const { rows: snap } = await pool.query(
    `SELECT status, skip_reason, COUNT(*)::int c FROM communication_campaign_recipients WHERE tenant_id=$1 AND campaign_id=$2 GROUP BY status, skip_reason`,
    [ATLAS, ids.campaign],
  );
  check('DB: recipient snapshot rows persisted (2 pending + 3 skipped)',
    snap.reduce((s, x) => s + x.c, 0) === 5 && snap.some((x) => x.status === 'pending' && x.c === 2),
    JSON.stringify(snap));

  r = await api(admin.cookie, b('worker/process'), { method: 'POST', body: { batch: 50 } });
  const w = r.json?.data;
  check('worker dispatch → deliveries claimed', r.status === 200 && (w?.claimedDeliveries >= 2 || w?.sent + w?.delivered >= 2),
    JSON.stringify(w));

  const { rows: delivs } = await pool.query(
    `SELECT d.status, d.provider_ref, d.recipient_id FROM communication_deliveries d
     WHERE d.tenant_id=$1 AND d.campaign_id=$2 ORDER BY d.created_at`, [ATLAS, ids.campaign],
  );
  const delivStatuses = delivs.map((x) => x.status).sort().join(',');
  check('DB: deliveries P1 sent + P2 delivered', delivs.length === 2 && delivStatuses === 'delivered,sent',
    `statuses ${delivStatuses}`);

  const { rows: evts } = await pool.query(
    `SELECT COUNT(*)::int c FROM communication_delivery_events WHERE tenant_id=$1 AND campaign_id=$2 AND event_type IN ('sent','delivered')`,
    [ATLAS, ids.campaign],
  );
  check('DB: append-only delivery events written', evts[0]?.c === 2, `count ${evts[0]?.c}`);

  r = await api(admin.cookie, b(`campaigns/${ids.campaign}/recipients?pageSize=50`));
  check('GET recipients lists per-recipient delivery state', r.status === 200 && r.json?.data?.rows?.length === 5
    && r.json?.data?.rows?.some((x) => x.delivery?.status === 'delivered'), `rows ${r.json?.data?.rows?.length}`);

  r = await api(admin.cookie, b(`campaigns/${ids.campaign}/report`));
  const rep = r.json?.data?.counts;
  check('report counts match (sent 2, delivered 1, skipped 3)', r.status === 200 && rep?.sent === 2 && rep?.delivered === 1 && rep?.skipped === 3,
    JSON.stringify(rep));

  r = await api(admin.cookie, b(`campaigns/${ids.campaign}/report`));
  check('campaign terminal status completed', r.json?.data?.status === 'completed', `status ${r.json?.data?.status}`);

  r = await api(admin.cookie, b(`campaigns/${ids.campaign}/export`));
  check('export → CSV with masked contacts', r.status === 200 && r.text.includes('name,phone,email,status') && r.text.includes('…'),
    `bytes ${r.text.length}`);

  const forbidden = ['guardianId', 'studentId', 'salary', 'nationalId', 'financeBalance', 'privateNote', 'matricule', 'paymentStatus'];
  const campaignLeaks = forbidden.filter((k) => Object.prototype.hasOwnProperty.call(r.json?.data ?? {}, k));
  const recipientsJson = JSON.stringify(await (async () => (await api(admin.cookie, b(`campaigns/${ids.campaign}/recipients?pageSize=50`))).json?.data)());
  const recipientLeaks = forbidden.filter((k) => recipientsJson.includes(`"${k}"`));
  check('no forbidden fields leak into campaign/recipient projections', campaignLeaks.length === 0 && recipientLeaks.length === 0,
    `campaign [${campaignLeaks}] recipient [${recipientLeaks}]`);

  // =================================================================
  // 5. Failure handling — bounce (permanent) + retry (transient)
  // =================================================================
  await pool.query(`DELETE FROM inquiry_follow_ups WHERE tenant_id=$1 AND inquiry_id IN (SELECT id FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%')`, [ATLAS]);
  const f1 = await mkInquiry('F1 Bounce', '0661BOUNCE01', `f1.${runId}@verify.ma`);
  const f2 = await mkInquiry('F2 Retry', 'RETRYFAIL01', `f2.${runId}@verify.ma`);
  r = await api(admin.cookie, b('segments'), {
    method: 'POST', body: { name: `Vfy SegFail ${mark}`, definition: { kind: 'inquiry', filters: { tag } } } });
  ids.segFail = r.json?.data?.id;
  r = await api(admin.cookie, b('campaigns'), {
    method: 'POST', body: { name: `Vfy FailCamp ${mark}`, channel: 'sms', connectionId: ids.conn, segmentId: ids.segFail,
      bodyText: 'failure test' } });
  ids.failCampaign = r.json?.data?.id;
  await api(admin.cookie, b(`campaigns/${ids.failCampaign}/approve`), { method: 'POST' });
  await api(admin.cookie, b('worker/process'), { method: 'POST', body: { batch: 50 } });

  const { rows: failDelivs } = await pool.query(
    `SELECT d.id, d.status, d.retry_count, d.failure_reason, r.recipient_id FROM communication_deliveries d
     JOIN communication_campaign_recipients r ON r.id = d.recipient_id
     WHERE d.tenant_id=$1 AND d.campaign_id=$2 ORDER BY d.created_at`, [ATLAS, ids.failCampaign],
  );
  const f1Row = failDelivs.find((x) => x.recipient_id === f1);
  const f2Row = failDelivs.find((x) => x.recipient_id === f2);
  check('bounce → permanent failed (not retryable)', f1Row?.status === 'bounced' || f1Row?.status === 'failed', `status ${f1Row?.status}`);
  check('transient failure → queued with retry_count >= 1', f2Row?.status === 'queued' && f2Row?.retry_count >= 1,
    `status ${f2Row?.status} retries ${f2Row?.retry_count}`);

  const f1DeliveryId = failDelivs.find((x) => x.recipient_id === f1)?.id;
  r = await api(admin.cookie, b(`deliveries/${f1DeliveryId}/retry`), { method: 'POST' });
  check('manual retry of failed delivery → queued, retryCount reset', r.status === 200 && r.json?.data?.status === 'queued' && r.json?.data?.retryCount === 0,
    `status ${r.json?.data?.status}`);
  r = await api(admin.cookie, b(`deliveries/${f1DeliveryId}/events`));
  check('GET delivery events → append-only trail (bounce recorded)', r.status === 200 && Array.isArray(r.json?.data) && r.json?.data?.length >= 1,
    `events ${r.json?.data?.length}`);

  // =================================================================
  // 6. Scheduling + cancel (dedicated segment/tag so F1/F2 retries from
  //    section 5 don't keep the promoted campaign in 'sending')
  // =================================================================
  await mkInquiry('S1 Sched', '+212 6 61 00 00 21', `s1.${runId}@verify.ma`, { tags: [schedTag] });
  r = await api(admin.cookie, b('segments'), {
    method: 'POST', body: { name: `Vfy SchedSeg ${mark}`, definition: { kind: 'inquiry', filters: { tag: schedTag } } } });
  ids.schedSeg = r.json?.data?.id;
  r = await api(admin.cookie, b('campaigns'), {
    method: 'POST', body: { name: `Vfy Sched ${mark}`, channel: 'sms', connectionId: ids.conn, segmentId: ids.schedSeg, bodyText: 'scheduled' } });
  ids.sched = r.json?.data?.id;
  const future = new Date(Date.now() + 3600_000).toISOString();
  r = await api(admin.cookie, b(`campaigns/${ids.sched}/schedule`), { method: 'POST', body: { scheduleAt: future } });
  // App-wide naive-timestamp storage round-trips through the server TZ (UTC+1 here),
  // so compare within a 2h window rather than exact-epoch equality.
  const schedEpoch = r.json?.data?.scheduleAt ? new Date(r.json?.data?.scheduleAt).getTime() : NaN;
  check('schedule future → draft kept (scheduleAt persisted)',
    r.status === 200 && r.json?.data?.status === 'draft' && Math.abs(schedEpoch - new Date(future).getTime()) <= 2 * 3600_000,
    `status ${r.status} campaign ${r.json?.data?.status}`);
  r = await api(admin.cookie, b(`campaigns/${ids.sched}/approve`), { method: 'POST' });
  check('approve scheduled → status scheduled', r.status === 200 && r.json?.data?.campaign?.status === 'scheduled',
    `status ${r.json?.data?.campaign?.status}`);

  await pool.query(`UPDATE communication_campaigns SET schedule_at = now() - interval '1 minute' WHERE id=$1 AND tenant_id=$2`, [ids.sched, ATLAS]);
  r = await api(admin.cookie, b('worker/process'), { method: 'POST', body: { batch: 50 } });
  check('worker promotes due scheduled campaign', r.json?.data?.promotedCampaigns >= 1, `promoted ${r.json?.data?.promotedCampaigns}`);
  r = await api(admin.cookie, b(`campaigns/${ids.sched}`));
  check('promoted campaign completed', r.json?.data?.status === 'completed', `status ${r.json?.data?.status}`);

  r = await api(admin.cookie, b('campaigns'), {
    method: 'POST', body: { name: `Vfy Cancel ${mark}`, channel: 'sms', connectionId: ids.conn, segmentId: ids.schedSeg, bodyText: 'cancel' } });
  ids.cancel = r.json?.data?.id;
  await api(admin.cookie, b(`campaigns/${ids.cancel}/schedule`), { method: 'POST', body: { scheduleAt: future } });
  await api(admin.cookie, b(`campaigns/${ids.cancel}/approve`), { method: 'POST' });
  r = await api(admin.cookie, b(`campaigns/${ids.cancel}/cancel`), { method: 'POST' });
  check('cancel scheduled campaign → cancelled', r.status === 200 && r.json?.data?.status === 'cancelled', `status ${r.json?.data?.status}`);
  const { rows: cancelRecipients } = await pool.query(
    `SELECT status, COUNT(*)::int c FROM communication_campaign_recipients WHERE tenant_id=$1 AND campaign_id=$2 GROUP BY status`,
    [ATLAS, ids.cancel],
  );
  check('cancelled campaign recipients all skipped', cancelRecipients.every((x) => x.status === 'skipped'),
    JSON.stringify(cancelRecipients));

  // =================================================================
  // 7. Automation — birthday run idempotent per day
  // =================================================================
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const bdayUserId = `vfy-bday-${runId}`;
  await pool.query(
    `INSERT INTO "user" (id, tenant_id, email, name, role, user_status, date_of_birth, guardian_phone)
     VALUES ($1,$2,$3,$4,'student','active',$5,'+212 6 77 77 77 77')
     ON CONFLICT (id) DO NOTHING`,
    [bdayUserId, ATLAS, `vfy-bday-${runId}@lango.local`, `Bday Kid ${mark}`, yyyymmdd],
  );
  r = await api(admin.cookie, b('templates'), {
    method: 'POST', body: { name: `Vfy BdayTpl ${mark}`, channel: 'sms',
      initial: { bodyText: 'Joyeux anniversaire {{firstName}} !' } } });
  const bdayTpl = r.json?.data?.template?.id;
  const bdayTplVer = r.json?.data?.version?.id;
  await api(admin.cookie, b(`templates/${bdayTpl}/versions/${bdayTplVer}/publish`), { method: 'POST' });
  r = await api(admin.cookie, b('automations'), {
    method: 'POST', body: { name: `Vfy Bday Auto ${mark}`, kind: 'birthday_student', channel: 'sms',
      connectionId: ids.conn, templateId: bdayTpl, sendTime: '09:00' } });
  check('POST automation → 201', r.status === 201 && r.json?.data?.id, `status ${r.status}`);
  ids.auto = r.json?.data?.id;
  r = await api(admin.cookie, b(`automations/${ids.auto}/test`), { method: 'POST', body: { runDate: yyyymmdd } });
  check('run automation → queues birthday recipient', r.status === 200 && r.json?.data?.queuedCount >= 1,
    `queued ${r.json?.data?.queuedCount}`);
  r = await api(admin.cookie, b(`automations/${ids.auto}/test`), { method: 'POST', body: { runDate: yyyymmdd } });
  check('run again same day → alreadyRan (dedup)', r.status === 200 && r.json?.data?.alreadyRan === true,
    `alreadyRan ${r.json?.data?.alreadyRan}`);
  r = await api(admin.cookie, b(`automations/${ids.auto}/runs`));
  check('GET automation runs lists one run', r.status === 200 && r.json?.data?.length === 1, `runs ${r.json?.data?.length}`);

  // =================================================================
  // 8. Cross-tenant isolation + addon gating
  // =================================================================
  r = await api(langoAdmin.cookie, b(`campaigns/${ids.campaign}`));
  check('cross-tenant GET campaign → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, b(`campaigns/${ids.campaign}/recipients`));
  check('cross-tenant GET recipients → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, b(`campaigns/${ids.campaign}/report`));
  check('cross-tenant GET report → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, b(`campaigns/${ids.campaign}/approve`), { method: 'POST' });
  check('cross-tenant approve → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, b(`connections/${ids.conn}`));
  check('cross-tenant GET connection → 404', r.status === 404, `status ${r.status}`);

  const { rows: langoInq } = await pool.query(
    `SELECT COUNT(*)::int c FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%'`, [LANGO],
  );
  check('DB: Lango tenant untouched by verify data', langoInq[0]?.c === 0, `count ${langoInq[0]?.c}`);

  // =================================================================
  // 9. Provider webhook — signature + valid transition
  // =================================================================
  const hmacSecret = webhookSecret();
  const sentDelivery = delivs.find((x) => x.status === 'sent');
  if (hmacSecret && sentDelivery) {
    const providerRef = sentDelivery.provider_ref;
    const body = JSON.stringify({ providerRef, status: 'delivered', timestamp: new Date().toISOString() });
    const ts = String(Date.now());
    const sig = crypto.createHmac('sha256', hmacSecret).update(`${ts}.${body}`).digest('hex');
    const wr = await fetch(`${BASE}/api/webhooks/communication/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': ts, 'x-webhook-signature': `sha256=${sig}` },
      body, redirect: 'manual',
    });
    const wjson = await wr.json().catch(() => ({}));
    check('webhook flips sent→delivered', wr.status === 200 && wjson?.data?.deliveryStatus === 'delivered', `status ${wr.status}`);

    const bad = await fetch(`${BASE}/api/webhooks/communication/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': ts, 'x-webhook-signature': 'sha256=deadbeef' },
      body, redirect: 'manual',
    });
    check('webhook bad signature → 401', bad.status === 401, `status ${bad.status}`);
  } else {
    check('webhook test skipped (no sent delivery / no secret)', false, 'no sent delivery or secret unavailable');
  }

  // =================================================================
  // 10. DB evidence summary
  // =================================================================
  const { rows: campaignRow } = await pool.query(
    `SELECT status, sent_count, delivered_count, failed_count, targeted_count, consent_excluded_count, suppression_excluded_count
     FROM communication_campaigns WHERE tenant_id=$1 AND id=$2`, [ATLAS, ids.campaign],
  );
  const c = campaignRow[0];
  check('DB: campaign counters consistent (webhook flipped P1 sent→delivered)', c?.status === 'completed' && c?.sent_count === 2 && c?.delivered_count === 2 && c?.targeted_count === 5,
    JSON.stringify(c));
  check('DB: consent/suppression exclusion counts stored', c?.consent_excluded_count === 1 && c?.suppression_excluded_count === 1,
    `consent ${c?.consent_excluded_count} suppression ${c?.suppression_excluded_count}`);

  const { rows: auditCount } = await pool.query(
    `SELECT COUNT(*)::int c FROM audit_logs WHERE tenant_id=$1 AND entity_type LIKE 'broadcast.%' AND entity_id IN ($2,$3,$4)`,
    [ATLAS, ids.campaign, ids.conn, ids.auto],
  );
  check('DB: audit rows recorded for broadcast mutations', (auditCount[0]?.c ?? 0) >= 5, `count ${auditCount[0]?.c}`);

  // ------------------------------------------------------------------ cleanup
  await pool.query(`DELETE FROM communication_delivery_events WHERE tenant_id=$1 AND campaign_id IN
    (SELECT id FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_deliveries WHERE tenant_id=$1 AND campaign_id IN
    (SELECT id FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_campaign_recipients WHERE tenant_id=$1 AND campaign_id IN
    (SELECT id FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_campaigns WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_automation_recipients WHERE tenant_id=$1 AND run_id IN
    (SELECT id FROM communication_automation_runs WHERE tenant_id=$1 AND automation_id IN
      (SELECT id FROM communication_automations WHERE tenant_id=$1 AND name LIKE '%[verify%'))`, [ATLAS]);
  await pool.query(`DELETE FROM communication_automation_runs WHERE tenant_id=$1 AND automation_id IN
    (SELECT id FROM communication_automations WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_automations WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_template_versions WHERE tenant_id=$1 AND template_id IN
    (SELECT id FROM communication_templates WHERE tenant_id=$1 AND name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM communication_templates WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_segments WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_connections WHERE tenant_id=$1 AND name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_suppressions WHERE tenant_id=$1 AND reason LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM communication_consents WHERE tenant_id=$1 AND source='verify'`, [ATLAS]);
  await pool.query(`DELETE FROM inquiry_follow_ups WHERE tenant_id=$1 AND inquiry_id IN
    (SELECT id FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%')`, [ATLAS]);
  await pool.query(`DELETE FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%'`, [ATLAS]);
  await pool.query(`DELETE FROM "user" WHERE tenant_id=$1 AND email LIKE 'vfy-bday-%'`, [ATLAS]);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
