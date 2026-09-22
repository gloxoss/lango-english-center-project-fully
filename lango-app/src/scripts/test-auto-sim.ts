import 'dotenv/config';

async function main() {
  // Login first to get cookies
  const loginRes = await fetch('http://localhost:3111/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'y.elamrani@atlas.ma', password: 'Admin123!' }),
  });
  
  const cookies = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status, 'hasCookie:', Boolean(cookies));

  const cookieHeader = cookies ? cookies.split(',').map(c => c.split(';')[0]).join('; ') : '';

  const simRes = await fetch('http://localhost:3111/api/students/placements/auto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({
      dryRun: true,
      method: 'balanced_headcount',
      rebalanceAssigned: true,
    }),
  });

  const simJson = await simRes.json();
  console.log('SIMULATION RESPONSE STATUS:', simRes.status);
  console.log('SIMULATION RESPONSE JSON:', JSON.stringify(simJson, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
