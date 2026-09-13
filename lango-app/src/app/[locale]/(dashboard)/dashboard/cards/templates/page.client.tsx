'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IdCard, Plus, FileText, Search, CreditCard, Key, Archive, PenTool } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  type: 'student_id' | 'employee_id' | 'admit_card';
  status: 'draft' | 'published' | 'archived';
  isDefault: boolean;
  createdAt: string;
}

export default function TemplatesLibraryPage() {
  const t = useTranslations('Cards');
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const TYPE_LABELS: Record<string, string> = {
    student_id: t('typeStudentId'),
    employee_id: t('typeEmployeeId'),
    admit_card: t('typeAdmitCard'),
  };

  const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'info' | 'success' | 'danger' | 'warning' | 'signal' }> = {
    draft: { label: t('statusDraft'), variant: 'neutral' },
    published: { label: t('statusPublished'), variant: 'success' },
    archived: { label: t('statusArchived'), variant: 'warning' },
  };

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('student_id');
  const [creating, setCreating] = useState(false);

  const load = () => fetch('/api/cards/templates')
    .then(r => r.json())
    .then(j => { if (j.success) setTemplates(j.data); });

  useEffect(() => { 
    load().finally(() => setLoading(false)); 
  }, []);

  const handleCreate = async () => {
    if (!newName || !newType) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cards/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, type: newType }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateOpen(false);
        setNewName('');
        // navigate to designer
        router.push(`/${locale}/dashboard/cards/templates/${data.data.template.id}/edit`);
      } else {
        alert(data.message || t('errorCreateTemplate'));
      }
    } finally {
      setCreating(false);
    }
  };

  const filtered = templates.filter(tItem => tItem.name.toLowerCase().includes(search.toLowerCase()));

  const studentCount = templates.filter(tItem => tItem.type === 'student_id').length;
  const admitCount = templates.filter(tItem => tItem.type === 'admit_card').length;
  const publishedCount = templates.filter(tItem => tItem.status === 'published').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <IdCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('templatesTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t('templatesSubtitle')}</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer"
        >
          <Plus className="w-4 h-4" /><span>{t('newTemplate')}</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiTotalTemplates')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{templates.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </Card>
        
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiStudentCards')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{studentCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiAdmitCards')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{admitCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiPublishedTemplates')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{publishedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Main content card */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchTemplatePlaceholder')} 
              className="ps-9 h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-start text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 ps-4 text-start">{t('thTemplateName')}</th>
                <th className="p-3 text-start">{t('thType')}</th>
                <th className="p-3 text-start">{t('thStatus')}</th>
                <th className="p-3 text-start">{t('thDefault')}</th>
                <th className="p-3 text-start">{t('thCreatedAt')}</th>
                <th className="p-3 text-end pe-4">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">{t('loadingTemplates')}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">{t('noTemplatesFound')}</td>
                </tr>
              ) : (
                filtered.map(tItem => (
                  <tr key={tItem.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 ps-4 font-semibold text-slate-700">{tItem.name}</td>
                    <td className="p-3 text-slate-600">{TYPE_LABELS[tItem.type] || tItem.type}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[tItem.status]?.variant || 'neutral'}>
                        {STATUS_BADGE[tItem.status]?.label || tItem.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {tItem.isDefault && <Badge variant="info">{t('badgeDefault')}</Badge>}
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(tItem.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'en' ? 'en-US' : 'fr-FR')}
                    </td>
                    <td className="p-3 pe-4 text-end">
                      <Button 
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                        onClick={() => router.push(`/${locale}/dashboard/cards/templates/${tItem.id}/edit`)}
                      >
                        <PenTool className="w-3.5 h-3.5 me-1.5" />
                        {t('btnEdit')}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('dialogNewTemplate')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold text-slate-700">{t('dialogTemplateName')}</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('dialogTemplateNamePlaceholder')}
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-xs font-bold text-slate-700">{t('dialogDocType')}</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t('dialogSelectType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student_id" className="text-xs">{t('typeStudentId')}</SelectItem>
                  <SelectItem value="employee_id" className="text-xs">{t('typeEmployeeId')}</SelectItem>
                  <SelectItem value="admit_card" className="text-xs">{t('typeAdmitCard')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">{t('btnCancel')}</Button>
            <Button 
              className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer" 
              onClick={handleCreate} 
              disabled={creating || !newName}
            >
              {creating ? t('btnCreating') : t('btnCreateTemplate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
