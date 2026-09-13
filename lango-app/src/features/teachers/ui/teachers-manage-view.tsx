'use client';

import Link from 'next/link';
import type { Teacher } from '../model/types';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CalendarCheck,
  Clock,
  Download,
  Edit2,
  Eye,
  FileText,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

type TeacherForm = {
  fullName: string;
  email: string;
  phone: string;
  employeeId: string;
  specialization: string;
  hireDate: string;
  dateOfBirth: string;
  gender: string;
  nationalId: string;
  address: string;
  city: string;
  qualification: string;
  salary: string;
  contract: boolean;
  cin: boolean;
  diploma: boolean;
};

const emptyTeacherForm: TeacherForm = {
  fullName: '',
  email: '',
  phone: '',
  employeeId: '',
  specialization: '',
  hireDate: '',
  dateOfBirth: '',
  gender: '',
  nationalId: '',
  address: '',
  city: '',
  qualification: '',
  salary: '',
  contract: false,
  cin: false,
  diploma: false,
};

type FilterTabKey = 'all' | 'active' | 'incomplete';

export function TeachersManageView({ locale }: { locale: string }) {
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');
  const tStudents = useTranslations('Students');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTabKey>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherForm>(emptyTeacherForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/teachers?pageSize=200');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTeachers(json.data);
          if (json.data.length > 0) {
            setSelectedTeacherId(prev => prev ?? json.data[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load teachers data', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openCreateDialog = () => {
    setEditingTeacher(null);
    setForm(emptyTeacherForm);
    setDialogOpen(true);
  };

  const openEditDialog = (teacherItem: Teacher) => {
    setEditingTeacher(teacherItem);
    setForm({
      fullName: teacherItem.name,
      email: teacherItem.email,
      phone: teacherItem.phone,
      employeeId: teacherItem.employeeId,
      specialization: teacherItem.specialization,
      hireDate: teacherItem.hireDate ?? '',
      dateOfBirth: teacherItem.dateOfBirth ?? '',
      gender: teacherItem.gender ?? '',
      nationalId: teacherItem.nationalId ?? '',
      address: teacherItem.address ?? '',
      city: teacherItem.city ?? '',
      qualification: teacherItem.qualification ?? '',
      salary: teacherItem.salary != null ? String(teacherItem.salary) : '',
      contract: teacherItem.documents?.contract ?? false,
      cin: teacherItem.documents?.cin ?? false,
      diploma: teacherItem.documents?.diploma ?? false,
    });
    setDialogOpen(true);
  };

  const buildPayload = () => ({
    fullName: form.fullName,
    phone: form.phone,
    specialization: form.specialization,
    hireDate: form.hireDate || undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    nationalId: form.nationalId || undefined,
    address: form.address || undefined,
    city: form.city || undefined,
    qualification: form.qualification || undefined,
    salary: form.salary ? Number(form.salary) : null,
    documents: { contract: form.contract, cin: form.cin, diploma: form.diploma },
  });

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingTeacher) {
        await fetch('/api/teachers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTeacher.id, ...buildPayload() }),
        });
      } else {
        await fetch('/api/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, employeeId: form.employeeId, ...buildPayload() }),
        });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save teacher', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/teachers?id=${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      console.error('Failed to delete teacher', err);
    }
  };

  const filteredTeachers = teachers.filter((teacherItem) => {
    if (filterTab === 'active' && teacherItem.status !== 'Actif' && teacherItem.status !== 'active') {
      return false;
    }
    if (filterTab === 'incomplete' && teacherItem.status !== 'Incomplet') {
      return false;
    }
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }
    return (
      (teacherItem.name ?? '').toLowerCase().includes(term) ||
      (teacherItem.employeeId ?? '').toLowerCase().includes(term) ||
      (teacherItem.specialization ?? '').toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: Teacher['status']) => {
    switch (status) {
      case 'Actif':
      case 'active':
        return (
          <Badge className="border-none bg-[#D1F5E8] px-2 py-0.5 text-[10px] text-[#17A673]">
            {tStatus('active')}
          </Badge>
        );
      case 'Incomplet':
        return (
          <Badge className="border-none bg-[#FCF0DC] px-2 py-0.5 text-[10px] text-[#E8A33D]">
            {t('statusIncomplete')}
          </Badge>
        );
      case 'Congé':
      case 'leave':
        return (
          <Badge className="border-none bg-[#DCEBF4] px-2 py-0.5 text-[10px] text-[#1B6C93]">
            {t('statusOnLeave')}
          </Badge>
        );
      default:
        return (
          <Badge className="border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {status === 'inactive' ? tStatus('inactive') : (status || t('statusInactive'))}
          </Badge>
        );
    }
  };

  const columns: Column<Teacher>[] = [
    {
      key: 'name',
      header: t('title'),
      cell: (tc) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-slate-200 text-xs font-bold text-slate-700">
              {tc.name.split(' ').map((n) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-[#16212B]">{tc.name}</p>
            <p className="text-[10px] font-normal text-slate-400">{tc.specialization || t('teachingStaffFallback')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'employeeId',
      header: tStudents('matricule'),
      cell: (tc) => <span className="font-mono text-[11px] text-slate-600">{tc.employeeId}</span>,
    },
    {
      key: 'specialization',
      header: t('specialty'),
      cell: (tc) => <span className="font-semibold text-slate-700">{tc.specialization}</span>,
    },
    {
      key: 'subjects',
      header: t('subjects'),
      cell: (tc) => (
        <div className="flex flex-wrap gap-1">
          {tc.subjects?.map((s) => (
            <Badge
              key={s}
              className="border-none bg-slate-100 px-1.5 py-0 text-[9px] font-normal text-slate-700"
            >
              {s}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'assignedClasses',
      header: t('assignedClasses'),
      cell: (tc) => <span className="text-[11px] text-slate-600">{tc.assignedClasses.join(', ')}</span>,
    },
    {
      key: 'workloadHours',
      header: t('workload'),
      cell: (tc) => <span className="font-bold text-[#16212B]">{tc.workloadHours}h</span>,
    },
    {
      key: 'contact',
      header: t('contact'),
      cell: (tc) => (
        <div className="text-[10px] text-slate-500">
          <p>{tc.phone}</p>
          <p className="text-slate-400">{tc.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: tCommon('status'),
      cell: (tc) => getStatusBadge(tc.status),
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      headerClassName: 'text-center',
      cell: (tc) => (
        <div className="flex items-center justify-center gap-1">
          <Link
            href={`/${locale}/dashboard/teachers/${tc.id}`}
            title={t('viewProfile')}
            className="inline-flex rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <Eye className="size-4" />
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEditDialog(tc); }}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <Edit2 className="size-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={e => e.stopPropagation()}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDelete(tc.id)} className="text-rose-600 focus:text-rose-600">
                <Trash2 className="me-2 size-3.5" />
                {tCommon('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: 'text-center',
    },
  ];

  const sel = teachers.find(item => item.id === selectedTeacherId) || (filteredTeachers.length > 0 ? filteredTeachers[0] : null);

  const docsComplete = teachers.filter(item => item.documents?.contract && item.documents?.cin && item.documents?.diploma).length;
  const docsMissing = teachers.filter(item => !item.documents?.contract && !item.documents?.cin && !item.documents?.diploma).length;
  const docsIncomplete = teachers.length - docsComplete - docsMissing;
  const docsTotal = teachers.length || 1;
  const pctComplete = (docsComplete / docsTotal) * 100;
  const pctIncomplete = (docsIncomplete / docsTotal) * 100;
  const pctMissing = (docsMissing / docsTotal) * 100;

  const tabs: { key: FilterTabKey; label: string }[] = [
    { key: 'all', label: t('tabAll') },
    { key: 'active', label: t('tabActive') },
    { key: 'incomplete', label: t('tabIncomplete') },
  ];

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('manage')}</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: t('activeTeachers'),
              value: teachers.filter(item => item.status === 'Actif' || item.status === 'active').length,
              sub: t('ofTotalTeachers', { count: teachers.length }),
              color: 'text-emerald-600',
              icon: Users,
              iconBg: 'bg-[#DCEBF4]',
              iconColor: 'text-[#1B6C93]',
            },
            {
              label: t('averageWorkload'),
              value: teachers.length > 0 ? t('hoursPerWeek', { hours: Math.round(teachers.reduce((sum, item) => sum + item.workloadHours, 0) / teachers.length) }) : '—',
              sub: t('allAssignments'),
              color: 'text-blue-600',
              icon: Clock,
              iconBg: 'bg-[#DCEBF4]',
              iconColor: 'text-[#1B6C93]',
            },
            {
              label: t('incompleteProfiles'),
              value: teachers.filter(item => item.status === 'Incomplet').length,
              sub: t('toComplete'),
              color: 'text-amber-600',
              icon: AlertCircle,
              iconBg: 'bg-[#FCF0DC]',
              iconColor: 'text-[#E8A33D]',
            },
            {
              label: t('onLeave'),
              value: teachers.filter(item => item.status === 'Congé' || item.status === 'leave').length,
              sub: t('currently'),
              color: 'text-rose-600',
              icon: Calendar,
              iconBg: 'bg-[#FCE4E2]',
              iconColor: 'text-[#E5544B]',
            },
          ].map((kpi, i) => (
            <Card
              key={i}
              className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{kpi.value}</p>
                <p className={`text-[11px] font-bold ${kpi.color}`}>
                  {kpi.sub}
                </p>
              </div>
              <div className={`size-10 rounded-full ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center`}>
                <kpi.icon className="size-5" />
              </div>
            </Card>
          ))}
        </div>

        {/* Directory Card */}
        <Card className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-[#16212B]">{t('manage')}</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCsv(filteredTeachers, 'enseignants')}
                className="h-9 gap-1.5 rounded-full border-slate-200 px-3 text-xs font-bold"
              >
                <Download className="size-3.5" />
                {' '}
                {tCommon('export')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateDialog}
                className="h-9 gap-1.5 rounded-full bg-[#0066FF] px-4 text-xs font-bold hover:bg-[#0052CC]"
              >
                <Plus className="size-3.5" />
                {' '}
                {t('addTeacher')}
              </Button>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-9 rounded-full border-slate-200 bg-slate-50 ps-10 text-start text-xs"
              />
            </div>

            <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                    filterTab === tab.key
                      ? 'bg-white text-[#16212B] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic DataTable Component */}
          <DataTable
            data={filteredTeachers}
            columns={columns}
            isLoading={isLoading}
            emptyTitle={t('noTeachersFound')}
            emptyDescription={t('noTeachersFoundDesc')}
            defaultPageSize={10}
            selectedRowId={selectedTeacherId}
            onRowClick={(row) => setSelectedTeacherId(row.id)}
          />
        </Card>

        {/* Documents & Compliance */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h3 className="mb-1 text-sm font-extrabold text-[#16212B]">{t('complianceDocs')}</h3>
          <p className="mb-4 text-[10px] text-slate-400">{t('complianceDocsStatus')}</p>

          <div className="flex items-center justify-around gap-4">
            <div className="relative flex size-32 items-center justify-center">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#17A673" strokeWidth="4" strokeDasharray={`${pctComplete} ${100 - pctComplete}`} strokeDashoffset="0" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E8A33D" strokeWidth="4" strokeDasharray={`${pctIncomplete} ${100 - pctIncomplete}`} strokeDashoffset={-pctComplete} />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E5544B" strokeWidth="4" strokeDasharray={`${pctMissing} ${100 - pctMissing}`} strokeDashoffset={-(pctComplete + pctIncomplete)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-[#16212B]">{teachers.length}</span>
                <span className="text-[9px] text-slate-400">{t('teachersCountLabel')}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#17A673]" />
                <span className="text-slate-600">{t('docsStatusComplete')}</span>
                <span className="ms-auto font-bold text-[#16212B]">{docsComplete}</span>
                <span className="text-[10px] text-slate-400">{pctComplete.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#E8A33D]" />
                <span className="text-slate-600">{t('docsStatusIncomplete')}</span>
                <span className="ms-auto font-bold text-[#16212B]">{docsIncomplete}</span>
                <span className="text-[10px] text-slate-400">{pctIncomplete.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#E5544B]" />
                <span className="text-slate-600">{t('docsStatusMissing')}</span>
                <span className="ms-auto font-bold text-[#16212B]">{docsMissing}</span>
                <span className="text-[10px] text-slate-400">{pctMissing.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Inspector Drawer */}
      {sel && (
        <div className="hidden w-[320px] shrink-0 space-y-4 xl:block">
          <Card className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                <AvatarFallback className="bg-slate-200 text-base font-bold text-slate-700">
                  {sel.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-extrabold text-[#16212B]">{sel.name}</p>
                  {getStatusBadge(sel.status)}
                </div>
                <p className="text-[11px] text-slate-500">{sel.specialization}</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{sel.phone}</p>
                <p className="font-mono text-[10px] text-slate-400">{sel.email}</p>
                <p className="font-mono text-[9px] text-slate-400">
                  {tStudents('matricule')} : {sel.employeeId}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t pt-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <BookOpen className="size-3.5 shrink-0 text-blue-500" />
                <span>
                  {t('subjects')} : <strong className="text-[#16212B]">{sel.subjects?.join(', ') || '—'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="size-3.5 shrink-0 text-emerald-500" />
                <span>
                  {t('classes')} : <strong className="text-[#16212B]">{sel.assignedClasses.join(', ')}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-purple-500" />
                <span>
                  {t('workload')} : <strong className="text-[#16212B]">{t('hoursPerWeek', { hours: sel.workloadHours })}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <CalendarCheck className="size-3.5 shrink-0 text-amber-500" />
                <span>
                  {t('hireDate')} : <strong className="text-[#16212B]">{sel.hireDate || t('notSpecified')}</strong>
                </span>
              </div>
            </div>

            <div className="flex gap-1.5 border-t pt-3">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 flex-1 rounded-full text-[10px]"
              >
                <Link href={`/${locale}/dashboard/teachers/${sel.id}`}>{t('viewProfile')}</Link>
              </Button>
            </div>

            {/* Documents Check Section */}
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold text-[#16212B]">{t('complianceDocs')}</h4>
              {[
                { name: t('docContract'), valid: sel.documents?.contract ?? false },
                { name: t('docCin'), valid: sel.documents?.cin ?? false },
                { name: t('docDiploma'), valid: sel.documents?.diploma ?? false },
              ].map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-slate-400" />
                    <p className="text-[11px] font-bold text-[#16212B]">{doc.name}</p>
                  </div>
                  {doc.valid ? (
                    <Badge className="border-none bg-[#D1F5E8] px-1.5 py-0 text-[9px] text-[#17A673]">{t('docProvided')}</Badge>
                  ) : (
                    <Badge className="border-none bg-[#FCE4E2] px-1.5 py-0 text-[9px] text-[#E5544B]">{t('docMissing')}</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">
              {editingTeacher ? t('editTeacher') : t('createTeacher')}
            </DialogTitle>
          </DialogHeader>
          <div className="my-2 grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2">
              <label className="mb-1 block font-bold text-slate-700">{t('fullNameRequired')}</label>
              <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            {!editingTeacher && (
              <>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">{t('email')}</label>
                  <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9 rounded-xl text-xs" />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">{tStudents('matricule')}</label>
                  <Input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="h-9 rounded-xl text-xs" />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('phone')}</label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('specialty')}</label>
              <Input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('hireDate')}</label>
              <Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('dateOfBirth')}</label>
              <Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('gender')}</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs">
                <option value="">—</option>
                <option value="female">{t('genderFemale')}</option>
                <option value="male">{t('genderMale')}</option>
                <option value="other">{t('genderOther')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('cin')}</label>
              <Input value={form.nationalId} onChange={e => setForm({ ...form, nationalId: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('city')}</label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('qualification')}</label>
              <Input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('salaryMad')}</label>
              <Input type="number" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block font-bold text-slate-700">{t('address')}</label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="mb-2 font-bold text-slate-700">{t('providedDocs')}</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['contract', t('docContract')],
                  ['cin', t('docCin')],
                  ['diploma', t('docDiploma')],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => setForm({ ...form, [key]: e.target.checked })}
                      className="size-3.5 accent-[#0066FF]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9 rounded-full text-xs">{tCommon('cancel')}</Button>
            <Button variant="primary" disabled={isSubmitting} onClick={handleSubmit} className="h-9 rounded-full bg-[#0066FF] text-xs text-white">
              {editingTeacher ? tCommon('save') : t('createTeacher')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
