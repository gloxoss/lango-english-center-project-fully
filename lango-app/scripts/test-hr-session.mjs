import 'dotenv/config';

const BASE_URL = 'http://localhost:3111';

async function main() {
  console.log('Testing HR & Payroll Session & APIs...');

  // 1. Authenticate as School Admin (y.elamrani@atlas.ma)
  const loginRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ email: 'y.elamrani@atlas.ma', password: 'Admin123!' })
  });
  console.log('Admin login status:', loginRes.status);
  const cookie = loginRes.headers.get('set-cookie')?.split(',').map(c => c.split(';')[0]).join('; ');
  const headers = { Cookie: cookie || '', Accept: 'application/json', Origin: BASE_URL };

  // 2. Overview
  const overRes = await fetch(`${BASE_URL}/api/hr/overview`, { headers });
  console.log('GET /api/hr/overview status:', overRes.status);
  if (overRes.status === 200) {
    const data = await overRes.json();
    console.log('Overview metrics:', data.data || data);
  }

  // 3. Departments
  const deptRes = await fetch(`${BASE_URL}/api/hr/departments`, { headers });
  console.log('GET /api/hr/departments status:', deptRes.status);
  if (deptRes.status === 200) {
    const data = await deptRes.json();
    console.log('Departments count:', (data.data || data).length);
  }

  // 4. Designations
  const desigRes = await fetch(`${BASE_URL}/api/hr/designations`, { headers });
  console.log('GET /api/hr/designations status:', desigRes.status);
  if (desigRes.status === 200) {
    const data = await desigRes.json();
    console.log('Designations count:', (data.data || data).length);
  }

  // 5. Employees
  const empRes = await fetch(`${BASE_URL}/api/hr/employees`, { headers });
  console.log('GET /api/hr/employees status:', empRes.status);
  if (empRes.status === 200) {
    const data = await empRes.json();
    const emps = data.data || data;
    console.log('Employees count:', emps.length);
    console.log('Sample employee:', emps[0]?.name || emps[0]?.firstName, emps[0]?.email);
  }

  // 6. Leave Requests
  const leaveRes = await fetch(`${BASE_URL}/api/hr/leave/requests`, { headers });
  console.log('GET /api/hr/leave/requests status:', leaveRes.status);
  if (leaveRes.status === 200) {
    const data = await leaveRes.json();
    console.log('Leave requests count:', (data.data || data).length);
  }

  // 7. Payroll Periods
  const payRes = await fetch(`${BASE_URL}/api/hr/payroll/periods`, { headers });
  console.log('GET /api/hr/payroll/periods status:', payRes.status);
  if (payRes.status === 200) {
    const data = await payRes.json();
    console.log('Payroll periods count:', (data.data || data).length);
  }

  // 8. Payslips
  const slipRes = await fetch(`${BASE_URL}/api/hr/payslips`, { headers });
  console.log('GET /api/hr/payslips status:', slipRes.status);
  if (slipRes.status === 200) {
    const data = await slipRes.json();
    console.log('Payslips count:', (data.data || data).length);
  }

  console.log('\n--- Testing IDOR & Boundary Protections ---');
  // Unauth
  const unauthRes = await fetch(`${BASE_URL}/api/hr/employees`);
  console.log(`[${unauthRes.status}] Unauth GET /api/hr/employees -> ${unauthRes.status === 401 ? 'PASS (401)' : 'FAIL'}`);

  // Student auth
  const stuLogin = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ email: 'student.001@atlas.ma', password: 'Admin123!' })
  });
  const stuCookie = stuLogin.headers.get('set-cookie')?.split(',').map(c => c.split(';')[0]).join('; ');
  const stuHeaders = { Cookie: stuCookie || '', Accept: 'application/json', Origin: BASE_URL };

  const stuEmpRes = await fetch(`${BASE_URL}/api/hr/employees`, { headers: stuHeaders });
  console.log(`[${stuEmpRes.status}] Student GET /api/hr/employees -> ${stuEmpRes.status === 403 ? 'PASS (403)' : 'FAIL'}`);

  const stuPayRes = await fetch(`${BASE_URL}/api/hr/payroll/periods`, { headers: stuHeaders });
  console.log(`[${stuPayRes.status}] Student GET /api/hr/payroll/periods -> ${stuPayRes.status === 403 ? 'PASS (403)' : 'FAIL'}`);

  const stuLeaveRes = await fetch(`${BASE_URL}/api/hr/leave/requests`, { headers: stuHeaders });
  console.log(`[${stuLeaveRes.status}] Student GET /api/hr/leave/requests -> ${stuLeaveRes.status === 403 ? 'PASS (403)' : 'FAIL'}`);

  console.log('HR Session & IDOR verification complete.');
}

main().catch(console.error);
