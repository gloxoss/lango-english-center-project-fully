'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollText, Plus, Search, RefreshCw, PenLine, Archive, Loader2 } from 'lucide-react';

type Definition = {
  id: string;
  title: string;
  description: string | null;
  allowedTargetType: 'student' | 'employee';
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
};

export default function CertificatesDefinitionsPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const t = useTranslations('Certificates');

  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<'student' | 'employee'>('student');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Definition | null>(null);
  const [archiving, setArchiving] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: t('statusActive'), variant: 'success' as const };
      case 'draft':
        return { label: t('statusDraft'), variant: 'warning' as const };
      case 'archived':
        return { label: t('statusArchived'), variant: 'neutral' as const };
      default:
        return { label: status, variant: 'neutral' as const };
    }
  };

  const getTargetLabel = (type: string) => {
    switch (type) {
      case 'student':
        return t('targetStudents');
      case 'employee':
        return t('targetEmployees');
      default:
        return type;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certificates/definitions').then(r => r.json());
      if (res.success) setDefinitions(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return definitions.filter(d =>
      (d.title?.toLowerCase().includes(q) ?? false) &&
      (typeFilter === 'all' || d.allowedTargetType === typeFilter) &&
      (statusFilter === 'all' || d.status === statusFilter)
    );
  }, [definitions, search, typeFilter, statusFilter]);

  const openCreate = () => {
    setTitle('');
    setDescription('');
    setTargetType('student');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/certificates/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), allowedTargetType: targetType }),
      });
      const json = await res.json();
      if (!json.success) {
        setCreateError(json.message || json.error?.message || t('errorCreateDef'));
        return;
      }
      setIsCreateOpen(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/certificates/definitions/${archiveTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || json.error?.message || t('errorArchiveDef'));
      }
      setArchiveTarget(null);
      await load();
    } finally {
      setArchiving(false);
    }
  };

  const activeCount = definitions.filter(d => d.status === 'active').length;
  const studentCount = definitions.filter(d => d.allowedTargetType === 'student').length;
  const employeeCount = definitions.filter(d => d.allowedTargetType === 'employee').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('definitionsTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t('definitionsSubtitle')}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" /><span>{t('btnNewDefinition')}</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statTotal')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{definitions.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statActive')}</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{activeCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statStudents')}</span>
            <h3 className="text-2xl font-extrabold text-[#2487B8] mt-1">{studentCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statStaff')}</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{employeeCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-72">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder={t('searchDefinitionsPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9 h-9 text-xs rounded-xl" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder={t('filterAllTypes')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('filterAllTypes')}</SelectItem>
              <SelectItem value="student" className="text-xs">{t('targetStudents')}</SelectItem>
              <SelectItem value="employee" className="text-xs">{t('targetEmployees')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder={t('filterAllStatuses')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('filterAllStatuses')}</SelectItem>
              <SelectItem value="active" className="text-xs">{t('statusActive')}</SelectItem>
              <SelectItem value="draft" className="text-xs">{t('statusDraft')}</SelectItem>
              <SelectItem value="archived" className="text-xs">{t('statusArchived')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 me-1.5" />{t('btnRefresh')}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-start text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 ps-4 text-start">{t('thTitle')}</th>
                <th className="p-3 text-start">{t('thRecipients')}</th>
                <th className="p-3 text-start">{t('thStatus')}</th>
                <th className="p-3 text-start">{t('thDescription')}</th>
                <th className="p-3 text-start">{t('thCreatedAt')}</th>
                <th className="p-3 text-end pe-4">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('tableLoading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('tableNoDefinitions')}</td></tr>
              ) : (
                filtered.map(d => {
                  const sBadge = getStatusBadge(d.status);
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-3 ps-4 font-semibold text-slate-700">{d.title}</td>
                      <td className="p-3">
                        <Badge variant={d.allowedTargetType === 'student' ? 'info' : 'signal'}>
                          {getTargetLabel(d.allowedTargetType)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={sBadge.variant}>
                          {sBadge.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-500 max-w-[260px] truncate">{d.description || '-'}</td>
                      <td className="p-3 text-slate-500">{new Date(d.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                      <td className="p-3 pe-4 text-end space-x-1.5 rtl:space-x-reverse whitespace-nowrap">
                        {d.status !== 'archived' && (
                          <>
                            <Link
                              href={`/${locale}/dashboard/certificates/definitions/${d.id}`}
                              className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                            >
                              <PenLine className="w-3.5 h-3.5 me-1.5" />{t('btnDesign')}
                            </Link>
                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => setArchiveTarget(d)}>
                              <Archive className="w-3.5 h-3.5 me-1.5" />{t('btnArchive')}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader className="text-start">
            <DialogTitle>{t('dialogNewDefTitle')}</DialogTitle>
            <DialogDescription>{t('dialogNewDefDesc')}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2 text-start">
              <Label className="text-xs font-bold text-slate-700">{t('labelTitle')}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('placeholderDefTitle')} className="h-9 text-xs rounded-xl" />
            </div>
            <div className="space-y-2 text-start">
              <Label className="text-xs font-bold text-slate-700">{t('labelRecipients')}</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as 'student' | 'employee')}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student" className="text-xs">{t('targetStudents')}</SelectItem>
                  <SelectItem value="employee" className="text-xs">{t('targetEmployees')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 text-start">
              <Label className="text-xs font-bold text-slate-700">{t('labelDescOptional')}</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t('placeholderDefDesc')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
              />
            </div>
            {createError && <p className="text-xs font-semibold text-rose-600">{createError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">{t('btnCancel')}</Button>
            <Button className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleCreate} disabled={creating || !title.trim()}>
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? t('btnCreating') : t('btnCreate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive dialog */}
      <Dialog open={archiveTarget !== null} onOpenChange={(o) => { if (!o && !archiving) setArchiveTarget(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader className="text-start">
            <DialogTitle>{t('dialogArchiveDefTitle')}</DialogTitle>
            <DialogDescription>
              {t('dialogArchiveDefDesc', { title: archiveTarget?.title ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setArchiveTarget(null)} className="text-xs h-9 cursor-pointer" disabled={archiving}>{t('btnCancel')}</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="w-4 h-4 animate-spin" />}
              {archiving ? t('btnArchiving') : t('btnArchive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
