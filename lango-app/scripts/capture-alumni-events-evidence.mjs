import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/libs/DB';
import { user, sessionYears, account, alumniEvents, alumniEventRsvps } from '../src/models/Schema';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const BASE = 'http://localhost:3111';
const ARTIFACTS_DIR = 'C:/Users/OMEN/.gemini/antigravity-ide/brain/f8123e8b-6b92-42cb-8818-54295578edb6';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log('Starting Playwright capture for Alumni Events Visual Evidence...');

  // 1. Fetch Atlas School Admin
  const [adminUser] = await db.select().from(user).where(eq(user.email, 'y.elamrani@atlas.ma')).limit(1);
  if (!adminUser) {
    throw new Error('School admin user not found!');
  }
  const atlasTenantId = adminUser.tenantId;

  // 2. Fetch or identify alumni users in Atlas tenant
  const alumniInAtlas = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.tenantId, atlasTenantId), eq(user.role, 'alumni')))
    .limit(5);

  console.log(`Found ${alumniInAtlas.length} alumni in Atlas tenant.`);
  const alumnusUser = alumniInAtlas[0];

  // 3. Seed real Atlas Alumni Events for pristine UI presentation
  const nowIso = new Date().toISOString();
  const eventGalaId = randomUUID();
  const eventWorkshopId = randomUUID();
  const eventCancelledId = randomUUID();

  // Clear existing events in Atlas to ensure predictable state
  const existingEvents = await db.select({ id: alumniEvents.id }).from(alumniEvents).where(eq(alumniEvents.tenantId, atlasTenantId));
  for (const e of existingEvents) {
    await db.delete(alumniEventRsvps).where(eq(alumniEventRsvps.eventId, e.id));
    await db.delete(alumniEvents).where(eq(alumniEvents.id, e.id));
  }

  // Insert Gala Event
  await db.insert(alumniEvents).values({
    id: eventGalaId,
    tenantId: atlasTenantId,
    title: 'Gala Annuel & Cérémonie des Lauréats 2026',
    description: 'Grande soirée de gala annuelle réunissant les promotions de SchoolOS et les partenaires institutionnels.',
    location: 'Grand Amphithéâtre Ibn Battouta, Rabat',
    startsAt: '2026-11-20T19:00:00Z',
    endsAt: '2026-11-20T23:30:00Z',
    capacity: 120,
    isPublished: true,
    attachmentUrl: 'https://schoolos.ma/events/programme-gala-2026.pdf',
    createdBy: adminUser.id,
    createdAt: nowIso,
  });

  // Insert Workshop Event (Capacity = 2, with waitlist)
  await db.insert(alumniEvents).values({
    id: eventWorkshopId,
    tenantId: atlasTenantId,
    title: 'Atelier Carrières & Réseau Professionnel',
    description: 'Session exclusive de coaching exécutif, simulation d\'entretiens et networking ciblé.',
    location: 'Salle de Conférence Casablanca Finance City',
    startsAt: '2026-10-25T14:30:00Z',
    endsAt: '2026-10-25T17:30:00Z',
    capacity: 2,
    isPublished: true,
    createdBy: adminUser.id,
    createdAt: nowIso,
  });

  // Insert Cancelled Event
  await db.insert(alumniEvents).values({
    id: eventCancelledId,
    tenantId: atlasTenantId,
    title: 'Soirée d\'Automne des Anciens (Reportée)',
    description: 'Rencontre informelle au club sportif.',
    location: 'Club Equestre Dar Es Salam',
    startsAt: '2026-10-05T18:00:00Z',
    isCancelled: true,
    cancellationReason: 'Reporté suite aux rénovations des installations du club équestre.',
    isPublished: true,
    createdBy: adminUser.id,
    createdAt: nowIso,
  });

  // Seed RSVPs for Gala
  if (alumnusUser) {
    await db.insert(alumniEventRsvps).values({
      id: randomUUID(),
      tenantId: atlasTenantId,
      eventId: eventGalaId,
      alumnusId: alumnusUser.id,
      status: 'going',
      isWaitlisted: false,
      waitlistPosition: null,
      checkedIn: true,
      checkedInAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // Seed RSVPs for Workshop if we have other alumni
  if (alumniInAtlas.length >= 2) {
    await db.insert(alumniEventRsvps).values({
      id: randomUUID(),
      tenantId: atlasTenantId,
      eventId: eventWorkshopId,
      alumnusId: alumniInAtlas[1].id,
      status: 'going',
      isWaitlisted: false,
      waitlistPosition: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  if (alumniInAtlas.length >= 3) {
    await db.insert(alumniEventRsvps).values({
      id: randomUUID(),
      tenantId: atlasTenantId,
      eventId: eventWorkshopId,
      alumnusId: alumniInAtlas[2].id,
      status: 'going',
      isWaitlisted: false,
      waitlistPosition: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  // Alumnus User is waitlisted on the Workshop event
  if (alumnusUser && alumniInAtlas.length >= 3) {
    await db.insert(alumniEventRsvps).values({
      id: randomUUID(),
      tenantId: atlasTenantId,
      eventId: eventWorkshopId,
      alumnusId: alumnusUser.id,
      status: 'going',
      isWaitlisted: true,
      waitlistPosition: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  console.log('Seeded events and RSVPs successfully. Launching Chromium...');
  const browser = await chromium.launch({ headless: true });

  // -----------------------------------------------------------------
  // 1. ADMIN FLOW
  // -----------------------------------------------------------------
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  const adminPage = await adminContext.newPage();

  console.log('Admin login...');
  await adminPage.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await adminPage.locator('input[type="email"]').fill('y.elamrani@atlas.ma');
  await adminPage.locator('input[type="password"]').fill('Admin123!');
  await adminPage.locator('input[type="password"]').press('Enter');
  await adminPage.waitForURL(u => !String(u).includes('/login'), { timeout: 60000 });
  console.log('Admin signed in.');

  // Evidence A: Admin Events List
  console.log('Capturing Evidence A (Admin Events List)...');
  await adminPage.goto(`${BASE}/fr/dashboard/students/alumni/events`, { waitUntil: 'networkidle', timeout: 90000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_events_evidence_a_admin_list.png'),
    fullPage: false,
  });

  // Evidence B: Create/Edit Event Drawer
  console.log('Capturing Evidence B (Create/Edit Drawer)...');
  const createBtn = adminPage.locator('button:has-text("Nouvel événement"), button:has-text("Créer un événement")').first();
  if (await createBtn.isVisible()) {
    await createBtn.click();
    await adminPage.waitForTimeout(1000);
  }
  await adminPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_events_evidence_b_create_drawer.png'),
    fullPage: false,
  });

  // Close drawer
  const closeDrawerBtn = adminPage.locator('button:has-text("Annuler")').first();
  if (await closeDrawerBtn.isVisible()) {
    await closeDrawerBtn.click();
    await adminPage.waitForTimeout(500);
  }

  // Evidence C: Cancellation Confirmation Modal
  console.log('Capturing Evidence C (Cancellation Modal)...');
  const cancelActionBtn = adminPage.locator('button[title="Annuler l\'événement"]').first();
  if (await cancelActionBtn.isVisible()) {
    await cancelActionBtn.click();
    await adminPage.waitForTimeout(1000);
    await adminPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'alumni_events_evidence_c_cancellation_modal.png'),
      fullPage: false,
    });
    // Dismiss modal
    const modalCancel = adminPage.locator('button:has-text("Retour")').first();
    if (await modalCancel.isVisible()) {
      await modalCancel.click();
      await adminPage.waitForTimeout(500);
    }
  }

  // Evidence D: Attendees & Live Check-in Drawer
  console.log('Capturing Evidence D (Attendees & Live Check-in)...');
  const attendeesBtn = adminPage.locator('button:has-text("Participants"), button:has-text("Liste des participants")').first();
  if (await attendeesBtn.isVisible()) {
    await attendeesBtn.click();
    await adminPage.waitForTimeout(1500);
  }
  await adminPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'alumni_events_evidence_d_attendees_live_checkin.png'),
    fullPage: false,
  });

  await adminContext.close();

  // -----------------------------------------------------------------
  // 2. ALUMNI PORTAL FLOW (Self-Service)
  // -----------------------------------------------------------------
  if (alumnusUser) {
    const alumnusContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
    });
    const alumnusPage = await alumnusContext.newPage();

    console.log(`Logging in as alumnus: ${alumnusUser.email}...`);
    await alumnusPage.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await alumnusPage.locator('input[type="email"]').fill(alumnusUser.email);
    await alumnusPage.locator('input[type="password"]').fill('AlumniPass123!');
    await alumnusPage.locator('input[type="password"]').press('Enter');
    await alumnusPage.waitForURL(u => !String(u).includes('/login'), { timeout: 60000 });

    // Evidence E: Alumni Portal Events Desktop (1440px)
    console.log('Capturing Evidence E (Portal Events Desktop)...');
    await alumnusPage.goto(`${BASE}/fr/alumni/events`, { waitUntil: 'networkidle', timeout: 90000 });
    await alumnusPage.waitForTimeout(2000);
    await alumnusPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'alumni_events_evidence_e_portal_desktop.png'),
      fullPage: false,
    });

    // Evidence F: Alumni Portal Mobile 390px
    console.log('Capturing Evidence F (Portal Mobile 390px)...');
    await alumnusPage.setViewportSize({ width: 390, height: 844 });
    await alumnusPage.waitForTimeout(1000);
    await alumnusPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'alumni_events_evidence_f_portal_mobile_390.png'),
      fullPage: false,
    });

    // Evidence G: Alumni Portal Arabic RTL
    console.log('Capturing Evidence G (Portal Arabic RTL)...');
    await alumnusPage.setViewportSize({ width: 1440, height: 900 });
    await alumnusPage.goto(`${BASE}/ar/alumni/events`, { waitUntil: 'networkidle', timeout: 90000 });
    await alumnusPage.waitForTimeout(2000);
    await alumnusPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'alumni_events_evidence_g_portal_arabic_rtl.png'),
      fullPage: false,
    });

    await alumnusContext.close();
  }

  await browser.close();
  console.log('All Alumni Events visual evidence captured successfully!');
}

run().catch((err) => {
  console.error('Error during Playwright capture:', err);
  process.exit(1);
});
