import http from 'http';

async function testEndpoint(port, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  const port = 3003;
  console.log(`Starting API Tests on http://localhost:${port}...`);

  const endpoints = [
    { path: '/api/users', method: 'GET' },
    { path: '/api/auth/me', method: 'GET' },
    { path: '/api/students', method: 'GET' },
    { path: '/api/students/parents', method: 'GET' },
    { path: '/api/students/admissions', method: 'GET' },
    { path: '/api/academics/optional-subjects', method: 'GET' },
  ];

  let passed = 0;
  for (const ep of endpoints) {
    try {
      const res = await testEndpoint(port, ep.path, ep.method);
      if (res.status === 200) {
        console.log(`✅ [PASS] ${ep.method} ${ep.path} -> Status 200 OK`);
        passed++;
      } else {
        console.log(`❌ [FAIL] ${ep.method} ${ep.path} -> Status ${res.status}`);
      }
    } catch (err) {
      console.log(`⚠️ [CONN ERROR] ${ep.method} ${ep.path} -> ${err.message}`);
    }
  }

  console.log(`\nAPI Test Results: ${passed}/${endpoints.length} passed.`);
}

runTests();
