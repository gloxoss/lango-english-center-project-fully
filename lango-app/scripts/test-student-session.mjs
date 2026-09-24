import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3111';

async function main() {
  console.log('Logging in as student.001@atlas.ma...');
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
  console.log('Login status:', loginRes.status);
  const loginJson = await loginRes.json();
  console.log('Login response:', loginJson);

  if (!loginRes.ok) {
    throw new Error('Login failed');
  }

  const endpoints = [
    '/api/student/me/home',
    '/api/student/me/timetable',
    '/api/student/me/subjects',
    '/api/student/me/attendance',
    '/api/transport/self-service/student',
    '/api/addons/hostel/resident/me',
  ];

  for (const ep of endpoints) {
    console.log(`\n--- Testing ${ep} ---`);
    const res = await fetch(`${BASE_URL}${ep}`, {
      headers: { Cookie: cookie || '' },
    });
    console.log(`Status: ${res.status}`);
    const json = await res.json().catch(() => null);
    console.log('Response:', JSON.stringify(json, null, 2));
  }
}

main().catch(console.error);
