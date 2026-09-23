import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  console.log('Starting Acceptance Evidence Closeout (Strictly Read-Only Isolation)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Authenticate as School Admin
  console.log('Authenticating...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });

  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // 2. Set up Coherent Isolated Fixture Route Interceptions BEFORE loading Student Directory
  console.log('Attaching isolated synthetic fixture routes...');

  // Coherent Academic Sections: 2nde A (2 occupied), 2nde C (0 occupied), 1ère B (0 occupied)
  // Total Capacity = 105 (35/sec), Total Enrolled Before = 2, Available Before = 103
  await page.route('**/api/academics/class-sections*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 'sec-2nde-a', classId: 'cls-2nde', className: '2nde', sectionName: 'A', maxStudents: 35, enrolledCount: 2 },
          { id: 'sec-2nde-c', classId: 'cls-2nde', className: '2nde', sectionName: 'C', maxStudents: 35, enrolledCount: 0 },
          { id: 'sec-1ere-b', classId: 'cls-1ere', className: '1ère', sectionName: 'B', maxStudents: 35, enrolledCount: 0 },
        ],
      }),
    });
  });

  // Coherent Preflight & Simulation Fixture:
  // Student A: 2nde A -> 2nde A (UNCHANGED)
  // Student B: 2nde A -> 2nde C (MOVE)
  // Student C: null -> 1ère B (NEW ASSIGNMENT)
  const coherentSimulationResponse = {
    success: true,
    data: {
      isDryRun: true,
      scope: {
        branchName: 'Campus Principal Casablanca',
        branchId: '06ab27c5-7862-4e07-93af-49ef1935bfe6',
        academicYearName: '2026–2027',
        sessionYearId: 'd925db1e-b68e-448f-9571-af783bba6f60',
      },
      evaluatedStudentsCount: 3,
      unchangedCount: 1,
      newAssignmentsCount: 1,
      movedCount: 1,
      unplacedCount: 0,
      placedCount: 2, // 1 new assignment + 1 move = 2 changes
      hasChanges: true,
      totalCapacity: 105,
      currentOccupancy: 2,
      availableCapacity: 103,
      capacityExceeded: false,
      simulationValid: true,
      hasAcademicHistoryWarning: false,
      movedWithHistoryCount: 0,
      sectionsWithUnknownCapacity: [],
      method: 'balanced_headcount',
      breakdown: {
        'sec-2nde-a': {
          className: '2nde',
          sectionName: 'A',
          beforeOccupancy: 2,
          movement: -1,
          afterOccupancy: 1,
          maxStudents: 35,
          isOverCapacity: false,
          availableSlots: 34,
          count: 0,
          maleCount: 0,
          femaleCount: 0,
        },
        'sec-2nde-c': {
          className: '2nde',
          sectionName: 'C',
          beforeOccupancy: 0,
          movement: 1,
          afterOccupancy: 1,
          maxStudents: 35,
          isOverCapacity: false,
          availableSlots: 34,
          count: 1,
          maleCount: 1,
          femaleCount: 0,
        },
        'sec-1ere-b': {
          className: '1ère',
          sectionName: 'B',
          beforeOccupancy: 0,
          movement: 1,
          afterOccupancy: 1,
          maxStudents: 35,
          isOverCapacity: false,
          availableSlots: 34,
          count: 1,
          maleCount: 0,
          femaleCount: 1,
        },
      },
      assignments: [
        {
          studentId: 'stu-b',
          studentName: 'Omar Tazi',
          matricule: 'ETU-002',
          gender: 'male',
          previousClassSectionId: 'sec-2nde-a',
          previousClassName: '2nde A',
          targetClassSectionId: 'sec-2nde-c',
          targetClassName: '2nde',
          targetSectionName: 'C',
          isMove: true,
          hasAcademicHistory: false,
          score: null,
        },
        {
          studentId: 'stu-c',
          studentName: 'Kenza Alaoui',
          matricule: 'ETU-003',
          gender: 'female',
          previousClassSectionId: null,
          previousClassName: null,
          targetClassSectionId: 'sec-1ere-b',
          targetClassName: '1ère',
          targetSectionName: 'B',
          isMove: false,
          hasAcademicHistory: false,
          score: null,
        },
      ],
      unchangedStudents: [
        {
          studentId: 'stu-a',
          studentName: 'Yassine El Amrani',
          matricule: 'ETU-001',
          gender: 'male',
          sectionId: 'sec-2nde-a',
          className: '2nde',
          sectionName: 'A',
        },
      ],
      unplacedStudents: [],
      integrityWarnings: [],
    },
    message: 'Simulation prête : 1 nouvelle affectation, 1 déplacement.',
  };

  await page.route('**/api/students/placements/auto*', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            scope: {
              branchName: 'Campus Principal Casablanca',
              branchId: '06ab27c5-7862-4e07-93af-49ef1935bfe6',
              academicYearName: '2026–2027',
              sessionYearId: 'd925db1e-b68e-448f-9571-af783bba6f60',
            },
            eligibleSectionsCount: 3,
            totalCapacity: 105,
            currentOccupancy: 2,
            availableCapacity: 103,
            unassignedCount: 1, // 1 nouveau sans section
            totalAssignedCount: 2,
            sectionsWithUnknownCapacity: [],
            isSimulationBlocked: false,
          },
        }),
      });
    }
    if (req.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(coherentSimulationResponse),
      });
    }
    return route.continue();
  });

  // 3. Navigate to Student Directory with routes active
  console.log('Navigating to /fr/dashboard/students with coherent fixture...');
  await page.goto('http://localhost:3111/fr/dashboard/students', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 4. Open Affectation Automatique modal
  console.log('Opening Affectation Automatique modal...');
  const actionsDropdownBtn = page.locator('button:has-text("Actions")').first();
  await actionsDropdownBtn.click({ force: true });
  await page.waitForTimeout(500);

  const autoPlacementMenu = page.locator('[role="menuitem"]:has-text("Affectation Automatique")').first();
  await autoPlacementMenu.click({ force: true });
  await page.waitForTimeout(1000);

  // 5. Select "Rééquilibrer les sections existantes"
  console.log('Selecting Rebalance mode...');
  const rebalanceBtn = page.locator('button:has-text("Rééquilibrer les sections")').first();
  if (await rebalanceBtn.isVisible()) {
    await rebalanceBtn.click({ force: true });
    await page.waitForTimeout(400);
  }

  // 6. Click Simulate
  console.log('Simulating placement...');
  const simulateBtn = page.locator('button:has-text("Simuler la répartition")').first();
  await simulateBtn.click({ force: true });
  await page.waitForTimeout(1200);

  // A. CAPTURE SCREENSHOT A: Corrected Coherent Movement Simulation
  console.log('Capturing Screenshot A: Coherent Movement Simulation Preview...');
  const screenshotAPath = path.join(ARTIFACTS_DIR, 'simulation-preview-with-movement.png');
  await page.screenshot({ path: screenshotAPath, fullPage: false });
  console.log(`Saved Screenshot A to ${screenshotAPath}`);

  // 7. Click Apply to open Confirmation Dialog
  console.log('Opening Confirmation Dialog...');
  const applyBtn = page.locator('button:has-text("Appliquer 2 affectations")').first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(800);

  // B. CAPTURE SCREENSHOT B: Corrected Confirmation Dialog
  console.log('Capturing Screenshot B: Confirmation Dialog with Correct Microcopy...');
  const screenshotBPath = path.join(ARTIFACTS_DIR, 'confirmation-dialog-with-movement.png');
  await page.screenshot({ path: screenshotBPath, fullPage: false });
  console.log(`Saved Screenshot B to ${screenshotBPath}`);

  // 8. Safely Click Annuler
  const cancelBtn = page.locator('button:has-text("Annuler")').last();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click({ force: true });
    await page.waitForTimeout(400);
    console.log('Safely closed confirmation dialog without writing changes.');
  }

  await browser.close();
  console.log('Closeout evidence captured successfully without data mutations!');
}

main().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
