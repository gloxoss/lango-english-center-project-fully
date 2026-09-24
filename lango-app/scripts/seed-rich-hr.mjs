import 'dotenv/config';
import pg from 'pg';
import crypto from 'node:crypto';

const TENANT_ID = '06ab27c5-7862-4e07-93af-49ef1935bfe6';
const BRANCH_ID = 'bcf5c806-359e-4141-9e45-af5f3122a52b';

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Seeding rich HR & Payroll dataset for Groupe Scolaire Atlas...');

  try {
    await client.query('BEGIN');

    // 1. Departments
    console.log('Seeding departments...');
    const depts = [
      { name: 'Direction Pédagogique', code: 'DIR-PED', desc: 'Coordination académique et direction des études' },
      { name: 'Département des Sciences', code: 'DEP-SCI', desc: 'Mathématiques, Physique-Chimie et SVT' },
      { name: 'Département des Lettres', code: 'DEP-LET', desc: 'Langues (Arabe, Français, Anglais) et Histoire-Géo' },
      { name: 'Administration & Finances', code: 'ADM-FIN', desc: 'Comptabilité, RH, accueil et intendance' },
    ];

    const deptMap = {};
    for (const d of depts) {
      const res = await client.query(`
        INSERT INTO departments (id, tenant_id, branch_id, name, code, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
        ON CONFLICT (tenant_id, name) DO UPDATE SET code = $5, description = $6, updated_at = NOW()
        RETURNING id, code
      `, [crypto.randomUUID(), TENANT_ID, BRANCH_ID, d.name, d.code, d.desc]);
      deptMap[d.code] = res.rows[0].id;
    }

    // 2. Designations
    console.log('Seeding designations...');
    const desigs = [
      { title: 'Directeur Général & Pédagogique', code: 'DIR-GEN', dept: 'DIR-PED' },
      { title: 'Professeur de Mathématiques', code: 'PROF-MATH', dept: 'DEP-SCI' },
      { title: 'Professeur de Français', code: 'PROF-FR', dept: 'DEP-LET' },
      { title: 'Responsable Administratif & RH', code: 'RESP-RH', dept: 'ADM-FIN' },
      { title: 'Comptable Principal', code: 'COMPT-PRIN', dept: 'ADM-FIN' },
    ];

    const desigMap = {};
    for (const des of desigs) {
      const res = await client.query(`
        INSERT INTO designations (id, tenant_id, department_id, title, code, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
        ON CONFLICT (tenant_id, title) DO UPDATE SET code = $5, department_id = $3, updated_at = NOW()
        RETURNING id, code
      `, [crypto.randomUUID(), TENANT_ID, deptMap[des.dept], des.title, des.code]);
      desigMap[des.code] = res.rows[0].id;
    }

    // 3. Staff Users & Employee Profiles
    console.log('Seeding staff employee profiles...');
    const staffMembers = [
      {
        userId: 'USR-001',
        email: 'y.elamrani@atlas.ma',
        firstName: 'Yassine',
        lastName: 'El Amrani',
        phone: '+212 6 61 00 11 22',
        role: 'school_admin',
        employeeId: 'EMP-001',
        deptCode: 'DIR-PED',
        desigCode: 'DIR-GEN',
        hireDate: '2020-09-01',
        salary: 16000.00,
        cnssNumber: '198273645',
        amoNumber: 'AMO-98273',
        bankRib: '011 780 0000123456789012 34',
        cin: 'A748291',
        dependants: 2
      },
      {
        userId: 'USR-002',
        email: 'teacher.001@atlas.ma',
        firstName: 'Fatima Zahra',
        lastName: 'Idrissi',
        phone: '+212 6 62 11 22 33',
        role: 'teacher',
        employeeId: 'EMP-002',
        deptCode: 'DEP-SCI',
        desigCode: 'PROF-MATH',
        hireDate: '2021-09-01',
        salary: 9500.00,
        cnssNumber: '283746192',
        amoNumber: 'AMO-83746',
        bankRib: '007 780 0000987654321098 76',
        cin: 'B192834',
        dependants: 1
      },
      {
        userId: 'USR-003-HR',
        email: 'k.tazi@atlas.ma',
        firstName: 'Karim',
        lastName: 'Tazi',
        phone: '+212 6 63 22 33 44',
        role: 'teacher',
        employeeId: 'EMP-003',
        deptCode: 'DEP-LET',
        desigCode: 'PROF-FR',
        hireDate: '2022-09-01',
        salary: 8500.00,
        cnssNumber: '374829103',
        amoNumber: 'AMO-74829',
        bankRib: '225 780 0000456123789045 12',
        cin: 'C283746',
        dependants: 0
      },
      {
        userId: 'USR-004-HR',
        email: 'n.chraibi@atlas.ma',
        firstName: 'Nadia',
        lastName: 'Chraibi',
        phone: '+212 6 64 33 44 55',
        role: 'accountant',
        employeeId: 'EMP-004',
        deptCode: 'ADM-FIN',
        desigCode: 'COMPT-PRIN',
        hireDate: '2021-11-15',
        salary: 11000.00,
        cnssNumber: '482910374',
        amoNumber: 'AMO-82910',
        bankRib: '190 780 0000678901234567 89',
        cin: 'D394857',
        dependants: 1
      }
    ];

    const employeeProfileMap = {};

    for (const s of staffMembers) {
      // Ensure user exists
      await client.query(`
        INSERT INTO "user" (id, name, email, role, tenant_id, email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET name = $2, email = $3, role = $4, updated_at = NOW()
      `, [s.userId, `${s.firstName} ${s.lastName}`, s.email, s.role, TENANT_ID]);

      // Insert/update employee profile
      const profRes = await client.query(`
        INSERT INTO employee_profiles (
          id, tenant_id, user_id, first_name, last_name, email, phone, branch_id,
          employee_id, department_id, designation_id, employment_type, employment_status,
          hire_date, contract_type, national_id, salary, cnss_number, amo_number,
          bank_rib, dependants_count, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, 'full_time', 'active',
          $12, 'cdi', $13, $14, $15, $16,
          $17, $18, NOW(), NOW()
        )
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET
          first_name = $4, last_name = $5, department_id = $10, designation_id = $11,
          salary = $14, updated_at = NOW()
        RETURNING id
      `, [
        crypto.randomUUID(), TENANT_ID, s.userId, s.firstName, s.lastName, s.email, s.phone, BRANCH_ID,
        s.employeeId, deptMap[s.deptCode], desigMap[s.desigCode],
        s.hireDate, s.cin, s.salary, s.cnssNumber, s.amoNumber,
        s.bankRib, s.dependants
      ]);
      employeeProfileMap[s.userId] = profRes.rows[0].id;
    }

    // 4. Leave Categories & Requests
    console.log('Seeding leave categories & requests...');
    const leaveCats = [
      { name: 'Congé Annuel Payé', days: 22, isPaid: true },
      { name: 'Congé Maladie', days: 10, isPaid: true },
      { name: 'Maternité / Paternité', days: 90, isPaid: true },
      { name: 'Autorisation d\'Absence Exceptionnelle', days: 5, isPaid: true }
    ];

    const leaveCatMap = {};
    for (const lc of leaveCats) {
      const res = await client.query(`
        INSERT INTO leave_categories (id, tenant_id, name, days_per_year, is_paid, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING id, name
      `, [crypto.randomUUID(), TENANT_ID, lc.name, lc.days, lc.isPaid]);
      
      let catId = res.rows[0]?.id;
      if (!catId) {
        const existing = await client.query('SELECT id FROM leave_categories WHERE tenant_id = $1 AND name = $2', [TENANT_ID, lc.name]);
        catId = existing.rows[0]?.id;
      }
      leaveCatMap[lc.name] = catId;
    }

    // Seed sample leave requests
    const leaveAnnualId = leaveCatMap['Congé Annuel Payé'];
    const leaveMaladieId = leaveCatMap['Congé Maladie'];

    if (leaveAnnualId) {
      await client.query(`
        INSERT INTO leave_requests (
          id, tenant_id, user_id, category_id, start_date, end_date, days_requested,
          status, reason, reviewed_by_id, reviewed_at, created_at
        ) VALUES (
          $1, $2, $3, $4, '2026-10-15', '2026-10-17', 3.00,
          'approved', 'Congé de récupération personnel', 'USR-001', NOW(), NOW()
        ) ON CONFLICT (id) DO NOTHING
      `, [crypto.randomUUID(), TENANT_ID, 'USR-003-HR', leaveAnnualId]);
    }

    if (leaveMaladieId) {
      await client.query(`
        INSERT INTO leave_requests (
          id, tenant_id, user_id, category_id, start_date, end_date, days_requested,
          status, reason, created_at
        ) VALUES (
          $1, $2, $3, $4, '2026-10-02', '2026-10-02', 1.00,
          'pending', 'Consultation médicale spécialisée', NOW()
        ) ON CONFLICT (id) DO NOTHING
      `, [crypto.randomUUID(), TENANT_ID, 'USR-002', leaveMaladieId]);
    }

    // 5. Moroccan Payroll Periods & Run Lines
    console.log('Seeding payroll periods and calculations...');
    
    // September 2026 (Approved period)
    const sepPeriodId = crypto.randomUUID();
    await client.query(`
      INSERT INTO payroll_periods (
        id, tenant_id, year, month, status, locked_at, locked_by_id, version, created_at
      ) VALUES (
        $1, $2, 2026, 9, 'approved', NOW(), 'USR-001', 1, NOW()
      )
      ON CONFLICT (tenant_id, year, month) DO UPDATE SET status = 'approved'
    `, [sepPeriodId, TENANT_ID]);

    const activeSepPeriod = (await client.query('SELECT id FROM payroll_periods WHERE tenant_id = $1 AND year = 2026 AND month = 9', [TENANT_ID])).rows[0].id;

    // October 2026 (Draft period)
    const octPeriodId = crypto.randomUUID();
    await client.query(`
      INSERT INTO payroll_periods (
        id, tenant_id, year, month, status, version, created_at
      ) VALUES (
        $1, $2, 2026, 10, 'draft', 1, NOW()
      )
      ON CONFLICT (tenant_id, year, month) DO NOTHING
    `, [octPeriodId, TENANT_ID]);

    // Insert calculated run lines and payslips for September 2026
    let payslipCounter = 1;
    for (const s of staffMembers) {
      const gross = s.salary;
      // CNSS Employee: 4.48% capped at 6,000 MAD ceiling => max 268.80
      const cnssBase = Math.min(gross, 6000);
      const cnssEmp = Number((cnssBase * 0.0448).toFixed(2));

      // AMO Employee: 2.26% uncapped
      const amoEmp = Number((gross * 0.0226).toFixed(2));

      // Professional costs deduction (20% capped at 2500 MAD/month)
      const fraisPro = Math.min(gross * 0.20, 2500);

      // Net Taxable Base
      const netImposable = Math.max(0, gross - cnssEmp - amoEmp - fraisPro);

      // Moroccan IR calculation (monthly progressive scale)
      let irBrut = 0;
      if (netImposable > 15000) {
        irBrut = (netImposable * 0.38) - 2033.33;
      } else if (netImposable > 6666.67) {
        irBrut = (netImposable * 0.34) - 1433.33;
      } else if (netImposable > 5000) {
        irBrut = (netImposable * 0.30) - 1166.67;
      } else if (netImposable > 4166.67) {
        irBrut = (netImposable * 0.20) - 666.67;
      } else if (netImposable > 2500) {
        irBrut = (netImposable * 0.10) - 250.00;
      }

      // Family deduction (30 MAD per dependant, max 180 MAD)
      const familyDeduction = Math.min(s.dependants * 30, 180);
      const irNet = Number(Math.max(0, irBrut - familyDeduction).toFixed(2));

      // Net salary payable
      const netSalary = Number((gross - cnssEmp - amoEmp - irNet).toFixed(2));

      // Employer costs
      const cnssEmployer = Number((cnssBase * 0.0898 + gross * 0.1211).toFixed(2));
      const amoEmployer = Number((gross * 0.0411).toFixed(2));
      const totalEmployerCost = Number((gross + cnssEmployer + amoEmployer).toFixed(2));

      const runLineId = crypto.randomUUID();
      const runLineRes = await client.query(`
        INSERT INTO payroll_run_lines (
          id, tenant_id, period_id, user_id, gross_salary, cnss_employee, amo_employee,
          ir_tax, net_salary, net_payable, cnss_employer, amo_employer, total_employer_cost,
          calculation_snapshot, is_frozen, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $9, $10, $11, $12,
          $13, true, NOW()
        )
        ON CONFLICT (period_id, user_id) DO UPDATE SET
          gross_salary = $5, net_salary = $9, net_payable = $9, ir_tax = $8
        RETURNING id
      `, [
        runLineId, TENANT_ID, activeSepPeriod, s.userId, gross, cnssEmp, amoEmp,
        irNet, netSalary, cnssEmployer, amoEmployer, totalEmployerCost,
        JSON.stringify({
          cnssCeiling: 6000,
          fraisPro,
          netImposable,
          dependantsCount: s.dependants,
          moroccoTaxScale: '2026-v1'
        })
      ]);

      const effectiveRunLineId = runLineRes.rows[0].id;

      // Payslip record
      const payslipNum = `BUL-2026-09-${String(payslipCounter++).padStart(4, '0')}`;
      await client.query(`
        INSERT INTO payslips (
          id, tenant_id, period_id, run_line_id, user_id, issued_at,
          payslip_number, status
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), $6, 'issued'
        )
        ON CONFLICT (run_line_id) DO NOTHING
      `, [crypto.randomUUID(), TENANT_ID, activeSepPeriod, effectiveRunLineId, s.userId, payslipNum]);
    }

    // Ensure all existing run lines have net_payable populated
    await client.query(`UPDATE payroll_run_lines SET net_payable = net_salary WHERE tenant_id = $1 AND (net_payable IS NULL OR net_payable = 0)`, [TENANT_ID]);

    // 6. Salary Advances
    console.log('Seeding salary advances...');
    const yassineProfile = (await client.query('SELECT id FROM employee_profiles WHERE tenant_id = $1 AND user_id = $2', [TENANT_ID, 'USR-001'])).rows[0]?.id;
    const karimProfile = (await client.query('SELECT id FROM employee_profiles WHERE tenant_id = $1 AND user_id = $2', [TENANT_ID, 'USR-003-HR'])).rows[0]?.id;

    if (yassineProfile) {
      const adv1Id = crypto.randomUUID();
      await client.query(`
        INSERT INTO salary_advances (
          id, tenant_id, employee_id, user_id, requested_amount, approved_amount,
          repaid_amount, monthly_installment, reason, status, requested_at,
          approved_at, approver_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'USR-001', 4000.00, 4000.00,
          1000.00, 1000.00, 'Avance sur salaire — travaux urgents domicile', 'approved', '2026-08-15',
          NOW(), 'USR-001', NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `, [adv1Id, TENANT_ID, yassineProfile]);

      await client.query(`
        INSERT INTO salary_advance_transactions (
          id, tenant_id, advance_id, type, amount, transaction_date, notes, created_at
        ) VALUES
          ($1, $2, $3, 'disbursement', 4000.00, '2026-08-16', 'Versement initial par virement bancaire', NOW()),
          ($4, $2, $3, 'payroll_deduction', 1000.00, '2026-09-30', 'Retenue sur salaire Septembre 2026', NOW())
        ON CONFLICT (id) DO NOTHING
      `, [crypto.randomUUID(), TENANT_ID, adv1Id, crypto.randomUUID()]);
    }

    if (karimProfile) {
      const adv2Id = crypto.randomUUID();
      await client.query(`
        INSERT INTO salary_advances (
          id, tenant_id, employee_id, user_id, requested_amount, approved_amount,
          repaid_amount, monthly_installment, reason, status, requested_at,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'USR-003-HR', 3000.00, NULL,
          0.00, 500.00, 'Frais de scolarité rentrée universitaire', 'pending', '2026-09-20',
          NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `, [adv2Id, TENANT_ID, karimProfile]);
    }

    await client.query('COMMIT');
    console.log('Rich HR & Payroll dataset successfully seeded!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
