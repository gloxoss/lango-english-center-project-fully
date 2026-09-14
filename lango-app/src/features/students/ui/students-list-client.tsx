'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Avatar, AvatarFallback,
} from '@/components/ui/avatar';
import {
  Users, UserPlus, Download, Filter, Search,
  Wallet, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Pencil, Trash2, Eye, CreditCard, Sparkles, Shuffle, Scale,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { exportToCsv } from '@/libs/csv-export';
import { StudentItem } from '../data/students-list-config';

type ApiStudent = {
  id: string;
  matricule: string | null;
  fullName: string;
  level: string | null;
  className: string | null;
  guardianName: string | null;
  phone: string | null;
  status: string;
  paymentStatus: string | null;
};

function fromApiStudent(row: ApiStudent): StudentItem {
  return {
    id: row.id,
    name: row.fullName,
    matricule: row.matricule ?? '—',
    gradeLevel: row.level ?? '—',
    classSection: row.className ?? '',
    attendancePct: 0, // not available from the list endpoint - see financialStatus column instead
    status: row.status === 'Actif' || row.status === 'Inactif' || row.status === 'Suspendu' ? row.status : 'Actif',
    financialStatus: row.paymentStatus === 'En retard' || row.paymentStatus === 'Partiel' ? row.paymentStatus : 'À jour',
    gpa: '—',
    dob: '—',
    address: '—',
    guardianName: row.guardianName ?? '—',
    guardianPhone: row.phone ?? '—',
    guardianRelation: '—',
    tuitionTotal: '—',
    tuitionPaid: '—',
    tuitionBalance: '—',
    tuitionStatus: '—',
    absencesUnexcused: 0,
    latesTotal: 0,
    recentDocuments: [],
  };
}

type Student = {
  id: string;
  fullName?: string;
  level?: string;
  className?: string;
  guardianName?: string;
  phone?: string;
  status?: string;
  paymentStatus?: string;
};

function toStudent(st: StudentItem): Student {
  return {
    id: st.id,
    fullName: st.name,
    level: st.gradeLevel,
    className: st.classSection,
    guardianName: st.guardianName,
    phone: st.guardianPhone,
    status: st.status,
    paymentStatus: st.financialStatus,
  };
}

const DEFAULT_PAGE_SIZE = 10;

export function StudentsListClient({ locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');
  const { can } = usePermissions();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ total: number; active: number; unassigned: number; overdue: number }>({
    total: 0,
    active: 0,
    unassigned: 0,
    overdue: 0,
  });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [formStudent, setFormStudent] = useState<Partial<Student>>({
    fullName: '', level: '2nde A', className: '2BAC-A', guardianName: '', phone: '', status: 'Actif', paymentStatus: 'À jour',
  });

  // Auto-Placement Wizard State
  const [showAutoPlacementModal, setShowAutoPlacementModal] = useState(false);
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string }>>([]);
  const [sectionsList, setSectionsList] = useState<Array<{ id: string; classId: string; className: string; sectionName: string }>>([]);
  const [placementClassId, setPlacementClassId] = useState<string>('all');
  const [placementMethod, setPlacementMethod] = useState<'balanced_headcount' | 'random' | 'gender_parity' | 'academic_balance'>('balanced_headcount');
  const [simulatedAssignments, setSimulatedAssignments] = useState<Array<{
    studentId: string;
    studentName: string;
    matricule: string | null;
    gender: string | null;
    targetClassSectionId: string;
    targetClassName: string;
    targetSectionName: string;
    score?: number | null;
  }>>([]);
  const [simulationBreakdown, setSimulationBreakdown] = useState<Record<string, { className: string; sectionName: string; count: number }>>({});
  const [simulating, setSimulating] = useState(false);
  const [applyingPlacement, setApplyingPlacement] = useState(false);

  const loadClassesAndSections = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/academics/classes?pageSize=100').then(r => r.json()),
        fetch('/api/academics/class-sections?pageSize=200').then(r => r.json()),
      ]);
      if (cRes.success && Array.isArray(cRes.data)) {
        setClassesList(cRes.data.map((c: any) => ({ id: c.id, name: c.name })));
      }
      if (sRes.success && Array.isArray(sRes.data)) {
        setSectionsList(sRes.data.map((s: any) => ({
          id: s.id,
          classId: s.classId,
          className: s.className,
          sectionName: s.sectionName,
        })));
      }
    } catch (err) {
      console.error('Failed to load classes and sections', err);
    }
  };

  const handleSimulatePlacement = async () => {
    setSimulating(true);
    try {
      const payload: any = {
        method: placementMethod,
        dryRun: true,
      };
      if (placementClassId !== 'all') {
        payload.classId = placementClassId;
      }
      const res = await fetch('/api/students/placements/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSimulatedAssignments(json.data.assignments || []);
        setSimulationBreakdown(json.data.breakdown || {});
        if (json.data.placedCount === 0) {
          toast.info('Aucun élève sans section à affecter.');
        } else {
          toast.success(`Simulation terminée : ${json.data.placedCount} élève(s) réparti(s).`);
        }
      } else {
        toast.error(json.error?.message || 'Échec de la simulation.');
      }
    } catch {
      toast.error('Erreur réseau lors de la simulation.');
    } finally {
      setSimulating(false);
    }
  };

  const handleApplyPlacement = async () => {
    setApplyingPlacement(true);
    try {
      const payload: any = {
        method: placementMethod,
        dryRun: false,
      };
      if (placementClassId !== 'all') {
        payload.classId = placementClassId;
      }
      const res = await fetch('/api/students/placements/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Affectations enregistrées avec succès !');
        setShowAutoPlacementModal(false);
        setSimulatedAssignments([]);
        setSimulationBreakdown({});
        fetchStudents();
      } else {
        toast.error(json.error?.message || 'Erreur lors de l\'enregistrement des affectations.');
      }
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setApplyingPlacement(false);
    }
  };

  const activeStudent = students.find(s => s.id === selectedId) ?? students[0];

  const filteredStudents = students.filter(s => {
    const matchesLevel = levelFilter === 'all' || s.gradeLevel.includes(levelFilter);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesLevel && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(DEFAULT_PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/students?${params}`);
      const json = await res.json();
      if (json.success) {
        const mapped = (json.data as ApiStudent[]).map(fromApiStudent);
        setStudents(mapped);
        setTotal(json.total ?? mapped.length);
        if (json.stats) {
          setStats(json.stats);
        } else {
          setStats({
            total: json.total ?? mapped.length,
            active: json.total ?? mapped.length,
            unassigned: 0,
            overdue: 0,
          });
        }
        setSelectedId(prev => (mapped.some(s => s.id === prev) ? prev : (mapped[0]?.id ?? '')));
      }
    } catch (e) {
      console.error('Failed to load students', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchStudents, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const handleCreateStudent = async () => {
    if (!formStudent.fullName) return;

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formStudent.fullName,
          guardianName: formStudent.guardianName || undefined,
          phone: formStudent.phone || undefined,
          status: formStudent.status || 'Actif',
          paymentStatus: formStudent.paymentStatus || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('API error creating student', json.message);
        return;
      }
      setIsAddOpen(false);
      setFormStudent({
        fullName: '',
        level: '2nde A',
        className: '2BAC-A',
        guardianName: '',
        phone: '',
        status: 'Actif',
        paymentStatus: 'À jour',
      });
      await fetchStudents();
    } catch (e) {
      console.error('API Error saving student', e);
    }
  };

  const handleEditStudent = async () => {
    if (!formStudent.id) return;
    setIsEditOpen(false);

    try {
      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formStudent.id,
          fullName: formStudent.fullName || undefined,
          guardianName: formStudent.guardianName || undefined,
          phone: formStudent.phone || undefined,
          status: formStudent.status || undefined,
          paymentStatus: formStudent.paymentStatus || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('API error updating student', json.message);
      }
      await fetchStudents();
    } catch (e) {
      console.error('API Error updating student', e);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    const id = studentToDelete.id;
    setIsDeleteOpen(false);
    setStudentToDelete(null);

    try {
      await fetch(`/api/students?id=${id}`, {
        method: 'DELETE',
      });
      await fetchStudents();
    } catch (e) {
      console.error('API Error deleting student', e);
    }
  };

  const openEditModal = (student: Student) => {
    setFormStudent(student);
    setIsEditOpen(true);
  };

  const openDeleteModal = (student: Student) => {
    setStudentToDelete(student);
    setIsDeleteOpen(true);
  };

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      {/* Left Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('directory')}</h1>
            <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(filteredStudents, 'eleves-repertoire')}
              className="gap-2 h-10 rounded-full px-4 text-xs font-bold border-slate-200"
            >
              <Download className="w-4 h-4" /> {tCommon('export')}
            </Button>
            {can('students.placements.manage') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadClassesAndSections();
                  setShowAutoPlacementModal(true);
                }}
                className="gap-2 h-10 rounded-full px-4 text-xs font-bold border-purple-200 text-purple-700 bg-purple-50/60 hover:bg-purple-100/80 shadow-2xs"
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                Affectation Automatique
              </Button>
            )}
            {can('students.create') && (
              <Button asChild size="sm" className="gap-2 h-10 rounded-full px-4 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white shadow-2xs">
                <Link href={`/${locale || 'fr'}/dashboard/students/add`}>
                  <UserPlus className="w-4 h-4" /> + {t('enrollStudent')}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Top KPIs Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('activeCount'), value: stats.active, sub: t('activeCountSub'), color: 'text-[#2487B8]', icon: Users, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
            { label: t('totalCount'), value: stats.total, sub: t('totalCountSub'), color: 'text-emerald-600', icon: CheckCircle2, iconBg: 'bg-[#D1F5E8]', iconColor: 'text-[#17A673]' },
            { label: t('unassignedCount'), value: stats.unassigned, sub: t('unassignedCountSub'), color: 'text-amber-600', icon: AlertTriangle, iconBg: 'bg-[#FCF0DC]', iconColor: 'text-[#E8A33D]' },
            { label: t('overdueCount'), value: stats.overdue, sub: t('overdueCountSub'), color: 'text-rose-600', icon: Wallet, iconBg: 'bg-[#FCE4E2]', iconColor: 'text-[#E5544B]' },
          ].map((kpi, i) => (
            <Card
              key={i}
              onClick={i === 2 && can('students.placements.manage') ? () => { loadClassesAndSections(); setShowAutoPlacementModal(true); } : undefined}
              className={`p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between ${i === 2 && can('students.placements.manage') ? 'cursor-pointer hover:border-amber-300 hover:shadow-xs transition-all' : ''}`}
            >
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{kpi.value}</p>
                <p className={`text-[11px] font-bold ${kpi.color}`}>{kpi.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-full ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </Card>
          ))}
        </div>

        {/* Filter and Search Toolbar */}
        <div className="bg-white p-3 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('searchPlaceholder')}
              className="ps-10 h-10 text-xs bg-slate-50 border-none rounded-full text-start"
            />
          </div>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-auto min-w-[130px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder={t('levelFilterPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('levelFilterPlaceholder')}</SelectItem>
              <SelectItem value="2nde">2nde</SelectItem>
              <SelectItem value="1ère">1ère</SelectItem>
              <SelectItem value="3ème">3ème</SelectItem>
              <SelectItem value="5ème">5ème Primaire</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[130px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder={t('statusFilterPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('statusFilterPlaceholder')}</SelectItem>
              <SelectItem value="Actif">{tStatus('active')}</SelectItem>
              <SelectItem value="En attente">{tStatus('pending')}</SelectItem>
              <SelectItem value="Inactif">{tStatus('inactive')}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearch(''); setLevelFilter('all'); setStatusFilter('all'); }}
            className="h-10 rounded-full px-4 gap-1.5 text-xs font-bold border-slate-200"
          >
            <Filter className="w-3.5 h-3.5" /> {tCommon('reset')}
          </Button>
        </div>

        {/* Dynamic Students Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <Table>
            <TableHeader className="bg-[#F6F9FC]">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('student')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('levelClass')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('legalGuardian')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('financialStatus')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{tCommon('status')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4 text-end">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((st) => (
                <TableRow
                  key={st.id}
                  onClick={() => setSelectedId(st.id)}
                  className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${st.id === selectedId ? 'bg-[#DCEBF4]/30' : ''}`}
                >
                  <TableCell className="text-xs text-slate-700 p-3.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-9 h-9 text-xs bg-[#DCEBF4] text-[#1B6C93] font-bold">
                        <AvatarFallback>{st.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-[#16212B]">{st.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{st.matricule}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 p-3.5">
                    <span className="font-medium">{st.gradeLevel}</span> • <span className="text-slate-500">{st.classSection}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 p-3.5">
                    <p className="font-medium">{st.guardianName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{st.guardianPhone}</p>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 p-3.5">
                    <span className={`font-bold ${st.financialStatus === 'À jour' ? 'text-[#17A673]' : 'text-[#E5544B]'}`}>{st.financialStatus}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 p-3.5">
                    <Badge className={st.status === 'Actif' ? 'bg-[#DDF5EC] text-[#17A673] border-none font-bold text-[10px]' : 'bg-[#FCF0DC] text-[#E8A33D] border-none font-bold text-[10px]'}>
                      {st.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 p-3.5">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg"
                        aria-label={`${t('viewFullProfile')} - ${st.name}`}
                        title={t('viewFullProfile')}
                      >
                        <Link href={`/${locale || 'fr'}/dashboard/students/${st.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg"
                        aria-label={`Carte scolaire - ${st.name}`}
                        title="Carte scolaire"
                      >
                        <Link href={`/${locale || 'fr'}/dashboard/cards/students`}>
                          <CreditCard className="w-4 h-4" />
                        </Link>
                      </Button>
                      {can('students.update') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(toStudent(st))}
                          className="h-8 w-8 p-0 text-blue-700 hover:bg-blue-50 rounded-lg"
                          aria-label={`Modifier ${st.name}`}
                          title={tCommon('edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {can('students.delete') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteModal(toStudent(st))}
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 rounded-lg"
                          aria-label={`Supprimer ${st.name}`}
                          title={tCommon('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Page {page} / {totalPages} · {total}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" /> {tCommon('previous')}
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              {tCommon('next')} <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Inspector Drawer */}
      {activeStudent && (
        <div className="w-[340px] shrink-0 space-y-4 hidden xl:block sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
          <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#16212B]">{t('studentProfile')}</h3>
              <Badge className="bg-[#DDF5EC] text-[#17A673] text-[9px] px-2 border-none">
                {activeStudent.status}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14 bg-[#DCEBF4] text-[#1B6C93]">
                <AvatarFallback className="text-base font-bold bg-[#DCEBF4] text-[#1B6C93]">
                  {activeStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-extrabold text-[#16212B] text-sm">{activeStudent.name}</p>
                <p className="text-[11px] text-slate-500">{activeStudent.gradeLevel} • {activeStudent.classSection}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{activeStudent.matricule}</p>
              </div>
            </div>

            <Link
              href={`/${locale || 'fr'}/dashboard/students/${activeStudent.id}`}
              className="flex items-center justify-center gap-1.5 h-9 rounded-full bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold transition-colors"
            >
              {t('viewFullProfile')}
            </Link>

            <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('legalGuardian')}</span>
                <span className="font-bold text-[#16212B]">{activeStudent.guardianName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('phone')}</span>
                <span className="font-mono text-[#16212B] font-bold">{activeStudent.guardianPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('financialStatus')}</span>
                <span className="font-bold text-[#1B6C93]">{activeStudent.financialStatus}</span>
              </div>
            </div>

            {(can('students.update') || can('students.delete')) && (
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                {can('students.update') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal({ id: activeStudent.id, fullName: activeStudent.name, level: activeStudent.gradeLevel, className: activeStudent.classSection, guardianName: activeStudent.guardianName, phone: activeStudent.guardianPhone, status: activeStudent.status, paymentStatus: activeStudent.financialStatus })}
                    className="flex-1 text-xs font-bold h-9 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {tCommon('edit')}
                  </Button>
                )}
                {can('students.delete') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteModal({ id: activeStudent.id, fullName: activeStudent.name, level: activeStudent.gradeLevel, className: activeStudent.classSection, guardianName: activeStudent.guardianName, phone: activeStudent.guardianPhone, status: activeStudent.status, paymentStatus: activeStudent.financialStatus })}
                    className="flex-1 text-xs font-bold h-9 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    {tCommon('delete')}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* CREATE STUDENT DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">{t('addStudent')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('fullName')} *</label>
              <Input
                value={formStudent.fullName || ''}
                onChange={e => setFormStudent({ ...formStudent, fullName: e.target.value })}
                placeholder="Ex. Youssef Benjelloun"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('level')} *</label>
                <Input
                  value={formStudent.level || ''}
                  onChange={e => setFormStudent({ ...formStudent, level: e.target.value })}
                  placeholder="Ex. 2nde A"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('classSection')} *</label>
                <Input
                  value={formStudent.className || ''}
                  onChange={e => setFormStudent({ ...formStudent, className: e.target.value })}
                  placeholder="Ex. 2BAC-A"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('legalGuardian')} *</label>
              <Input
                value={formStudent.guardianName || ''}
                onChange={e => setFormStudent({ ...formStudent, guardianName: e.target.value })}
                placeholder="Ex. M. Karim Benjelloun"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('phone')} *</label>
              <Input
                value={formStudent.phone || ''}
                onChange={e => setFormStudent({ ...formStudent, phone: e.target.value })}
                placeholder="Ex. +212 6 12-345678"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{tCommon('status')}</label>
                <Select
                  value={formStudent.status || 'Actif'}
                  onValueChange={v => setFormStudent({ ...formStudent, status: v as Student['status'] })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Actif">{tStatus('active')}</SelectItem>
                    <SelectItem value="En attente">{tStatus('pending')}</SelectItem>
                    <SelectItem value="Inactif">{tStatus('inactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('financialStatus')}</label>
                <Select
                  value={formStudent.paymentStatus || 'À jour'}
                  onValueChange={v => setFormStudent({ ...formStudent, paymentStatus: v as Student['paymentStatus'] })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À jour">{t('statusUpToDate')}</SelectItem>
                    <SelectItem value="En retard">{t('statusOverdue')}</SelectItem>
                    <SelectItem value="Impayé">{t('statusUnpaid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">{tCommon('cancel')}</Button>
            <Button onClick={handleCreateStudent} className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">{tCommon('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT STUDENT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">{t('editStudent')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('fullName')}</label>
              <Input
                value={formStudent.fullName || ''}
                onChange={e => setFormStudent({ ...formStudent, fullName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('level')}</label>
                <Input
                  value={formStudent.level || ''}
                  onChange={e => setFormStudent({ ...formStudent, level: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('classSection')}</label>
                <Input
                  value={formStudent.className || ''}
                  onChange={e => setFormStudent({ ...formStudent, className: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('legalGuardian')}</label>
              <Input
                value={formStudent.guardianName || ''}
                onChange={e => setFormStudent({ ...formStudent, guardianName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('phone')}</label>
              <Input
                value={formStudent.phone || ''}
                onChange={e => setFormStudent({ ...formStudent, phone: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full text-xs h-9">{tCommon('cancel')}</Button>
            <Button onClick={handleEditStudent} className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">{tCommon('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">{t('deleteConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 my-2">
            {t('deleteConfirmMessage')}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-full text-xs h-9">{tCommon('cancel')}</Button>
            <Button onClick={handleDeleteStudent} className="rounded-full text-xs h-9 bg-rose-600 text-white hover:bg-rose-700 border-none">{tCommon('delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AUTO-PLACEMENT WIZARD MODAL */}
      <Dialog open={showAutoPlacementModal} onOpenChange={setShowAutoPlacementModal}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Affectation Automatique &amp; Équilibrée</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            <p className="text-slate-500">
              Répartissez rapidement les élèves sans section assignée ({stats.unassigned} élève(s) en attente) selon la stratégie de votre établissement.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Niveau / Classe Cible</label>
                <select
                  value={placementClassId}
                  onChange={(e) => setPlacementClassId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                >
                  <option value="all">Toutes les classes</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Méthode de Répartition</label>
                <select
                  value={placementMethod}
                  onChange={(e) => setPlacementMethod(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                >
                  <option value="balanced_headcount">Équilibrage des effectifs (Recommandé)</option>
                  <option value="random">Aléatoire simple</option>
                  <option value="gender_parity">Parité des genres (Filles / Garçons)</option>
                  <option value="academic_balance">Parité académique (Notes / Moyennes)</option>
                </select>
              </div>
            </div>

            {/* Simulation Trigger & Results */}
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSimulatePlacement}
                disabled={simulating}
                className="h-9 px-3 rounded-xl text-xs font-bold border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5"
              >
                <Shuffle className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                {simulating ? 'Calcul de répartition...' : 'Lancer la Simulation (Aperçu)'}
              </Button>

              {simulatedAssignments.length > 0 && (
                <span className="text-xs font-bold text-emerald-600">
                  ✓ {simulatedAssignments.length} élève(s) simulé(s)
                </span>
              )}
            </div>

            {/* Breakdown Badges */}
            {Object.keys(simulationBreakdown).length > 0 && (
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 space-y-2">
                <p className="font-bold text-[11px] text-purple-900 uppercase tracking-wide">
                  Répartition par Section :
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(simulationBreakdown).map(([secId, b]) => (
                    <Badge key={secId} variant="neutral" className="bg-white border-purple-200 text-purple-900 text-xs font-bold py-1 px-2.5">
                      {b.className} ({b.sectionName}) : <span className="text-[#2487B8] ms-1">{b.count} élèves</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Simulated Students Table / Review */}
            {simulatedAssignments.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-[11px] font-bold h-8">Matricule</TableHead>
                      <TableHead className="text-[11px] font-bold h-8">Nom de l&apos;Élève</TableHead>
                      <TableHead className="text-[11px] font-bold h-8">Genre</TableHead>
                      <TableHead className="text-[11px] font-bold h-8">Section Affectée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulatedAssignments.map((a, idx) => (
                      <TableRow key={a.studentId} className="border-slate-100">
                        <TableCell className="text-xs font-mono py-1.5">{a.matricule || '—'}</TableCell>
                        <TableCell className="text-xs font-bold text-[#16212B] py-1.5">{a.studentName}</TableCell>
                        <TableCell className="text-xs capitalize py-1.5">{a.gender === 'male' ? 'Garçon' : a.gender === 'female' ? 'Fille' : '—'}</TableCell>
                        <TableCell className="py-1.5">
                          <select
                            value={a.targetClassSectionId}
                            onChange={(e) => {
                              const newSecId = e.target.value;
                              const sec = sectionsList.find(s => s.id === newSecId);
                              setSimulatedAssignments(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                targetClassSectionId: newSecId,
                                targetClassName: sec?.className || item.targetClassName,
                                targetSectionName: sec?.sectionName || item.targetSectionName,
                              } : item));
                            }}
                            className="h-7 px-2 rounded-lg border border-slate-200 text-xs bg-white font-semibold text-[#16212B]"
                          >
                            {sectionsList.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.className} - {s.sectionName}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAutoPlacementModal(false);
                setSimulatedAssignments([]);
                setSimulationBreakdown({});
              }}
              className="rounded-full text-xs h-9"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleApplyPlacement}
              disabled={applyingPlacement || (simulatedAssignments.length === 0 && stats.unassigned === 0)}
              className="rounded-full text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {applyingPlacement ? 'Enregistrement...' : 'Valider les Affectations'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
