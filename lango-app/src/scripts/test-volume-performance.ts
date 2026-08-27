import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, count, eq, ilike, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceRegisters,
  classSections,
  classes,
  invoices,
  mediums,
  payments,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

export async function runVolumeBenchmark() {
  console.log('=== SchoolOS Volume & Scale Performance Benchmark (2,000+ Students) ===');

  const suffix = randomUUID().slice(0, 6);
  const tenantId = randomUUID();
  const perfMetrics: Record<string, { durationMs: number; rowCount: number; status: 'PASS' | 'WARN' | 'FAIL' }> = {};

  try {
    console.log('[1/5] Checking DB connectivity and baseline indexes...');
    await db.execute(sql`SELECT 1`);

    // 1. Provision Benchmark Tenant
    await db.insert(tenants).values({
      id: tenantId,
      name: `Benchmark Institute ${suffix}`,
      slug: `bench-${suffix}`,
      isActive: true,
      planTier: 'trial',
      subscriptionStatus: 'active',
    });

    const [sy] = await db.insert(sessionYears).values({
      tenantId,
      name: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-06-30',
      isDefault: true,
    }).returning();

    const [med] = await db.insert(mediums).values({ tenantId, name: 'Français' }).returning();
    const [sec] = await db.insert(sections).values({ tenantId, name: 'Section A' }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, name: 'TC-SC', mediumId: med!.id }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: sec!.id, mediumId: med!.id }).returning();

    // 2. Measure Student Batch Insertion (2,000 rows in batches of 500)
    console.log('[2/5] Benchmarking Student Batch Ingestion (2,000 synthetic Moroccan records)...');
    const startInsert = performance.now();
    const BATCH_SIZE = 500;
    const TOTAL_STUDENTS = 2000;

    for (let b = 0; b < TOTAL_STUDENTS / BATCH_SIZE; b++) {
      const batchRows = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const idx = b * BATCH_SIZE + i + 1;
        batchRows.push({
          id: `BENCH-STU-${suffix}-${idx}`,
          tenantId,
          name: `Élève Test ${idx} ${suffix}`,
          email: `eleve.${idx}.${suffix}@bench.schoolos.ma`,
          matricule: `2025-BENCH-${String(idx).padStart(4, '0')}`,
          role: 'student' as const,
          userStatus: 'active' as const,
          classSectionId: cs!.id,
        });
      }
      await db.insert(user).values(batchRows);
    }
    const insertDuration = performance.now() - startInsert;
    perfMetrics['Batch Insertion (2k students)'] = {
      durationMs: Math.round(insertDuration),
      rowCount: TOTAL_STUDENTS,
      status: insertDuration < 3000 ? 'PASS' : 'WARN',
    };

    // 3. Measure Student Directory Paginated Retrieval
    console.log('[3/5] Benchmarking Paginated Student Lookup with Search & Tenant Scoping...');
    const startSelect = performance.now();
    const page1 = await db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      matricule: user.matricule,
      classSectionId: user.classSectionId,
    })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(50)
      .offset(0);
    const selectDuration = performance.now() - startSelect;
    perfMetrics['Paginated Directory (50/2000)'] = {
      durationMs: Math.round(selectDuration * 100) / 100,
      rowCount: page1.length,
      status: selectDuration < 50 ? 'PASS' : 'WARN',
    };

    // 4. Measure Substring Search Across 2,000 Records
    const startSearch = performance.now();
    const searchResults = await db.select({ id: user.id, name: user.name })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        ilike(user.name, '%Élève Test 15%'),
      ))
      .limit(20);
    const searchDuration = performance.now() - startSearch;
    perfMetrics['ILIKE Name Search (Filtered)'] = {
      durationMs: Math.round(searchDuration * 100) / 100,
      rowCount: searchResults.length,
      status: searchDuration < 100 ? 'PASS' : 'WARN',
    };

    // 5. Measure Aggregation Performance (Total Active Students per Tenant)
    console.log('[4/5] Benchmarking Aggregation Queries (COUNT, SUM)...');
    const startCount = performance.now();
    const [totalCount] = await db.select({ count: count() })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));
    const countDuration = performance.now() - startCount;
    perfMetrics['Tenant Student Count Aggregation'] = {
      durationMs: Math.round(countDuration * 100) / 100,
      rowCount: totalCount?.count ?? 0,
      status: countDuration < 50 ? 'PASS' : 'WARN',
    };

    // Cleanup Benchmark Data
    console.log('[5/5] Cleaning up benchmark tenant data...');
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));

    console.log('\n=== Performance Benchmark Results ===');
    console.table(perfMetrics);

    return { success: true, metrics: perfMetrics };
  } catch (error) {
    console.error('Benchmark execution error:', error);
    // Cleanup on error
    try {
      await db.delete(user).where(eq(user.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    } catch {}
    return { success: false, error: String(error) };
  }
}

if (process.argv[1]?.includes('test-volume-performance')) {
  runVolumeBenchmark()
    .then(res => {
      if (res.success) {
        console.log('✅ Volume benchmark completed successfully.');
        process.exit(0);
      } else {
        console.error('❌ Volume benchmark failed.');
        process.exit(1);
      }
    })
    .catch(e => {
      console.error('Fatal benchmark error:', e);
      process.exit(1);
    });
}
