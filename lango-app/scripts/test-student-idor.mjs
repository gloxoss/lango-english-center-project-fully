import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3111';

async function main() {
  console.log('Testing student IDOR & authorization boundaries...');

  // 1. Sign in as student
  const loginRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    body: JSON.stringify({
      email: 'student.001@atlas.ma',
      password: 'Admin123!',
    }),
  });

  const cookie = loginRes.headers.get('set-cookie');
  if (!loginRes.ok) throw new Error('Student login failed');

  const forbiddenEndpoints = [
    { url: '/api/guardian/me/home', method: 'GET', desc: 'Parent home portal as student' },
    { url: '/api/teacher/me/home', method: 'GET', desc: 'Teacher home portal as student' },
    { url: '/api/students/STU-002', method: 'GET', desc: 'Staff student directory by ID' },
    { url: '/api/students/report-card?studentId=STU-002', method: 'GET', desc: 'Staff report-card for another student' },
    { url: '/api/finance/invoices', method: 'GET', desc: 'Staff finance invoices' },
    { url: '/api/attendance', method: 'GET', desc: 'Staff school-wide attendance' },
  ];

  const results = [];
  for (const test of forbiddenEndpoints) {
    const res = await fetch(`${BASE_URL}${test.url}`, {
      method: test.method,
      headers: { Cookie: cookie || '' },
    });
    console.log(`[${res.status}] ${test.desc} (${test.url}) -> ${res.status === 403 || res.status === 401 || res.status === 404 ? 'PASS (Denied)' : 'FAIL'}`);
    results.push({ ...test, status: res.status, ok: res.status === 403 || res.status === 401 || res.status === 404 });
  }

  const allPassed = results.every(r => r.ok);
  console.log(`\nIDOR & Authorization result: ${allPassed ? 'ALL PASS' : 'FAILURES DETECTED'}`);
}

main().catch(console.error);
