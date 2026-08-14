import {
  validateCoordinates,
  calculateSegmentCapacity,
  doTimeRangesOverlap,
  sanitizeDriverProfile,
  sanitizeIncidentForSelfService,
} from '@/features/transport/services/transport-service';

async function main() {
  console.log('=== RUNNING STUDENT TRANSPORT AUTOMATED VERIFICATION SUITE ===');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`[PASS] ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${description}`);
      failed++;
    }
  }

  // Test 1: Coordinate Validation
  console.log('\n--- 1. GEO-COORDINATE VALIDATION ---');
  assert(validateCoordinates(33.9716, -6.8498) === true, 'Valid Rabat GPS coordinates (33.9716, -6.8498)');
  assert(validateCoordinates(95.0, -6.8498) === false, 'Invalid latitude > 90 rejected');
  assert(validateCoordinates(33.9716, 195.0) === false, 'Invalid longitude > 180 rejected');
  assert(validateCoordinates(null, null) === true, 'Null coordinates allowed for unspecified stops');

  // Test 2: Time Range Overlap Check
  console.log('\n--- 2. TIME RANGE OVERLAP CHECK ---');
  assert(doTimeRangesOverlap('07:30', '08:30', '08:00', '09:00') === true, 'Overlapping shift ranges detected');
  assert(doTimeRangesOverlap('07:30', '08:30', '08:30', '09:30') === false, 'Non-overlapping contiguous shifts allowed');

  // Test 3: Segment Capacity Calculation
  console.log('\n--- 3. SEGMENT CAPACITY CALCULATION ---');
  const cap1 = calculateSegmentCapacity(30, 25, 0);
  assert(cap1.available === 5, '30 cap - 25 active = 5 available');
  assert(cap1.isOverbooked === false, 'Not overbooked');

  const cap2 = calculateSegmentCapacity(30, 32, 0);
  assert(cap2.available === 0, '0 available when allocations exceed capacity');
  assert(cap2.isOverbooked === true, 'Overbooked flag set when allocations exceed capacity');

  // Test 4: Driver HR Data Sanitization (PII Protection)
  console.log('\n--- 4. DRIVER PII SANITIZATION ---');
  const mockStaff = {
    id: 'usr-123',
    name: 'Youssef El Amrani',
    email: 'youssef@lango.ma',
    phoneNumber: '+212600112233',
    role: 'driver',
    nationalId: 'AB123456',
    salary: 6500,
    bankRib: '123456789012345678901234',
  };
  const sanitized = sanitizeDriverProfile(mockStaff);
  assert(sanitized.id === 'usr-123', 'Preserves user ID');
  assert(sanitized.name === 'Youssef El Amrani', 'Preserves name');
  assert(sanitized.email === 'youssef@lango.ma', 'Preserves email');
  assert(!('nationalId' in sanitized), 'Strips national ID (CIN)');
  assert(!('salary' in sanitized), 'Strips salary');
  assert(!('bankRib' in sanitized), 'Strips bank RIB');

  // Test 5: Incident Safeguarding Note Redaction
  console.log('\n--- 5. INCIDENT SAFEGUARDING REDACTION ---');
  const mockIncident = {
    id: 'inc-999',
    title: 'Late Route',
    incidentType: 'late_route',
    severity: 'medium',
    status: 'open',
    createdAt: new Date(),
    safeguardingRedactedNotes: 'SENSITIVE CHILD PROTECTION NOTE',
  };

  const selfServiceIncident = sanitizeIncidentForSelfService(mockIncident);
  assert(selfServiceIncident.title === 'Late Route', 'Preserves incident title');
  assert(!('safeguardingRedactedNotes' in selfServiceIncident), 'Redacts safeguarding notes for self-service viewers');

  console.log('\n==================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
