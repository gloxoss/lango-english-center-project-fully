'use client';

import { AlertTriangle, CheckCircle2, GraduationCap, Search, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';

type StudentRow = { id: string; fullName: string; matricule: string | null; className: string | null };
type ClassSection = { id: string; className: string; sectionName: string };
type ItemResult = { studentId: string; success: boolean; tempPassword?: string | null; loginAccessDeliveryStatus?: string | null; error?: string };

// Real bulk transition for a whole graduating cohort at once (Phase 4
// refinement, future-implementation/alumni-portal) - one real confirmation
// step naming the count, not one dialog per student.
export function BulkAlumniTransitionView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [terminalClassSectionId, setTerminalClassSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ItemResult[] | null>(null);

  useEffect(() => {
    fetch('/api/students?pageSize=200').then(r => r.json()).then(j => j?.success && setStudents(j.data)).catch(() => {});
    fetch('/api/academics/class-sections?pageSize=200').then(r => r.json()).then(j => j?.success && setClassSections(j.data)).catch(() => {});
  }, []);

  const filtered = students.filter(s => s.fullName.toLowerCase().includes(search.toLowerCase()) || (s.matricule ?? '').toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/students/bulk-transition-to-alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selected) }),
      });
      const json = await res.json();
      if (json.success) {
        setResults(json.results);
        setSelected(new Set());
      }
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  // "Promouvoir la classe sortante" — one-click select of every student in the
  // chosen graduating class (Terminale / 3ème), then the same single confirmation.
  const handlePromoteGraduatingClass = async () => {
    if (!terminalClassSectionId) {
      return;
    }
    try {
      const res = await fetch(`/api/students?classSectionId=${terminalClassSectionId}&pageSize=200`).then(r => r.json());
      const ids: string[] = (res?.data ?? []).map((s: StudentRow) => s.id).filter(Boolean);
      if (ids.length === 0) {
        return;
      }
      setSelected(new Set(ids));
      setShowConfirm(true);
    } catch {
      // ignore — the confirm dialog simply won't open
    }
  };

  const canManage = can('admissions.manage');

  if (!canManage) {
    return (
      <div className="
        mx-auto mt-12 max-w-lg rounded-2xl border border-slate-200 bg-slate-50
        p-6 text-center text-sm font-semibold text-slate-500
      "
      >
        {tCommon('error')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('bulkAlumniTitle')}</h1>
        <p className="mt-1 text-xs text-slate-500">{t('bulkAlumniSubtitle')}</p>
      </div>

      <Card className="
        flex flex-col items-start justify-between gap-3 rounded-2xl border
        border-slate-200/80 bg-white p-4 shadow-2xs
        sm:flex-row sm:items-center
      "
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[#16212B]">{t('promoteGraduatingClassTitle')}</span>
          <span className="text-[11px] text-slate-500">{t('promoteGraduatingClassDesc')}</span>
        </div>
        <div className="
          flex w-full items-center gap-2
          sm:w-auto
        "
        >
          <Select value={terminalClassSectionId} onValueChange={setTerminalClassSectionId}>
            <SelectTrigger className="
              h-9 flex-1 rounded-xl border-slate-200 bg-slate-50 text-xs
              sm:w-64
            "
            >
              <SelectValue placeholder={t('chooseGraduatingClass')} />
            </SelectTrigger>
            <SelectContent>
              {classSections.map(cs => (
                <SelectItem key={cs.id} value={cs.id}>
                  {cs.className}
                  {' '}
                  {cs.sectionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!terminalClassSectionId}
            onClick={handlePromoteGraduatingClass}
            className="
              h-9 gap-1.5 rounded-xl bg-[#17A673] text-xs font-bold text-white
              hover:bg-[#12845B]
            "
          >
            <GraduationCap className="size-3.5" />
            {t('selectBtn')}
          </Button>
        </div>
      </Card>

      <Card className="
        flex items-center justify-between gap-3 rounded-2xl border
        border-slate-200/80 bg-white p-3 shadow-2xs
      "
      >
        <div className="relative max-w-md flex-1">
          <Search className="
            absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-slate-400
          "
          />
          <Input
            placeholder={t('searchStudentPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="
              h-9 rounded-xl border-none bg-slate-50 ps-9 text-start text-xs
            "
          />
        </div>
        <Button
          size="sm"
          disabled={selected.size === 0}
          onClick={() => setShowConfirm(true)}
          className="
            h-9 gap-1.5 rounded-xl bg-[#2487B8] text-xs font-bold text-white
            hover:bg-[#1B6C93]
          "
        >
          <GraduationCap className="size-3.5" />
          {t('transitionCountBtn', { count: selected.size })}
        </Button>
      </Card>

      <Card className="
        overflow-hidden rounded-2xl border border-slate-200/80 bg-white
        shadow-2xs
      "
      >
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="
              border-b border-slate-200/80 bg-[#F6F9FC] font-extrabold
              text-[#16212B]
            "
            >
              <tr>
                <th className="w-10 px-4 py-3 text-start" />
                <th className="px-4 py-3 text-start">{t('student')}</th>
                <th className="px-4 py-3 text-start">{t('matricule')}</th>
                <th className="px-4 py-3 text-start">{t('classSection')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <tr
                  key={s.id}
                  className={`
                    cursor-pointer transition
                    hover:bg-slate-50/80
                    ${selected.has(s.id)
                  ? `bg-[#DCEBF4]/20`
                  : ''}
                  `}
                  onClick={() => toggle(s.id)}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      onClick={e => e.stopPropagation()}
                      className="rounded-sm border-slate-300"
                    />
                  </td>
                  <td className="
                    px-4 py-2.5 text-start font-bold text-[#16212B]
                  "
                  >
                    {s.fullName}
                  </td>
                  <td className="
                    px-4 py-2.5 text-start font-mono text-slate-400
                  "
                  >
                    {s.matricule ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-start text-slate-600">{s.className ?? t('unassigned')}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-slate-400"
                  >
                    {t('emptyRosterFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {results && (
        <Card className="
          overflow-hidden rounded-2xl border border-slate-200/80 bg-white
          shadow-2xs
        "
        >
          <div className="border-b border-slate-100 p-4">
            <p className="text-xs font-bold text-[#16212B]">
              {t('bulkTransitionResultSummary', {
                successCount: results.filter(r => r.success).length,
                totalCount: results.length,
              })}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {results.map((r) => {
              const student = students.find(s => s.id === r.studentId);
              return (
                <div
                  key={r.studentId}
                  className="
                    flex items-center justify-between gap-2 p-3 text-xs
                  "
                >
                  <div className="flex items-center gap-2">
                    {r.success
                      ? (
                          <CheckCircle2 className="
                            size-3.5 shrink-0 text-[#17A673]
                          "
                          />
                        )
                      : (
                          <XCircle className="size-3.5 shrink-0 text-rose-600" />
                        )}
                    <span className="font-bold text-[#16212B]">{student?.fullName ?? r.studentId}</span>
                    {student?.matricule && (
                      <span className="font-mono text-[10px] text-slate-400">
                        (
                        {student.matricule}
                        )
                      </span>
                    )}
                  </div>
                  {r.success
                    ? <span className="font-semibold text-[#17A673]">{r.tempPassword ? t('passwordLabel', { password: r.tempPassword }) : t('accountCreated')}</span>
                    : <span className="font-semibold text-rose-600">{r.error}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-base font-extrabold text-[#16212B]
            "
            >
              <AlertTriangle className="size-5 text-amber-500" />
              {t('bulkTransitionConfirmTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="mt-2 text-xs text-slate-600">
            {t('bulkTransitionConfirmDesc', { count: selected.size })}
          </p>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="h-9 rounded-full text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              disabled={submitting}
              onClick={handleConfirm}
              className="
                h-9 rounded-full border-0 bg-[#2487B8] text-xs text-white
                hover:bg-[#1B6C93]
              "
            >
              {submitting ? t('transitionInProgress') : tCommon('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
