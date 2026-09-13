'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  Search,
  RefreshCw,
  IdCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { IssueCardDialog } from '@/features/cards/ui/issue-card-dialog';

type Student = {
  id: string;
  matricule: string | null;
  fullName: string;
  className: string | null;
  status: string;
};

type IssuedDoc = {
  id: string;
  subjectId: string;
  status: string;
};

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
};

type TemplateVersionOption = {
  id: string;
  templateId: string;
  templateName: string;
  versionNumber: number;
};

const PAGE_SIZE = 100;

export default function CardsStudentsPage() {
  const t = useTranslations('Cards');
  const params = useParams<{ locale?: string }>();

  const [students, setStudents] = useState<Student[]>([]);
  const [issued, setIssued] = useState<IssuedDoc[]>([]);
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Multi-selection state (§9.1)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});

  // Single issuance dialog
  const [dialog, setDialog] = useState<Student | null>(null);

  // Bulk issuance modal state (§9.1)
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [templateVersions, setTemplateVersions] = useState<TemplateVersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, iRes, secRes, tplRes] = await Promise.all([
        fetch(`/api/students?page=${page}&pageSize=${PAGE_SIZE}`),
        fetch('/api/cards/issued?type=student_id'),
        fetch('/api/academics/class-sections'),
        fetch('/api/cards/templates?type=student_id'),
      ]);
      const s = await sRes.json();
      const i = await iRes.json();
      const sec = await secRes.json();
      const tpl = await tplRes.json();

      if (s.success) { setStudents(s.data); setTotal(s.total ?? s.data.length); }
      if (i.success) setIssued(i.data);
      if (sec.success && Array.isArray(sec.data)) setSections(sec.data);

      if (tpl.success && Array.isArray(tpl.data)) {
        // Fetch published versions for each template
        const versions: TemplateVersionOption[] = [];
        for (const tplItem of tpl.data) {
          const vRes = await fetch(`/api/cards/templates/${tplItem.id}/versions`).then(r => r.json()).catch(() => ({}));
          if (vRes.success && Array.isArray(vRes.data)) {
            for (const v of vRes.data) {
              if (v.publishedById) {
                versions.push({
                  id: v.id,
                  templateId: tplItem.id,
                  templateName: tplItem.name,
                  versionNumber: v.versionNumber,
                });
              }
            }
          }
        }
        setTemplateVersions(versions);
        if (versions.length > 0 && versions[0]) setSelectedVersionId(versions[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const statusByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of issued) map.set(doc.subjectId, doc.status);
    return map;
  }, [issued]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s => {
      const matchesSearch = s.fullName?.toLowerCase().includes(q) || (s.matricule?.toLowerCase().includes(q) ?? false);
      const matchesClass = selectedClass === 'all' || (s.className && s.className.toLowerCase().includes(selectedClass.toLowerCase()));
      return matchesSearch && matchesClass;
    });
  }, [students, search, selectedClass]);

  const selectedCount = Object.values(selectedStudentIds).filter(Boolean).length;

  const handleToggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      for (const s of filtered) updated[s.id] = true;
    }
    setSelectedStudentIds(updated);
  };

  const handleBulkIssueSubmit = async () => {
    const targetIds = Object.keys(selectedStudentIds).filter(id => selectedStudentIds[id]);
    if (targetIds.length === 0 || !selectedVersionId) return;

    setBulkIssuing(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/cards/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateVersionId: selectedVersionId,
          subjectType: 'student',
          subjectIds: targetIds,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error?.message || json.message || t('bulkJobFailed'));
        return;
      }
      setSuccessBanner(t('bulkJobSuccess', { count: targetIds.length }));
      setBulkModalOpen(false);
      setSelectedStudentIds({});
      setTimeout(() => setSuccessBanner(null), 5000);
      load();
    } catch {
      setErrorBanner(t('serverConnectionError'));
    } finally {
      setBulkIssuing(false);
    }
  };

  const withActiveCard = students.filter(s => statusByStudent.get(s.id) === 'active').length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('studentsCardsTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('studentsCardsSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedCount > 0 && (
            <Button
              onClick={() => setBulkModalOpen(true)}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('btnBulkIssue', { count: selectedCount })}
            </Button>
          )}
        </div>
      </div>

      {successBanner && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">{t('btnClose')}</button>
        </div>
      )}

      {errorBanner && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiRegisteredStudents')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{total}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center"><Users className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiActiveCards')}</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{withActiveCard}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><IdCard className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiWithoutCard')}</span>
            <h3 className="text-2xl font-extrabold text-amber-700 mt-1">{students.length - withActiveCard}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><IdCard className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Students table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div className="relative w-72">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('searchStudentPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9 text-xs rounded-xl border-slate-200"
              />
            </div>

            {/* Class Section Filter (§9.1) */}
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="all">{t('allClasses', { count: sections.length })}</option>
              {sections.map(sec => (
                <option key={sec.id} value={`${sec.className} ${sec.sectionName}`}>
                  {sec.className} — {sec.sectionName}
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold gap-1.5 cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" /> {t('btnRefresh')}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/70 text-start text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 ps-4 w-10 text-start">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(s => selectedStudentIds[s.id])}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="p-3 text-start">{t('thStudent')}</th>
                <th className="p-3 text-start">{t('thMatricule')}</th>
                <th className="p-3 text-start">{t('thClass')}</th>
                <th className="p-3 text-start">{t('thCardStatus')}</th>
                <th className="p-3 text-end pe-4">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('loadingStudents')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('noStudentsFound')}</td></tr>
              ) : (
                filtered.map(s => {
                  const cardStatus = statusByStudent.get(s.id);
                  const isSelected = Boolean(selectedStudentIds[s.id]);
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                      <td className="p-3 ps-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedStudentIds({ ...selectedStudentIds, [s.id]: e.target.checked })}
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-800">{s.fullName}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{s.matricule ?? '-'}</td>
                      <td className="p-3 text-slate-600">{s.className ?? '-'}</td>
                      <td className="p-3">
                        {cardStatus ? (
                          <Badge variant={cardStatus === 'active' ? 'success' : cardStatus === 'revoked' ? 'danger' : 'warning'}>
                            {cardStatus === 'active' ? t('statusActive') : cardStatus === 'revoked' ? t('statusRevoked') : t('statusExpired')}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">{t('statusNone')}</Badge>
                        )}
                      </td>
                      <td className="p-3 pe-4 text-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs font-bold cursor-pointer"
                          onClick={() => setDialog(s)}
                        >
                          <IdCard className="w-3.5 h-3.5 me-1" /> {t('btnIssue')}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-semibold text-slate-500">{t('paginationStudents', { page, totalPages, total })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold cursor-pointer" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" /> {t('btnPrevious')}
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold cursor-pointer" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              {t('btnNext')} <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </Card>

      {/* SINGLE CARD ISSUANCE DIALOG */}
      <IssueCardDialog
        open={dialog !== null}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        subjectType="student"
        templateType="student_id"
        subjectId={dialog?.id ?? ''}
        subjectLabel={t('subjectStudentLabel')}
        subjectName={dialog?.fullName ?? ''}
      />

      {/* BULK CARD ISSUANCE MODAL (§9.1) */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0066FF]" />
              {t('bulkIssueStudentTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              {t('bulkIssueStudentDesc', { count: selectedCount })}
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('publishedCardTemplate')}</label>
              <select
                value={selectedVersionId}
                onChange={e => setSelectedVersionId(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium"
              >
                {templateVersions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.templateName} ({t('versionLabel', { version: v.versionNumber, status: t('statusPublished') })})
                  </option>
                ))}
              </select>
              {templateVersions.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">{t('noPublishedVersionFound')}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setBulkModalOpen(false)} className="h-9 text-xs rounded-xl border-slate-200 cursor-pointer">
              {t('btnCancel')}
            </Button>
            <Button
              onClick={handleBulkIssueSubmit}
              disabled={bulkIssuing || !selectedVersionId || selectedCount === 0}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 cursor-pointer"
            >
              {bulkIssuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              {t('btnLaunchIssuance', { count: selectedCount })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
