import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve('.env') });

const BASE_URL = 'http://localhost:3111';

async function main() {
  console.log('Testing Admissions & Enrollment IDOR & Boundary protections...\n');

  // 1. Unauthenticated request to /api/students/admissions
  const unauthRes = await fetch(`${BASE_URL}/api/students/admissions`);
  console.log(`[${unauthRes.status}] Unauthenticated GET /api/students/admissions -> ${unauthRes.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL'}`);

  // 2. Log in as Student (student.001@atlas.ma)
  const studentLogin = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ email: 'student.001@atlas.ma', password: 'Admin123!' }),
  });
  const studentCookie = studentLogin.headers.get('set-cookie');
  const studentHeaders = { Cookie: studentCookie || '', Accept: 'application/json', Origin: BASE_URL };

  // 3. Student accessing staff admissions list
  const stuAdmRes = await fetch(`${BASE_URL}/api/students/admissions`, { headers: studentHeaders });
  console.log(`[${stuAdmRes.status}] Student GET /api/students/admissions -> ${stuAdmRes.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL'}`);

  // 4. Student accessing applicant detail
  const stuDetailRes = await fetch(`${BASE_URL}/api/students/admissions/fe8542b4-051d-44c0-a529-6690c0fdfed9`, { headers: studentHeaders });
  console.log(`[${stuDetailRes.status}] Student GET /api/students/admissions/[id] -> ${stuDetailRes.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL'}`);

  // 5. Student accessing inquiries
  const stuInqRes = await fetch(`${BASE_URL}/api/admissions/inquiries`, { headers: studentHeaders });
  console.log(`[${stuInqRes.status}] Student GET /api/admissions/inquiries -> ${stuInqRes.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL'}`);

  // 6. Student attempting to enroll an applicant
  const stuEnrollRes = await fetch(`${BASE_URL}/api/students/admissions/fe8542b4-051d-44c0-a529-6690c0fdfed9/enroll`, {
    method: 'POST',
    headers: { ...studentHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ classSectionId: '78f69ba3-4383-4a78-9382-fb626ce6fed4' }),
  });
  console.log(`[${stuEnrollRes.status}] Student POST /api/students/admissions/[id]/enroll -> ${stuEnrollRes.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL'}`);

  // 7. Log in as Parent (parent1@atlas.ma)
  const parentLogin = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({ email: 'parent1@atlas.ma', password: 'Admin123!' }),
  });
  if (parentLogin.status === 200) {
    const parentCookie = parentLogin.headers.get('set-cookie');
    const parentHeaders = { Cookie: parentCookie || '', Accept: 'application/json', Origin: BASE_URL };
    const parentAdmRes = await fetch(`${BASE_URL}/api/students/admissions`, { headers: parentHeaders });
    console.log(`[${parentAdmRes.status}] Parent GET /api/students/admissions -> ${parentAdmRes.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL'}`);
  }

  console.log('\nIDOR & Boundary Protection verification complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
