import { Buffer } from 'node:buffer';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Massar import wrote marks straight into assessment_outcomes: any teacher,
// any student of the school, published terms included, every paper /20.

const selectResults: unknown[][] = [];
const saveMarksheetGrid = vi.fn(async () => []);
const requireExamTermStage = vi.fn(async () => undefined);

vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(() => {
      const b: Record<string, unknown> = {};
      b.from = () => b;
      b.where = () => b;
      b.limit = async () => selectResults.shift() ?? [];
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve(selectResults.shift() ?? []).then(ok);
      return b;
    }),
  },
}));
vi.mock('@/features/assessment/services/exam-master-service', () => ({ ExamMasterService: { saveMarksheetGrid } }));
vi.mock('@/features/assessment/services/exam-term-guard', () => ({ requireExamTermStage }));

const { parseAndImportMassarMarks } = await import('@/features/academics/services/massar-sync-service');

async function sheet(rows: Array<[string, string, number | string]>) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Notes');
  ws.addRow(['Code Massar', 'Nom et prénom', 'Note']);
  for (const r of rows) {
    ws.addRow(r);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const STUDENTS = [
  { id: 's1', name: 'Amine Idrissi', codeMassar: 'M1' },
  { id: 's2', name: 'Sara Alaoui', codeMassar: 'M2' },
];

beforeEach(() => {
  vi.clearAllMocks();
  selectResults.length = 0;
});

describe('Massar marks import guards', () => {
  it('checks the exam-term stage and saves through the marksheet service', async () => {
    selectResults.push([{ id: 'def-1', termId: 'term-1', maximumScore: '20' }], STUDENTS);
    const res = await parseAndImportMassarMarks('t1', 'def-1', await sheet([['M1', 'Amine Idrissi', 14]]), { markerId: 'teacher-1', writableStudentIds: null });

    expect(requireExamTermStage).toHaveBeenCalledWith('t1', 'term-1', 'enter_marks');
    expect(saveMarksheetGrid).toHaveBeenCalledWith(expect.objectContaining({ markerId: 'teacher-1', marks: [{ studentId: 's1', rawScore: 14, status: 'graded' }] }));
    expect(res.importedCount).toBe(1);
  });

  it('refuses the whole file when a student is outside the teacher’s classes', async () => {
    selectResults.push([{ id: 'def-1', termId: null, maximumScore: '20' }], STUDENTS);

    await expect(parseAndImportMassarMarks('t1', 'def-1', await sheet([['M1', '', 12], ['M2', '', 15]]), {
      markerId: 'teacher-1',
      writableStudentIds: new Set(['s1']),
    })).rejects.toMatchObject({ status: 403 });
    expect(saveMarksheetGrid).not.toHaveBeenCalled();
  });

  it('uses the paper maximum instead of assuming /20', async () => {
    selectResults.push([{ id: 'def-1', termId: null, maximumScore: '40' }], STUDENTS);
    const res = await parseAndImportMassarMarks('t1', 'def-1', await sheet([['M1', '', 35], ['M2', '', 41]]), { markerId: 'u', writableStudentIds: null });

    expect(res.importedCount).toBe(1);
    expect(res.errorCount).toBe(1);
  });

  it('does not match by a name two students share', async () => {
    selectResults.push([{ id: 'def-1', termId: null, maximumScore: '20' }], [
      { id: 's1', name: 'Amine Idrissi', codeMassar: null },
      { id: 's3', name: 'Amine Idrissi', codeMassar: null },
    ]);
    const res = await parseAndImportMassarMarks('t1', 'def-1', await sheet([['', 'Amine Idrissi', 12]]), { markerId: 'u', writableStudentIds: null });

    expect(res.importedCount).toBe(0);
    expect(res.errorCount).toBe(1);
    expect(saveMarksheetGrid).not.toHaveBeenCalled();
  });

  it('rejects a file that is not a workbook with 422, not a crash', async () => {
    selectResults.push([{ id: 'def-1', termId: null, maximumScore: '20' }], STUDENTS);

    await expect(parseAndImportMassarMarks('t1', 'def-1', Buffer.from('not excel'), { markerId: 'u', writableStudentIds: null }))
      .rejects
      .toMatchObject({ status: 422, code: 'INVALID_FILE' });
  });
});
