'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  IdCard,
  Search,
  RefreshCw,
  CalendarDays,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { IssueCardDialog } from '@/features/cards/ui/issue-card-dialog';

type Seat = {
  id: string;
  studentId: string;
  studentName: string;
  studentMatricule: string | null;
  candidateNumber: string;
  seatNumber: number;
  deskLabel: string | null;
  examTermId: string;
  termName: string;
  termDate: string;
  hallName: string;
};

type IssuedDoc = {
  id: string;
  examCandidateId: string | null;
  status: string;
};

type TemplateVersionOption = {
  id: string;
  templateId: string;
  templateName: string;
  versionNumber: number;
};

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
};

export default function CardsAdmitCardsPage() {
  const t = useTranslations('Cards');
  const params = useParams<{ locale?: string }>();

  const [seats, setSeats] = useState<Seat[]>([]);
  const [issued, setIssued] = useState<IssuedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState('all');
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('all');

  // Single issuance dialog
  const [dialog, setDialog] = useState<Seat | null>(null);

  // Bulk convocation issuance state (§9.5)
  const [selectedSeatIds, setSelectedSeatIds] = useState<Record<string, boolean>>({});
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [templateVersions, setTemplateVersions] = useState<TemplateVersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, iRes, tplRes, csRes] = await Promise.all([
        fetch('/api/cards/admit-seats'),
        fetch('/api/cards/issued?type=admit_card'),
        fetch('/api/cards/templates?type=admit_card'),
        fetch('/api/academics/class-sections?pageSize=100'),
      ]);
      const s = await sRes.json();
      const i = await iRes.json();
      const tpl = await tplRes.json();
      const cs = await csRes.json();

      if (s.success) setSeats(s.data);
      if (i.success) setIssued(i.data);
      if (cs.success && Array.isArray(cs.data)) setClassSections(cs.data);

      if (tpl.success && Array.isArray(tpl.data)) {
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

  useEffect(() => { load(); }, []);

  const statusBySeat = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of issued) if (doc.examCandidateId) map.set(doc.examCandidateId, doc.status);
    return map;
  }, [issued]);

  const terms = useMemo(() => {
    const map = new Map<string, { id: string; name: string; date: string }>();
    for (const seat of seats) {
      if (!map.has(seat.examTermId)) {
        map.set(seat.examTermId, { id: seat.examTermId, name: seat.termName, date: seat.termDate });
      }
    }
    return [...map.values()];
  }, [seats]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return seats.filter(s =>
      (termFilter === 'all' || s.examTermId === termFilter) &&
      (s.studentName?.toLowerCase().includes(q) ||
        (s.candidateNumber?.toLowerCase().includes(q) ?? false) ||
        (s.studentMatricule?.toLowerCase().includes(q) ?? false) ||
        (s.hallName?.toLowerCase().includes(q) ?? false))
    );
  }, [seats, search, termFilter]);

  const selectedCount = Object.values(selectedSeatIds).filter(Boolean).length;

  const handleToggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      for (const s of filtered) updated[s.id] = true;
    }
    setSelectedSeatIds(updated);
  };

  const handleClassSectionSelect = async (classSectionId: string) => {
    setSelectedClassSectionId(classSectionId);
    if (classSectionId === 'all') return;
    try {
      const res = await fetch(`/api/students?classSectionId=${classSectionId}&pageSize=100`).then(r => r.json());
      if (!res.success || !Array.isArray(res.data)) return;
      const studentIds = new Set(res.data.map((s: { id: string }) => s.id));
      setSelectedSeatIds(prev => {
        const next = { ...prev };
        for (const seat of seats) {
          if (studentIds.has(seat.studentId)) next[seat.id] = true;
        }
        return next;
      });
    } catch {
      // Ignore preselection failure
    }
  };

  const handleBulkIssueSubmit = async () => {
    const targetIds = Object.keys(selectedSeatIds).filter(id => selectedSeatIds[id]);
    if (targetIds.length === 0 || !selectedVersionId) return;

    setBulkIssuing(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/cards/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateVersionId: selectedVersionId,
          subjectType: 'exam_candidate',
          subjectIds: targetIds,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error?.message || json.message || t('bulkAdmitJobFailed'));
        return;
      }
      setSuccessBanner(t('bulkAdmitJobSuccess', { count: targetIds.length }));
      setBulkModalOpen(false);
      setSelectedSeatIds({});
      setTimeout(() => setSuccessBanner(null), 5000);
      load();
    } catch {
      setErrorBanner(t('serverConnectionError'));
    } finally {
      setBulkIssuing(false);
    }
  };

  const withActiveCard = seats.filter(s => statusBySeat.get(s.id) === 'active').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-2xs shrink-0">
            <IdCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('admitCardsTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('admitCardsSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedCount > 0 && (
            <Button
              onClick={() => setBulkModalOpen(true)}
              className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('btnBulkIssueAdmit', { count: selectedCount })}
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
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiAllocatedSeats')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{seats.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiActiveAdmitCards')}</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{withActiveCard}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><IdCard className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiExamSessions')}</span>
            <h3 className="text-2xl font-extrabold text-amber-700 mt-1">{terms.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Seats table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div className="relative w-72">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('searchAdmitPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9 text-xs rounded-xl border-slate-200"
              />
            </div>
            <Select value={termFilter} onValueChange={setTermFilter}>
              <SelectTrigger className="w-56 h-9 text-xs rounded-xl border-slate-200 bg-white">
                <SelectValue placeholder={t('allTermsPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{t('allTerms', { count: terms.length })}</SelectItem>
                {terms.map(item => (
                  <SelectItem key={item.id} value={item.id} className="text-xs">{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedClassSectionId} onValueChange={handleClassSectionSelect}>
              <SelectTrigger className="w-56 h-9 text-xs rounded-xl border-slate-200 bg-white">
                <SelectValue placeholder={t('preselectClassPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{t('allClassesOption')}</SelectItem>
                {classSections.map(cs => (
                  <SelectItem key={cs.id} value={cs.id} className="text-xs">
                    {`${cs.className} ${cs.sectionName}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    checked={filtered.length > 0 && filtered.every(s => selectedSeatIds[s.id])}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="p-3 text-start">{t('thCandidate')}</th>
                <th className="p-3 text-start">{t('thCandidateNumber')}</th>
                <th className="p-3 text-start">{t('thSession')}</th>
                <th className="p-3 text-start">{t('thHallDesk')}</th>
                <th className="p-3 text-start">{t('thStatus')}</th>
                <th className="p-3 text-end pe-4">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('loadingSeats')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('noSeatsFound')}</td></tr>
              ) : (
                filtered.map(seat => {
                  const cardStatus = statusBySeat.get(seat.id);
                  const isSelected = Boolean(selectedSeatIds[seat.id]);
                  return (
                    <tr key={seat.id} className={`hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                      <td className="p-3 ps-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedSeatIds({ ...selectedSeatIds, [seat.id]: e.target.checked })}
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-[#16212B]">{seat.studentName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{seat.studentMatricule ?? ''}</p>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 font-bold">{seat.candidateNumber}</td>
                      <td className="p-3">
                        <p className="text-slate-700">{seat.termName}</p>
                        <p className="text-[10px] text-slate-400">{seat.termDate}</p>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">{seat.deskLabel ?? `${seat.hallName} #${seat.seatNumber}`}</td>
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
                          onClick={() => setDialog(seat)}
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
      </Card>

      {/* SINGLE CONVOCATION ISSUANCE DIALOG */}
      <IssueCardDialog
        open={dialog !== null}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        subjectType="exam_candidate"
        templateType="admit_card"
        subjectId={dialog?.id ?? ''}
        subjectLabel={t('subjectCandidateLabel')}
        subjectName={dialog ? `${dialog.studentName} (${dialog.candidateNumber})` : ''}
      />

      {/* BULK CONVOCATION ISSUANCE MODAL (§9.5) */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0066FF]" />
              {t('bulkAdmitModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              {t('bulkAdmitModalDesc', { count: selectedCount })}
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('publishedAdmitTemplate')}</label>
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
                <p className="text-[11px] text-amber-600 mt-1">{t('noPublishedAdmitFound')}</p>
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
