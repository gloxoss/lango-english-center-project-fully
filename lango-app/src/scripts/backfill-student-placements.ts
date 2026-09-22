import 'dotenv/config';
import { backfillLegacyStudentPlacements } from '@/libs/services/student-placement-backfill';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const tenantArg = process.argv.find(a => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  console.log(`Starting Legacy Student Placement Backfill Migration (dryRun=${isDryRun}, tenantId=${tenantId || 'all'})...`);

  const result = await backfillLegacyStudentPlacements({ tenantId, dryRun: isDryRun });

  console.log('--------------------------------------------------');
  console.log('BACKFILL MIGRATION SUMMARY:');
  console.log('Total students evaluated:', result.totalEvaluated);
  console.log('Placements backfilled:', result.backfilledCount);
  console.log('Skipped (already placed):', result.skippedAlreadyPlacedCount);
  console.log('Skipped (unassigned / no class):', result.skippedUnassignedCount);
  console.log('--------------------------------------------------');

  for (const r of result.records) {
    console.log(`[${r.action.toUpperCase()}] ${r.studentName} (${r.studentId}) -> Session ${r.sessionYearName || 'N/A'}, Section ${r.classSectionId || 'None'}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Backfill migration failed:', err);
  process.exit(1);
});
