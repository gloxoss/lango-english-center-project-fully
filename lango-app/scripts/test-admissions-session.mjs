import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve('.env') });

const BASE_URL = 'http://localhost:3111';

async function main() {
  console.log('Logging in as school_admin (y.elamrani@atlas.ma)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE_URL,
    },
    body: JSON.stringify({
      email: 'y.elamrani@atlas.ma',
      password: 'Admin123!',
    }),
  });

  const cookie = loginRes.headers.get('set-cookie');
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  console.log('User role:', loginData.user?.role, '| Name:', loginData.user?.name);

  const authHeaders = {
    Cookie: cookie || '',
    Accept: 'application/json',
  };

  // 1. GET /api/students/admissions (All)
  console.log('\n--- 1. Testing GET /api/students/admissions (All) ---');
  const admRes = await fetch(`${BASE_URL}/api/students/admissions`, { headers: authHeaders });
  console.log('Status:', admRes.status);
  const admData = await admRes.json();
  console.log('Total applicants returned:', admData.data?.length, '| Summary:', admData.summary);

  // 2. GET /api/students/admissions?status=approved
  console.log('\n--- 2. Testing GET /api/students/admissions?status=approved ---');
  const appRes = await fetch(`${BASE_URL}/api/students/admissions?status=approved`, { headers: authHeaders });
  console.log('Status:', appRes.status);
  const appData = await appRes.json();
  console.log('Approved count:', appData.data?.length);

  // 3. GET /api/students/admissions/[id] for active candidate
  const firstApplicant = admData.data?.[0];
  if (firstApplicant) {
    console.log(`\n--- 3. Testing GET /api/students/admissions/${firstApplicant.id} (Detail) ---`);
    const detailRes = await fetch(`${BASE_URL}/api/students/admissions/${firstApplicant.id}`, { headers: authHeaders });
    console.log('Status:', detailRes.status);
    const detailData = await detailRes.json();
    console.log('Applicant Detail:', {
      id: detailData.data?.id,
      name: `${detailData.data?.firstName} ${detailData.data?.lastName}`,
      status: detailData.data?.status,
      massar: detailData.data?.nationalId,
      branch: detailData.data?.branchName,
      session: detailData.data?.sessionYearName,
      guardian: detailData.data?.guardianName,
      docsCount: detailData.data?.documents?.length,
      commentsCount: detailData.data?.comments?.length,
    });
  }

  // 4. GET /api/admissions/inquiries
  console.log('\n--- 4. Testing GET /api/admissions/inquiries ---');
  const inqRes = await fetch(`${BASE_URL}/api/admissions/inquiries`, { headers: authHeaders });
  console.log('Status:', inqRes.status);
  const inqData = await inqRes.json();
  console.log('Inquiries returned:', inqData.data?.length);
  if (inqData.data?.[0]) {
    console.log('Sample Inquiry:', {
      id: inqData.data[0].id,
      contact: inqData.data[0].contactName,
      source: inqData.data[0].source,
      status: inqData.data[0].status,
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
