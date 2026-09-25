'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText, Search, Check, X, Clock, CheckCircle2, XCircle, Phone, Plus, Eye, Loader2,
} from 'lucide-react';

type ExcuseItem = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  reason: string;
  documentUrl: string | null;
  documentFileExt: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
};

type StudentOption = { id: string; fullName: string; className: string };

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function AttendanceExcusesView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Attendance');

  const [excuses, setExcuses] = useState<ExcuseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedExcuseId, setSelectedExcuseId] = useState<string | null>(null);

  // Document viewer
  const [viewingExcuse, setViewingExcuse] = useState<ExcuseItem | null>(null);

  // Reject dialog
  const [rejectExcuse, setRejectExcuse] = useState<ExcuseItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Submit modal
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [newExcuse, setNewExcuse] = useState({ studentId: '', date: new Date().toISOString().slice(0, 10), reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance/excuses');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error loading excuses.');
      }
      const rows: ExcuseItem[] = json.data ?? [];
      setExcuses(rows);
      setSelectedExcuseId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading excuses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = excuses.filter((e) => e.status === 'pending').length;
  const approvedCount = excuses.filter((e) => e.status === 'approved').length;
  const rejectedCount = excuses.filter((e) => e.status === 'rejected').length;

  const filtered = excuses.filter((ex) => {
    const matchesSearch = ex.studentName.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || ex.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const selectedExcuse = excuses.find((e) => e.id === selectedExcuseId) ?? null;

  async function review(id: string, status: 'approved' | 'rejected', rejectionReason?: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance/excuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excuseId: id, status, rejectionReason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Update failed.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setSubmitting(false);
      setRejectExcuse(null);
      setRejectReason('');
    }
  }

  async function openSubmit() {
    setIsSubmitOpen(true);
    if (students.length === 0) {
      try {
        const res = await fetch('/api/students?pageSize=200');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setStudents(json.data.map((s: any) => ({ id: s.id, fullName: s.fullName, className: s.className ?? '' })));
        }
      } catch {
        // non-fatal
      }
    }
  }

  async function submitExcuse() {
    if (!newExcuse.studentId || !newExcuse.reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance/excuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: newExcuse.studentId, date: newExcuse.date, reason: newExcuse.reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Creation failed.');
      }
      setIsSubmitOpen(false);
      setNewExcuse({ studentId: '', date: new Date().toISOString().slice(0, 10), reason: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-start">
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('excusesTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('excusesSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={openSubmit}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('submitExcuseBtn')}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">{error}</div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1 text-start">
            <p className="text-xs font-bold text-slate-500">{t('kpiPendingValidation')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1 text-start">
            <p className="text-xs font-bold text-slate-500">{t('kpiApprovedExcuses')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{approvedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DDF5EC] text-[#17A673] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1 text-start">
            <p className="text-xs font-bold text-slate-500">{t('kpiRejectedExcuses')}</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{rejectedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Search & Tabs Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'pending', label: t('tabPending') },
            { id: 'approved', label: t('tabApproved') },
            { id: 'rejected', label: t('tabRejected') },
            { id: 'all', label: t('tabAll') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                activeTab === tab.id ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('searchStudentPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none text-start"
          />
        </div>
      </div>

      {/* Main 12-col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Excuses List */}
        <div className="lg:col-span-7 space-y-3">
          {loading ? (
            <Card className="p-12 flex items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200/80">
              <Loader2 className="w-5 h-5 animate-spin" />
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center text-xs text-slate-400 font-bold bg-white rounded-2xl border border-slate-200/80">
              {t('noExcusesMatching')}
            </Card>
          ) : (
            filtered.map((ex) => {
              const isSelected = selectedExcuse?.id === ex.id;
              return (
                <Card
                  key={ex.id}
                  onClick={() => setSelectedExcuseId(ex.id)}
                  className={`p-4 bg-white rounded-2xl border transition cursor-pointer space-y-3 ${
                    isSelected ? 'border-[#2487B8] bg-[#DCEBF4]/20 shadow-xs' : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] border-2 border-white shadow-2xs flex items-center justify-center font-extrabold text-xs shrink-0">
                        {initials(ex.studentName)}
                      </div>
                      <div className="text-start">
                        <h3 className="text-sm font-extrabold text-[#16212B]">{ex.studentName}</h3>
                        <p className="text-[10px] text-slate-400">{t('absenceDatePrefix', { date: formatDate(ex.date) })}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      ex.status === 'approved' ? 'bg-[#DDF5EC] text-[#17A673]' :
                      ex.status === 'rejected' ? 'bg-[#FCE4E2] text-[#E5544B]' : 'bg-[#FCF0DC] text-[#E8A33D]'
                    }`}>
                      {ex.status === 'approved' ? t('tabApproved') : ex.status === 'rejected' ? t('tabRejected') : t('tabPending')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-1 ps-12 text-start">{ex.reason}</p>
                </Card>
              );
            })
          )}
        </div>

        {/* Right 5 cols: Excuse Inspector & Document Viewer */}
        <div className="lg:col-span-5 space-y-4">
          {selectedExcuse ? (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 text-start">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-sm shrink-0">
                  {initials(selectedExcuse.studentName)}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#16212B]">{selectedExcuse.studentName}</h2>
                  <p className="text-xs text-slate-400">{t('absenceOfDate', { date: formatDate(selectedExcuse.date) })}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                <p className="font-bold text-slate-700">{t('guardianReasonHeading')}</p>
                <p className="text-slate-600">{selectedExcuse.reason}</p>
                {(selectedExcuse.documentUrl || selectedExcuse.documentFileExt) && (
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-xs font-bold text-[#2487B8]">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> {t('attachmentLabel')}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewingExcuse(selectedExcuse)}
                      className="h-7 text-xs text-[#2487B8] hover:bg-[#DCEBF4]/40 gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> {t('viewAttachmentBtn')}
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                <p className="font-bold text-[#16212B]">{t('guardianDeclarantHeading')}</p>
                <p className="text-slate-600 flex items-center gap-1.5">
                  {selectedExcuse.guardianName ?? t('notSpecified')}
                  {selectedExcuse.guardianPhone && (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Phone className="w-3 h-3" /> {selectedExcuse.guardianPhone}
                    </span>
                  )}
                </p>
              </div>

              {selectedExcuse.status === 'rejected' && selectedExcuse.rejectionReason && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-xs">
                  <p className="font-bold text-rose-700">{t('rejectionReasonHeading')}</p>
                  <p className="text-rose-600 mt-1">{selectedExcuse.rejectionReason}</p>
                </div>
              )}

              {selectedExcuse.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    disabled={submitting}
                    onClick={() => review(selectedExcuse.id, 'approved')}
                    className="flex-1 h-9 rounded-xl bg-[#17A673] hover:bg-[#12865c] text-white text-xs font-bold gap-1"
                  >
                    <Check className="w-4 h-4" /> {t('approveBtn')}
                  </Button>
                  <Button
                    disabled={submitting}
                    onClick={() => { setRejectExcuse(selectedExcuse); setRejectReason(''); }}
                    variant="outline"
                    className="h-9 rounded-xl text-xs font-bold border-rose-200 text-[#E5544B] hover:bg-rose-50"
                  >
                    <X className="w-4 h-4" /> {t('rejectBtn')}
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center text-xs text-slate-400 font-bold bg-white rounded-2xl border border-slate-200/80">
              {t('selectExcusePrompt')}
            </Card>
          )}
        </div>
      </div>

      {/* Soumettre une Justification Modal */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2 text-start">
              <FileText className="w-5 h-5 text-[#2487B8]" />
              {t('submitModalTitle')}
            </DialogTitle>
          </DialogHeader>

          {/* The admin is recording something a family handed in, not filing
              their own excuse — the hint says so where the form starts. */}
          <p className="mt-1 text-xs text-slate-500 text-start">{t('recordExcuseHint')}</p>

          <div className="space-y-3 my-3 text-xs text-start">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('studentLabel')}</label>
              <Select value={newExcuse.studentId} onValueChange={(val) => setNewExcuse({ ...newExcuse, studentId: val })}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder={t('selectStudentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.fullName}{s.className ? ` — ${s.className}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('absenceDateLabel')}</label>
              <Input
                type="date"
                value={newExcuse.date}
                onChange={(e) => setNewExcuse({ ...newExcuse, date: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('reasonLabel')}</label>
              <Input
                placeholder={t('reasonPlaceholder')}
                value={newExcuse.reason}
                onChange={(e) => setNewExcuse({ ...newExcuse, reason: e.target.value })}
                className="h-9 text-xs rounded-xl text-start"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSubmitOpen(false)} className="rounded-xl text-xs h-9">
              {t('cancelBtn')}
            </Button>
            <Button
              disabled={submitting || !newExcuse.studentId || newExcuse.reason.trim().length < 3}
              onClick={submitExcuse}
              className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              {t('submitRequestBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason Dialog */}
      <Dialog open={!!rejectExcuse} onOpenChange={(open) => { if (!open) setRejectExcuse(null); }}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] text-start">{t('rejectModalTitle')}</DialogTitle>
          </DialogHeader>
          <div className="my-3 space-y-2 text-xs text-start">
            <label className="font-bold text-slate-700 block">{t('rejectionReasonLabel')}</label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('rejectionReasonPlaceholder')}
              className="h-9 text-xs rounded-xl text-start"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectExcuse(null)} className="rounded-xl text-xs h-9">
              {t('cancelBtn')}
            </Button>
            <Button
              disabled={submitting || rejectReason.trim().length < 3}
              onClick={() => rejectExcuse && review(rejectExcuse.id, 'rejected', rejectReason.trim())}
              className="rounded-xl text-xs h-9 bg-[#E5544B] hover:bg-[#c93f38] text-white font-bold"
            >
              {t('confirmRejectionBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Viewer Dialog */}
      <Dialog open={!!viewingExcuse} onOpenChange={(open) => { if (!open) setViewingExcuse(null); }}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2 text-start">
              <FileText className="w-5 h-5 text-[#2487B8]" />
              {t('previewModalTitle')}
            </DialogTitle>
          </DialogHeader>

          {viewingExcuse && (
            <div className="my-3">
              {viewingExcuse.documentFileExt === 'pdf' ? (
                <iframe
                  src={viewingExcuse.documentUrl ?? `/api/attendance/excuses/document?excuseId=${viewingExcuse.id}`}
                  title={t('attachmentLabel')}
                  className="h-[60vh] w-full rounded-xl border border-slate-200"
                />
              ) : (
                <img
                  src={viewingExcuse.documentUrl ?? `/api/attendance/excuses/document?excuseId=${viewingExcuse.id}`}
                  alt={t('attachmentLabel')}
                  className="max-h-[60vh] w-full rounded-xl border border-slate-200 object-contain bg-slate-50"
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setViewingExcuse(null)} className="w-full rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              {t('closePreviewBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
