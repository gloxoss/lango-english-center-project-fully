'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Users, UserPlus, Download, Filter, Search,
  Wallet, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Pencil, Trash2, Eye, CreditCard, Sparkles, Shuffle, MoreVertical,
  Archive, FileCheck, CheckSquare, Square, RefreshCw, X, ShieldAlert,
  Building2, Calendar, ArrowRight, ChevronDown, ChevronUp, Info,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Avatar, AvatarFallback,
} from '@/components/ui/avatar';
import { usePermissions } from '@/hooks/use-permissions';

export type ApiStudent = {
  id: string;
  matricule: string | null;
  codeMassar?: string | null;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  classSectionId?: string | null;
  level: string | null;
  className: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  phone: string | null;
  guardianVerified?: boolean;
  isLegacyFallback?: boolean;
  guardianRelation?: string | null;
  status: string;
  paymentStatus: string | null;
  outstandingAmount?: number;
  overdueAmount?: number;
  overdueCount?: number;
  branchId?: string | null;
  createdAt?: string;
};

export type StudentItem = {
  id: string;
  name: string;
  matricule: string;
  codeMassar: string;
  gradeLevel: string;
  classSection: string;
  classSectionId?: string | null;
  status: 'Actif' | 'Inactif' | 'Archivé' | 'Suspendu';
  financialStatus: 'À jour' | 'Partiel' | 'En retard';
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  guardianName: string;
  guardianPhone: string;
  guardianVerified: boolean;
  isLegacyFallback: boolean;
  guardianRelation?: string | null;
  phone: string;
};

function fromApiStudent(row: ApiStudent): StudentItem {
  return {
    id: row.id,
    name: row.fullName,
    matricule: row.matricule ?? '—',
    codeMassar: row.codeMassar ?? '—',
    gradeLevel: row.level ?? '—',
    classSection: row.className ?? 'Sans section',
    classSectionId: row.classSectionId ?? null,
    status: row.status === 'Inactif' ? 'Inactif' : row.status === 'Archivé' ? 'Archivé' : 'Actif',
    financialStatus: row.paymentStatus === 'En retard' ? 'En retard' : row.paymentStatus === 'Partiel' ? 'Partiel' : 'À jour',
    outstandingAmount: row.outstandingAmount ?? 0,
    overdueAmount: row.overdueAmount ?? 0,
    overdueCount: row.overdueCount ?? 0,
    guardianName: row.guardianName ?? '—',
    guardianPhone: row.guardianPhone ?? '—',
    guardianVerified: row.guardianVerified ?? false,
    isLegacyFallback: row.isLegacyFallback ?? false,
    guardianRelation: row.guardianRelation ?? null,
    phone: row.phone ?? '—',
  };
}

const DEFAULT_PAGE_SIZE = 10;

export function StudentsListClient({ locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');
  const { can } = usePermissions();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [_isPending, startTransition] = useTransition();

  // URL-driven query states
  const urlSearch = searchParams.get('q') || searchParams.get('search') || '';
  const urlLevel = searchParams.get('level') || 'all';
  const urlStatus = searchParams.get('status') || 'all';
  const urlPage = Math.max(1, Number(searchParams.get('page') || '1'));

  const [search, setSearch] = useState(urlSearch);
  const [levelFilter, setLevelFilter] = useState(urlLevel);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [page, setPage] = useState(urlPage);

  // Data states
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [showMobileKpis, setShowMobileKpis] = useState(false);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    unassigned: number;
    newInscriptions: number;
    overdueStudentsCount: number;
    overdueFamiliesCount: number;
    totalOverdueMAD: number;
    overdue: number;
    activeAcademicYear?: string;
  }>({
    total: 0,
    active: 0,
    unassigned: 0,
    newInscriptions: 0,
    overdueStudentsCount: 0,
    overdueFamiliesCount: 0,
    totalOverdueMAD: 0,
    overdue: 0,
    activeAcademicYear: '',
  });

  // Metadata dropdowns
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string }>>([]);
  const [sectionsList, setSectionsList] = useState<Array<{ id: string; classId: string; className: string; sectionName: string; maxStudents?: number | null; enrolledCount?: number }>>([]);

  // Modals & Action States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formStudent, setFormStudent] = useState<Partial<ApiStudent>>({});
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [lifecycleStudent, setLifecycleStudent] = useState<StudentItem | null>(null);
  const [targetLifecycleStatus, setTargetLifecycleStatus] = useState<'active' | 'withdrawn' | 'transferred' | 'graduated' | 'archived'>('archived');
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentItem | null>(null);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);

  // Massar Export Preview Modal State
  const [showMassarPreview, setShowMassarPreview] = useState(false);
  const [massarLoading, setMassarLoading] = useState(false);
  const [massarReport, setMassarReport] = useState<{
    total: number;
    validCount: number;
    blockedCount: number;
    students: Array<{
      id: string;
      name: string;
      codeMassar: string | null;
      className: string | null;
      status: 'valid' | 'blocked';
      blockingReasons: string[];
    }>;
  } | null>(null);

  // Auto-Placement Wizard State
  const [showAutoPlacementModal, setShowAutoPlacementModal] = useState(false);
  const [placementMode, setPlacementMode] = useState<'unassigned' | 'rebalance'>('unassigned');
  const [placementClassId, setPlacementClassId] = useState<string>('all');
  const [placementMethod, setPlacementMethod] = useState<'balanced_headcount' | 'random' | 'gender_parity' | 'academic_balance'>('balanced_headcount');
  const [placementPreflight, setPlacementPreflight] = useState<{
    scope: { branchName: string; branchId: string | null; academicYearName: string; sessionYearId: string | null };
    eligibleSectionsCount: number;
    totalCapacity: number;
    availableCapacity: number;
    unassignedCount: number;
    totalAssignedCount: number;
    sectionsWithUnknownCapacity: string[];
    isSimulationBlocked: boolean;
  } | null>(null);

  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    scope: { branchName: string; academicYearName: string };
    evaluatedStudentsCount?: number;
    unchangedCount?: number;
    newAssignmentsCount?: number;
    placedCount: number;
    movedCount: number;
    unplacedCount: number;
    hasChanges?: boolean;
    totalCapacity: number;
    capacityExceeded: boolean;
    simulationValid: boolean;
    hasAcademicHistoryWarning: boolean;
    movedWithHistoryCount: number;
    breakdown: Record<string, {
      className: string;
      sectionName: string;
      beforeOccupancy: number;
      movement: number;
      afterOccupancy: number;
      maxStudents: number | null;
      isOverCapacity: boolean;
      availableSlots: number;
    }>;
    assignments: Array<{
      studentId: string;
      studentName: string;
      matricule: string | null;
      gender: string | null;
      previousClassSectionId: string | null;
      previousClassName: string | null;
      targetClassSectionId: string;
      targetClassName: string;
      targetSectionName: string;
      isMove: boolean;
      hasAcademicHistory: boolean;
    }>;
    unchangedStudents?: Array<{
      studentId: string;
      studentName: string;
      matricule: string | null;
      sectionId: string;
      className: string;
      sectionName: string;
    }>;
    unplacedStudents: Array<{
      studentId: string;
      studentName: string;
      matricule: string | null;
      reason: string;
    }>;
    integrityWarnings?: any[];
    /** Server-computed roster hash for the exact preview→commit flow (audit 2026-09-22 P1-3). */
    rosterFingerprint?: string;
  } | null>(null);

  const [showMovementDetails, setShowMovementDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [placementAuditNote, setPlacementAuditNote] = useState('');
  const [applyingPlacement, setApplyingPlacement] = useState(false);

  // Sync state to URL params cleanly
  const updateUrlParams = (newParams: { q?: string; level?: string; status?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newParams.q !== undefined) {
      if (newParams.q.trim()) params.set('q', newParams.q.trim());
      else params.delete('q');
      params.delete('search');
    }
    if (newParams.level !== undefined) {
      if (newParams.level !== 'all') params.set('level', newParams.level);
      else params.delete('level');
    }
    if (newParams.status !== undefined) {
      if (newParams.status !== 'all') params.set('status', newParams.status);
      else params.delete('status');
    }
    if (newParams.page !== undefined) {
      if (newParams.page > 1) params.set('page', String(newParams.page));
      else params.delete('page');
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const loadClassesAndSections = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/academics/classes?pageSize=200').then(r => r.json()),
        fetch('/api/academics/class-sections?pageSize=300').then(r => r.json()),
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
          maxStudents: s.maxStudents ?? null,
          enrolledCount: s.enrolledCount ?? 0,
        })));
      }
    } catch (err) {
      console.error('Failed to load academic options', err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(DEFAULT_PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/students?${params}`);
      const json = await res.json();
      if (json.success) {
        const mapped = (json.data as ApiStudent[]).map(fromApiStudent);
        setStudents(mapped);
        setTotal(json.total ?? mapped.length);
        if (json.stats) {
          setStats(json.stats);
        }
        // Keep selected student or select first on page
        setSelectedId(prev => (mapped.some(s => s.id === prev) ? prev : (mapped[0]?.id ?? '')));
      }
    } catch (e) {
      console.error('Failed to load student directory', e);
      toast.error('Erreur lors du chargement des élèves.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassesAndSections();
  }, []);

  // Debounce search and URL sync
  useEffect(() => {
    const t = setTimeout(() => {
      fetchStudents();
      updateUrlParams({ q: search, level: levelFilter, status: statusFilter, page });
    }, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, levelFilter, statusFilter]);

  const activeStudent = students.find(s => s.id === selectedId) ?? students[0];
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

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
          classSectionId: formStudent.classSectionId ?? null,
          guardianName: formStudent.guardianName || undefined,
          guardianPhone: formStudent.guardianPhone || undefined,
          phone: formStudent.phone || undefined,
          status: formStudent.status || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'Erreur lors de la modification de l\'élève');
      } else {
        toast.success('Informations élève mises à jour avec succès');
        fetchStudents();
      }
    } catch (e) {
      toast.error('Erreur réseau');
      console.error('API Error updating student', e);
    }
  };

  const handleApplyLifecycleTransition = async () => {
    if (!lifecycleStudent) return;
    setIsLifecycleOpen(false);

    try {
      const res = await fetch('/api/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lifecycleStudent.id,
          targetStatus: targetLifecycleStatus,
          reason: lifecycleReason || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Statut mis à jour avec succès');
        fetchStudents();
      } else {
        toast.error(json.error?.message || json.message || 'Échec de la transition de statut');
      }
    } catch {
      toast.error('Erreur réseau lors de la transition');
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    const id = studentToDelete.id;
    setIsDeleteOpen(false);
    setStudentToDelete(null);

    try {
      const res = await fetch(`/api/students?id=${id}&mode=hard`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Fiche élève traitée');
        fetchStudents();
      } else {
        toast.error(json.error?.message || json.message || 'Impossible de supprimer cet élève (enregistrements rattachés).');
      }
    } catch (e) {
      toast.error('Erreur réseau lors de la suppression');
      console.error('API Error deleting student', e);
    }
  };

  const handleOpenMassarPreview = async () => {
    setShowMassarPreview(true);
    setMassarLoading(true);
    try {
      const payload: any = {};
      if (levelFilter !== 'all') {
        const foundClass = classesList.find(c => c.name.toLowerCase().includes(levelFilter.toLowerCase()));
        if (foundClass) payload.classId = foundClass.id;
      }
      if (selectedRowIds.size > 0) {
        payload.studentIds = Array.from(selectedRowIds);
      }

      const res = await fetch('/api/academics/massar/export/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMassarReport(json.data);
      } else {
        toast.error('Impossible de charger la vérification Massar.');
      }
    } catch {
      toast.error('Erreur réseau Massar preview.');
    } finally {
      setMassarLoading(false);
    }
  };

  const fetchPlacementPreflight = async (classId: string) => {
    try {
      const params = new URLSearchParams();
      if (classId !== 'all') params.set('classId', classId);
      const res = await fetch(`/api/students/placements/auto?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPlacementPreflight(json.data);
      }
    } catch (err) {
      console.error('Failed to load placement preflight', err);
    }
  };

  useEffect(() => {
    if (showAutoPlacementModal) {
      fetchPlacementPreflight(placementClassId);
    }
  }, [showAutoPlacementModal, placementClassId]);

  const handleSimulatePlacement = async () => {
    if (placementPreflight?.isSimulationBlocked) {
      toast.error('La simulation est bloquée car certaines sections cibles ont une capacité non configurée.');
      return;
    }
    setSimulating(true);
    try {
      const payload: any = {
        method: placementMethod,
        dryRun: true,
        rebalanceAssigned: placementMode === 'rebalance',
      };
      if (placementClassId !== 'all') payload.classId = placementClassId;
      if (selectedRowIds.size > 0) payload.studentIds = Array.from(selectedRowIds);

      const res = await fetch('/api/students/placements/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSimulationResult(json.data);
        if (json.data.simulationValid) {
          toast.success(`Simulation validée : ${json.data.placedCount} élève(s) réparti(s) sans dépassement.`);
        } else if (json.data.capacityExceeded) {
          toast.warning(`Capacité maximale atteinte ou dépassée : ${json.data.unplacedCount} non affecté(s).`);
        } else if (json.data.placedCount === 0) {
          toast.info(json.message || 'Aucun élève à affecter.');
        }
      } else {
        toast.error(json.error?.message || json.message || 'Échec de la simulation.');
      }
    } catch {
      toast.error('Erreur réseau lors de la simulation.');
    } finally {
      setSimulating(false);
    }
  };

  const handleApplyPlacement = async () => {
    if (!simulationResult || !simulationResult.simulationValid) {
      toast.error('Une simulation préalable réussie est obligatoire avant toute validation.');
      return;
    }
    setApplyingPlacement(true);
    try {
      // Exact-commit mode (audit 2026-09-22 P1-3): the server applies exactly
      // the assignments from the preview the director approved and refuses
      // (409) if the roster changed in between.
      const payload: any = {
        method: placementMethod,
        dryRun: false,
        rebalanceAssigned: placementMode === 'rebalance',
        notes: placementAuditNote.trim() || undefined,
        assignments: (simulationResult.assignments ?? []).map(a => ({
          studentId: a.studentId,
          targetClassSectionId: a.targetClassSectionId,
        })),
        rosterFingerprint: simulationResult.rosterFingerprint,
      };
      if (placementClassId !== 'all') payload.classId = placementClassId;
      if (selectedRowIds.size > 0) payload.studentIds = Array.from(selectedRowIds);

      const res = await fetch('/api/students/placements/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Affectations enregistrées avec succès !');
        setShowConfirmModal(false);
        setShowAutoPlacementModal(false);
        setSimulationResult(null);
        setPlacementAuditNote('');
        fetchStudents();
      } else if (json.error?.code === 'ROSTER_CHANGED') {
        toast.error('La liste des élèves a changé depuis la simulation. Relancez la simulation puis validez à nouveau.');
        setSimulationResult(null);
      } else {
        toast.error(json.error?.message || json.message || 'Erreur lors de l\'enregistrement des affectations.');
      }
    } catch {
      toast.error('Erreur réseau lors de la validation.');
    } finally {
      setApplyingPlacement(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === students.length && students.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(students.map(s => s.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const eligibleSections = placementClassId === 'all'
    ? sectionsList
    : sectionsList.filter(s => s.classId === placementClassId);

  const unknownCapacitySectionNames = eligibleSections
    .filter(s => s.maxStudents == null)
    .map(s => `${s.className} (${s.sectionName})`);

  const configuredCapacity = eligibleSections.reduce((sum, s) => sum + (s.maxStudents ?? 0), 0);
  const enrolledInSections = eligibleSections.reduce((sum, s) => sum + (s.enrolledCount ?? 0), 0);
  const availableSlots = Math.max(0, configuredCapacity - enrolledInSections);
  const isSimulationBlocked = unknownCapacitySectionNames.length > 0;

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto pb-12">
      {/* Left Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('directory')}</h1>
            <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Action */}
            {can('students.create') && (
              <Button asChild size="sm" className="gap-2 h-10 rounded-full px-5 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white shadow-2xs">
                <Link href={`/${locale || 'fr'}/dashboard/students/add`}>
                  <UserPlus className="w-4 h-4" /> {t('enrollStudent')}
                </Link>
              </Button>
            )}

            {/* Secondary Actions Overflow Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-10 rounded-full px-4 text-xs font-bold border-slate-200 bg-white">
                  <span>Actions</span>
                  <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-xl p-1.5 bg-white border border-slate-200">
                <DropdownMenuItem asChild className="rounded-xl text-xs font-semibold py-2 cursor-pointer">
                  <Link href={`/${locale || 'fr'}/dashboard/students/import`} className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-slate-500" /> Importer des élèves (Excel)
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const exportUrl = `/api/students?export=csv${search ? `&search=${encodeURIComponent(search)}` : ''}${levelFilter !== 'all' ? `&level=${encodeURIComponent(levelFilter)}` : ''}${statusFilter !== 'all' ? `&status=${encodeURIComponent(statusFilter)}` : ''}`;
                    window.open(exportUrl, '_blank');
                  }}
                  className="rounded-xl text-xs font-semibold py-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-blue-600" /> Exporter la sélection (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleOpenMassarPreview}
                  className="rounded-xl text-xs font-semibold py-2 text-emerald-800 focus:bg-emerald-50 cursor-pointer"
                >
                  <FileCheck className="w-4 h-4 text-emerald-600" /> Vérifier &amp; Exporter Massar (.xlsx)
                </DropdownMenuItem>
                {can('students.placements.manage') && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      onClick={() => {
                        loadClassesAndSections();
                        setPlacementMode(stats.unassigned > 0 ? 'unassigned' : 'rebalance');
                        setShowAutoPlacementModal(true);
                      }}
                      className="rounded-xl text-xs font-semibold py-2 text-purple-800 focus:bg-purple-50 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-purple-600" /> Affectation Automatique
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Top KPIs Banner (Desktop: 4 Cards at Top) */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t('activeCount'),
              value: stats.active,
              sub: 'Total scolarisé actif',
              color: 'text-[#2487B8]',
              icon: Users,
              iconBg: 'bg-[#DCEBF4]',
              iconColor: 'text-[#1B6C93]',
            },
            {
              label: 'Nouvelles inscriptions',
              value: stats.newInscriptions,
              sub: 'Année scolaire en cours',
              color: 'text-emerald-600',
              icon: CheckCircle2,
              iconBg: 'bg-[#D1F5E8]',
              iconColor: 'text-[#17A673]',
            },
            {
              label: t('unassignedCount'),
              value: stats.unassigned,
              sub: stats.unassigned > 0 ? 'Élèves actifs sans classe' : 'Toutes classes réparties',
              color: stats.unassigned > 0 ? 'text-amber-600' : 'text-slate-400',
              icon: AlertTriangle,
              iconBg: 'bg-[#FCF0DC]',
              iconColor: 'text-[#E8A33D]',
              isActionable: stats.unassigned > 0 && can('students.placements.manage'),
            },
            {
              label: 'Impayés échus',
              value: stats.totalOverdueMAD ? `${stats.totalOverdueMAD.toLocaleString('fr-FR')} MAD` : `${stats.overdue} ${stats.overdue > 1 ? 'dossiers' : 'dossier'}`,
              sub: `${stats.overdueStudentsCount} ${stats.overdueStudentsCount > 1 ? 'élèves' : 'élève'} · ${stats.overdueFamiliesCount} ${stats.overdueFamiliesCount > 1 ? 'familles' : 'famille'}`,
              color: stats.totalOverdueMAD > 0 ? 'text-rose-600' : 'text-emerald-600',
              icon: Wallet,
              iconBg: 'bg-[#FCE4E2]',
              iconColor: 'text-[#E5544B]',
            },
          ].map((kpi, i) => (
            <Card
              key={i}
              onClick={kpi.isActionable ? () => {
                loadClassesAndSections();
                setPlacementMode('unassigned');
                setShowAutoPlacementModal(true);
              } : undefined}
              className={`p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between transition-all ${
                kpi.isActionable ? 'cursor-pointer hover:border-amber-300 hover:shadow-xs' : ''
              }`}
            >
              {loading ? (
                <div className="space-y-2 w-full">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                    <p className="text-2xl font-extrabold text-[#16212B]">{kpi.value}</p>
                    <p className={`text-[11px] font-bold ${kpi.color}`}>{kpi.sub}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-full ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center shrink-0`}>
                    <kpi.icon className="w-5 h-5" />
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>

        {/* Filter and Search Toolbar */}
        <div className="bg-white p-3 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par nom, matricule, tuteur, téléphone..."
              className="ps-10 h-10 text-xs bg-slate-50 border-none rounded-full text-start"
            />
          </div>

          {/* Dynamic Class/Level Filter from Database */}
          <Select value={levelFilter} onValueChange={(val) => { setLevelFilter(val); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[140px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder="Classe / Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classesList.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Official Lifecycle Status Filter */}
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[130px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder={t('statusFilterPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="Actif">Actif</SelectItem>
              <SelectItem value="Inactif">Inactif / Retiré</SelectItem>
              <SelectItem value="Archivé">Archivé</SelectItem>
            </SelectContent>
          </Select>

          {(search.trim() !== '' || levelFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setLevelFilter('all');
                setStatusFilter('all');
                setPage(1);
              }}
              className="h-10 rounded-full px-4 gap-1.5 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <Filter className="w-3.5 h-3.5" /> {tCommon('reset')}
            </Button>
          )}
        </div>

        {/* Compact Mobile Summary Bar (Directly below search/filters on mobile) */}
        <div className="block md:hidden bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium text-xs">
              <strong className="text-[#16212B] font-bold">{stats.active}</strong> actifs · <strong className="text-amber-700 font-bold">{stats.unassigned}</strong> sans classe · <strong className="text-rose-700 font-bold">{stats.overdue}</strong> {stats.overdue > 1 ? 'impayés' : 'impayé'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileKpis(!showMobileKpis)}
              className="h-7 px-2 text-[11px] font-bold text-[#2487B8] hover:bg-slate-50 rounded-lg"
            >
              {showMobileKpis ? 'Masquer' : 'Détails ▾'}
            </Button>
          </div>
          {showMobileKpis && (
            <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-slate-100">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500 font-semibold">{t('activeCount')}</p>
                <p className="text-base font-extrabold text-[#2487B8]">{stats.active}</p>
                <p className="text-[9px] text-slate-400">Total scolarisé</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500 font-semibold">Inscriptions</p>
                <p className="text-base font-extrabold text-emerald-600">{stats.newInscriptions}</p>
                <p className="text-[9px] text-slate-400">{stats.activeAcademicYear}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500 font-semibold">{t('unassignedCount')}</p>
                <p className="text-base font-extrabold text-amber-600">{stats.unassigned}</p>
                <p className="text-[9px] text-slate-400">Sans classe</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-500 font-semibold">Impayés échus</p>
                <p className="text-base font-extrabold text-rose-600">{stats.totalOverdueMAD ? `${stats.totalOverdueMAD.toLocaleString('fr-FR')} MAD` : stats.overdue}</p>
                <p className="text-[9px] text-slate-400">{stats.overdueStudentsCount} élève(s)</p>
              </div>
            </div>
          )}
        </div>

        {/* Selected Rows Bulk Actions Bar */}
        {selectedRowIds.size > 0 && (
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="font-bold text-blue-900">
              ✓ {selectedRowIds.size} élève(s) sélectionné(s)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedStudentsList = students.filter(s => selectedRowIds.has(s.id));
                  const csvHeaders = ['Matricule', 'Nom Complet', 'Classe', 'Tuteur Legal', 'Telephone Tuteur', 'Statut', 'Situation Financiere'];
                  const csvLines = [
                    csvHeaders.join(';'),
                    ...selectedStudentsList.map(st => [
                      `"${st.matricule || ''}"`,
                      `"${(st.name || '').replace(/"/g, '""')}"`,
                      `"${st.classSection || 'Non assigné'}"`,
                      `"${(st.guardianName || '').replace(/"/g, '""')}"`,
                      `"${st.guardianPhone || ''}"`,
                      `"${st.status}"`,
                      `"${st.financialStatus}"`,
                    ].join(';')),
                  ];
                  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Eleves_Selection_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-8 rounded-full text-xs font-bold border-blue-300 text-blue-800 bg-white"
              >
                Exporter CSV ({selectedRowIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenMassarPreview}
                className="h-8 rounded-full text-xs font-bold border-emerald-300 text-emerald-800 bg-white"
              >
                Exporter Massar ({selectedRowIds.size})
              </Button>
              {can('students.placements.manage') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadClassesAndSections();
                    setPlacementMode('rebalance');
                    setShowAutoPlacementModal(true);
                  }}
                  className="h-8 rounded-full text-xs font-bold border-purple-300 text-purple-800 bg-white"
                >
                  Affecter la sélection
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRowIds(new Set())}
                className="h-8 text-xs text-slate-500 hover:text-slate-800"
              >
                Désélectionner
              </Button>
            </div>
          </div>
        )}

        {/* DESKTOP TABLE VIEW (Visible on md and up) */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <Table>
            <TableHeader className="bg-[#F6F9FC]">
              <TableRow>
                <TableHead className="w-10 px-4">
                  <Checkbox
                    checked={students.length > 0 && selectedRowIds.size === students.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('student')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('levelClass')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('legalGuardian')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{t('financialStatus')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">{tCommon('status')}</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4 text-end">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="p-3.5"><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell className="p-3.5"><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell className="p-3.5"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="p-3.5"><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell className="p-3.5"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="p-3.5"><Skeleton className="h-5 w-14" /></TableCell>
                    <TableCell className="p-3.5 text-end"><Skeleton className="h-8 w-20 ms-auto" /></TableCell>
                  </TableRow>
                ))
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-sm text-[#16212B]">Aucun élève trouvé</p>
                      <p className="text-xs text-slate-400">Aucun résultat ne correspond aux filtres ou à la recherche courante.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSearch(''); setLevelFilter('all'); setStatusFilter('all'); }}
                        className="rounded-full text-xs mt-2"
                      >
                        Réinitialiser les filtres
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((st) => (
                  <TableRow
                    key={st.id}
                    onClick={() => setSelectedId(st.id)}
                    className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${
                      st.id === selectedId ? 'bg-[#DCEBF4]/30' : ''
                    }`}
                  >
                    <TableCell className="p-3.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRowIds.has(st.id)}
                        onCheckedChange={() => toggleSelectRow(st.id)}
                        aria-label={`Sélectionner ${st.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 p-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-9 h-9 text-xs bg-[#DCEBF4] text-[#1B6C93] font-bold">
                          <AvatarFallback>{st.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-[#16212B]">{st.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                            <span>{st.matricule}</span>
                            {st.codeMassar && st.codeMassar !== '—' && (
                              <span className="text-emerald-700 bg-emerald-50 px-1 rounded-sm font-semibold">
                                {st.codeMassar}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 p-3.5">
                      <span className="font-medium text-[#16212B]">{st.gradeLevel}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-slate-600 font-semibold">{st.classSection}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 p-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-[#16212B]">{st.guardianName}</p>
                        {st.isLegacyFallback && st.guardianName !== '—' && (
                          <Badge variant="neutral" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 font-semibold">
                            À confirmer
                          </Badge>
                        )}
                        {st.guardianVerified && st.guardianRelation && (
                          <Badge variant="neutral" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                            {st.guardianRelation}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">{st.guardianPhone}</p>
                    </TableCell>
                    <TableCell className="text-xs p-3.5">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          st.financialStatus === 'À jour'
                            ? 'bg-emerald-50 text-[#17A673]'
                            : st.financialStatus === 'Partiel'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {st.financialStatus}
                      </span>
                      {st.overdueAmount > 0 && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          {st.overdueAmount.toLocaleString('fr-FR')} MAD échus
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs p-3.5">
                      <Badge
                        className={`border-none font-bold text-[10px] px-2 py-0.5 ${
                          st.status === 'Actif'
                            ? 'bg-[#DDF5EC] text-[#17A673]'
                            : st.status === 'Archivé'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-[#FCF0DC] text-[#E8A33D]'
                        }`}
                      >
                        {st.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 p-3.5 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg"
                          title="Voir profil complet"
                          aria-label={`Voir profil complet de ${st.name}`}
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
                          title="Carte scolaire"
                          aria-label={`Carte scolaire de ${st.name}`}
                        >
                          <Link href={`/${locale || 'fr'}/dashboard/cards/students?studentId=${st.id}`}>
                            <CreditCard className="w-4 h-4" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100 rounded-lg" aria-label="Plus d'actions">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white rounded-xl shadow-lg border border-slate-200 p-1 text-xs">
                            {can('students.update') && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setFormStudent({
                                    id: st.id,
                                    fullName: st.name,
                                    classSectionId: st.classSectionId,
                                    level: st.gradeLevel,
                                    className: st.classSection,
                                    guardianName: st.guardianName,
                                    guardianPhone: st.guardianPhone,
                                    phone: st.phone,
                                    status: st.status,
                                  });
                                  setIsEditOpen(true);
                                }}
                                className="cursor-pointer font-semibold py-1.5"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-600 me-2" /> Modifier l&apos;élève
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setLifecycleStudent(st);
                                setTargetLifecycleStatus(st.status === 'Actif' ? 'withdrawn' : 'active');
                                setLifecycleReason('');
                                setIsLifecycleOpen(true);
                              }}
                              className="cursor-pointer font-semibold py-1.5"
                            >
                              <Archive className="w-3.5 h-3.5 text-amber-600 me-2" /> Archiver / Déclarer démission
                            </DropdownMenuItem>
                            {can('students.delete') && !st.classSectionId && st.status === 'Inactif' && (
                              <>
                                <DropdownMenuSeparator className="my-1" />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setStudentToDelete(st);
                                    setIsDeleteOpen(true);
                                  }}
                                  className="cursor-pointer font-semibold py-1.5 text-rose-600 focus:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600 me-2" /> Supprimer définitivement
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* MOBILE CARD VIEW (Visible on < md) */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-3">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
              </Card>
            ))
          ) : students.length === 0 ? (
            <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-sm text-[#16212B]">Aucun élève trouvé</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearch(''); setLevelFilter('all'); setStatusFilter('all'); }}
                className="rounded-full text-xs"
              >
                Réinitialiser
              </Button>
            </Card>
          ) : (
            students.map((st) => (
              <Card
                key={st.id}
                onClick={() => {
                  setSelectedId(st.id);
                  setIsMobileInspectorOpen(true);
                }}
                className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 active:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 text-xs bg-[#DCEBF4] text-[#1B6C93] font-bold">
                      <AvatarFallback>{st.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm text-[#16212B]">{st.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{st.matricule}</p>
                    </div>
                  </div>
                  <Badge
                    className={`border-none font-bold text-[10px] ${
                      st.status === 'Actif'
                        ? 'bg-[#DDF5EC] text-[#17A673]'
                        : 'bg-[#FCF0DC] text-[#E8A33D]'
                    }`}
                  >
                    {st.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Classe</span>
                    <span className="font-semibold text-slate-800">{st.classSection}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Finance</span>
                    <span className={`font-bold ${st.financialStatus === 'À jour' ? 'text-[#17A673]' : 'text-rose-600'}`}>
                      {st.financialStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Tuteur : <strong className="text-slate-700">{st.guardianName}</strong></span>
                    {st.isLegacyFallback && st.guardianName !== '—' && (
                      <span className="text-[9px] px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold">
                        À confirmer
                      </span>
                    )}
                    {st.guardianVerified && st.guardianRelation && (
                      <span className="text-[9px] px-1 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                        {st.guardianRelation}
                      </span>
                    )}
                  </div>
                  <span className="text-[#2487B8] font-bold">Toucher pour détails →</span>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <span className="text-xs font-semibold text-slate-500">
            Page {page} sur {totalPages} · {total} élèves répertoriés
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl px-3 text-xs font-bold border-slate-200"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180 me-1" /> {tCommon('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl px-3 text-xs font-bold border-slate-200"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              {tCommon('next')} <ChevronRight className="w-4 h-4 rtl:rotate-180 ms-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* DESKTOP RIGHT INSPECTOR DRAWER (Sticky on xl) */}
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
                <p className="text-[11px] text-slate-500 font-semibold">{activeStudent.gradeLevel} • {activeStudent.classSection}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{activeStudent.matricule}</p>
              </div>
            </div>

            <Link
              href={`/${locale || 'fr'}/dashboard/students/${activeStudent.id}`}
              className="flex items-center justify-center gap-1.5 h-9 rounded-full bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold transition-colors"
            >
              {t('viewFullProfile')}
            </Link>

            <div className="space-y-2.5 text-xs border-t border-slate-100 pt-3">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500">{t('legalGuardian')}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className="font-bold text-[#16212B]">{activeStudent.guardianName}</span>
                  {activeStudent.isLegacyFallback && activeStudent.guardianName !== '—' && (
                    <Badge variant="neutral" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 font-semibold">
                      À confirmer
                    </Badge>
                  )}
                  {activeStudent.guardianVerified && activeStudent.guardianRelation && (
                    <Badge variant="neutral" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                      {activeStudent.guardianRelation}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tél. Tuteur</span>
                <span className="font-mono text-[#16212B] font-bold">{activeStudent.guardianPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('financialStatus')}</span>
                <span className={`font-bold ${activeStudent.financialStatus === 'À jour' ? 'text-[#17A673]' : 'text-rose-600'}`}>
                  {activeStudent.financialStatus}
                </span>
              </div>
              {activeStudent.overdueAmount > 0 && (
                <div className="flex justify-between bg-rose-50 p-2 rounded-xl text-rose-800">
                  <span>Impayé échu</span>
                  <span className="font-extrabold">{activeStudent.overdueAmount.toLocaleString('fr-FR')} MAD</span>
                </div>
              )}
            </div>

            {(can('students.update') || can('students.delete')) && (
              <div className="flex gap-2 border-t border-slate-100 pt-3">
                {can('students.update') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormStudent({
                        id: activeStudent.id,
                        fullName: activeStudent.name,
                        classSectionId: activeStudent.classSectionId,
                        level: activeStudent.gradeLevel,
                        className: activeStudent.classSection,
                        guardianName: activeStudent.guardianName,
                        guardianPhone: activeStudent.guardianPhone,
                        phone: activeStudent.phone,
                        status: activeStudent.status,
                      });
                      setIsEditOpen(true);
                    }}
                    className="flex-1 text-xs font-bold h-9 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {tCommon('edit')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLifecycleStudent(activeStudent);
                    setTargetLifecycleStatus(activeStudent.status === 'Actif' ? 'archived' : 'active');
                    setLifecycleReason('');
                    setIsLifecycleOpen(true);
                  }}
                  className="flex-1 text-xs font-bold h-9 rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  {activeStudent.status === 'Actif' ? 'Archiver / Retirer' : 'Réactiver'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MOBILE BOTTOM SHEET / INSPECTOR DIALOG */}
      <Dialog open={isMobileInspectorOpen} onOpenChange={setIsMobileInspectorOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Profil Rapide</DialogTitle>
          </DialogHeader>
          {activeStudent && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 bg-[#DCEBF4] text-[#1B6C93]">
                  <AvatarFallback className="text-base font-bold bg-[#DCEBF4] text-[#1B6C93]">
                    {activeStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-extrabold text-sm text-[#16212B]">{activeStudent.name}</p>
                  <p className="text-[11px] text-slate-500">{activeStudent.gradeLevel} • {activeStudent.classSection}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{activeStudent.matricule}</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tuteur Légal</span>
                  <span className="font-bold text-slate-800">{activeStudent.guardianName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Téléphone Tuteur</span>
                  <span className="font-mono font-bold text-slate-800">{activeStudent.guardianPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Situation financière</span>
                  <span className={`font-bold ${activeStudent.financialStatus === 'À jour' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {activeStudent.financialStatus}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
                <Button asChild className="flex-1 h-10 rounded-full text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white">
                  <Link href={`/${locale || 'fr'}/dashboard/students/${activeStudent.id}`}>
                    Voir Profil Complet
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMobileInspectorOpen(false);
                    setLifecycleStudent(activeStudent);
                    setTargetLifecycleStatus(activeStudent.status === 'Actif' ? 'archived' : 'active');
                    setLifecycleReason('');
                    setIsLifecycleOpen(true);
                  }}
                  className="h-10 px-3 rounded-full text-xs font-bold border-amber-300 text-amber-800 hover:bg-amber-50"
                >
                  {activeStudent.status === 'Actif' ? 'Archiver' : 'Réactiver'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsMobileInspectorOpen(false)}
                  className="rounded-full text-xs h-10 px-3"
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT STUDENT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">{t('editStudent')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('fullName')}</label>
              <Input
                value={formStudent.fullName || ''}
                onChange={e => setFormStudent({ ...formStudent, fullName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Classe & Section (Affectation)</label>
              <select
                value={formStudent.classSectionId ?? ''}
                onChange={(e) => {
                  const secId = e.target.value || null;
                  const found = sectionsList.find(s => s.id === secId);
                  setFormStudent({
                    ...formStudent,
                    classSectionId: secId,
                    level: found?.className || formStudent.level,
                    className: found ? `${found.className} ${found.sectionName}`.trim() : '',
                  });
                }}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#16212B] focus:outline-hidden focus:ring-2 focus:ring-[#2487B8]"
              >
                <option value="">-- Sans classe assignée --</option>
                {sectionsList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.className} • {s.sectionName}
                  </option>
                ))}
              </select>
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
              <label className="font-bold text-slate-700 block mb-1">Téléphone Tuteur</label>
              <Input
                value={formStudent.guardianPhone || ''}
                onChange={e => setFormStudent({ ...formStudent, guardianPhone: e.target.value })}
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full text-xs h-9">{tCommon('cancel')}</Button>
            <Button onClick={handleEditStudent} className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">{tCommon('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LIFECYCLE TRANSITION DIALOG (Withdrawal / Transfer / Archive) */}
      <Dialog open={isLifecycleOpen} onOpenChange={setIsLifecycleOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Cycle de Vie &amp; Statut de l&apos;Élève</DialogTitle>
          </DialogHeader>
          {lifecycleStudent && (
            <div className="space-y-3.5 my-2 text-xs">
              <p className="text-slate-600">
                Modification du statut officiel de <strong>{lifecycleStudent.name}</strong> ({lifecycleStudent.matricule}). L&apos;historique académique et comptable reste intégralement préservé.
              </p>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Action / Nouveau Statut</label>
                <Select value={targetLifecycleStatus} onValueChange={(val: any) => setTargetLifecycleStatus(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif (Scolarisé et présent)</SelectItem>
                    <SelectItem value="withdrawn">Démission / Sortie (Conserve historique)</SelectItem>
                    <SelectItem value="transferred">Transféré (Vers un autre établissement)</SelectItem>
                    <SelectItem value="graduated">Lauréat / Diplômé (Transition vers Alumni)</SelectItem>
                    <SelectItem value="archived">Archivé (Dossier clos en lecture seule)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motif du changement (Optionnel)</label>
                <Input
                  value={lifecycleReason}
                  onChange={e => setLifecycleReason(e.target.value)}
                  placeholder="Ex: Déménagement familial, fin d'études..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsLifecycleOpen(false)} className="rounded-full text-xs h-9">{tCommon('cancel')}</Button>
            <Button onClick={handleApplyLifecycleTransition} className="rounded-full text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold">Confirmer le Statut</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HARD DELETE CONFIRMATION DIALOG (Drafts only) */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Suppression Définitive
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-xs text-slate-600 my-2">
            <p>
              Êtes-vous sûr de vouloir supprimer définitivement <strong>{studentToDelete?.name}</strong> ?
            </p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] space-y-1">
              <p className="font-bold">Règle de sécurité SchoolOS &amp; CNDP :</p>
              <p>
                Cette action est irréversible et n&apos;est autorisée que pour les fiches créées par erreur <strong>sans aucune note, présence, facture, affectation ou document rattaché</strong>.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-full text-xs h-9">{tCommon('cancel')}</Button>
            <Button onClick={handleDeleteStudent} className="rounded-full text-xs h-9 bg-rose-600 text-white hover:bg-rose-700 font-bold border-none">
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MASSAR VALIDATION & PREVIEW MODAL */}
      <Dialog open={showMassarPreview} onOpenChange={setShowMassarPreview}>
        <DialogContent className="max-w-2xl bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#16212B] flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              <span>Vérification &amp; Export MEN Massar (.xlsx)</span>
            </DialogTitle>
          </DialogHeader>

          {massarLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Contrôle de conformité des codes Massar et identifiants nationaux...</p>
            </div>
          ) : massarReport ? (
            <div className="space-y-4 text-xs py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Total Candidats</p>
                  <p className="text-xl font-extrabold text-[#16212B]">{massarReport.total}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <p className="text-[10px] uppercase font-bold text-emerald-700">Conformes Massar</p>
                  <p className="text-xl font-extrabold text-emerald-700">{massarReport.validCount}</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                  <p className="text-[10px] uppercase font-bold text-rose-700">Non Conformes (Bloquants)</p>
                  <p className="text-xl font-extrabold text-rose-700">{massarReport.blockedCount}</p>
                </div>
              </div>

              {massarReport.blockedCount > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-slate-700">Élèves nécessitant une régularisation avant export :</p>
                  <div className="max-h-48 overflow-y-auto border border-rose-200 rounded-xl bg-rose-50/30">
                    <Table>
                      <TableHeader className="bg-rose-100/60 sticky top-0">
                        <TableRow>
                          <TableHead className="text-[11px] font-bold h-8">Nom Élève</TableHead>
                          <TableHead className="text-[11px] font-bold h-8">Classe</TableHead>
                          <TableHead className="text-[11px] font-bold h-8">Anomalie Constatée</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {massarReport.students.filter(s => s.status === 'blocked').map(s => (
                          <TableRow key={s.id} className="border-rose-100">
                            <TableCell className="font-bold text-slate-800 py-1.5">{s.name}</TableCell>
                            <TableCell className="text-slate-600 py-1.5">{s.className}</TableCell>
                            <TableCell className="text-rose-700 font-semibold py-1.5">{s.blockingReasons.join(', ')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMassarPreview(false)} className="rounded-full text-xs h-9">Fermer</Button>
            {massarReport && massarReport.validCount > 0 && (
              <Button
                onClick={() => {
                  window.open('/api/academics/massar/export/roster?onlyValid=true', '_blank');
                  setShowMassarPreview(false);
                }}
                className="rounded-full text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Télécharger les conformes ({massarReport.validCount})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AUTO-PLACEMENT WIZARD MODAL */}
      <Dialog open={showAutoPlacementModal} onOpenChange={(open) => {
        if (!open) {
          setShowAutoPlacementModal(false);
          setSimulationResult(null);
          setShowMovementDetails(false);
        }
      }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl lg:max-w-3xl bg-white rounded-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#16212B] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Affectation Automatique &amp; Équilibrée</span>
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            {/* Authoritative Scope Banner */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-bold text-[#16212B]">{placementPreflight?.scope.branchName ?? 'Campus Principal'}</span>
                <span className="text-slate-300">•</span>
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Année scolaire {placementPreflight?.scope.academicYearName ?? stats.activeAcademicYear ?? '2026–2027'}</span>
              </div>
              <Badge variant="neutral" className="bg-white border-slate-200 text-slate-600 text-[10px] font-semibold py-0.5 px-2">
                Périmètre autoritaire
              </Badge>
            </div>

            {/* Mode Selection with clear semantics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPlacementMode('unassigned');
                  setSimulationResult(null);
                }}
                className={`p-3 rounded-xl border text-start transition-all ${
                  placementMode === 'unassigned'
                    ? 'border-purple-300 bg-purple-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#16212B] flex items-center gap-1.5">
                    ➕ Nouveaux élèves sans section
                  </span>
                  <Badge variant="neutral" className="bg-purple-100 text-purple-900 border-none text-[10px] font-bold">
                    {placementPreflight ? placementPreflight.unassignedCount : stats.unassigned} à affecter
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Affecte uniquement les élèves qui ne possèdent actuellement aucune section.
                </p>
                {(placementPreflight ? placementPreflight.unassignedCount : stats.unassigned) === 0 && (
                  <p className="text-[10px] text-slate-500 italic mt-1.5 font-medium">
                    Aucun élève n&apos;attend actuellement une affectation.
                  </p>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPlacementMode('rebalance');
                  setSimulationResult(null);
                }}
                className={`p-3 rounded-xl border text-start transition-all ${
                  placementMode === 'rebalance'
                    ? 'border-purple-300 bg-purple-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#16212B] flex items-center gap-1.5">
                    🔄 Rééquilibrer les sections existantes
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Peut déplacer des élèves déjà affectés afin d&apos;équilibrer les effectifs entre les sections.
                </p>
                <div className="mt-1.5 p-1.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-amber-900 text-[10px] flex items-center gap-1.5">
                  <Info className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Les affectations existantes peuvent être modifiées. Une simulation est obligatoire avant validation.</span>
                </div>
              </button>
            </div>

            {/* Capacity Visibility Before Simulation */}
            {eligibleSections.length > 0 && (
              <div>
                {isSimulationBlocked ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Capacité non configurée</strong> pour {unknownCapacitySectionNames.length} {unknownCapacitySectionNames.length > 1 ? 'sections' : 'section'} ({unknownCapacitySectionNames.join(', ')}).
                      </span>
                    </div>
                    <Link
                      href="/dashboard/academics/sections"
                      target="_blank"
                      className="inline-flex items-center gap-1 font-bold text-amber-800 underline hover:text-amber-950 text-xs shrink-0"
                    >
                      Configurer les capacités <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-emerald-800 text-[11px] font-semibold">
                    <span>Sections éligibles : <strong>{eligibleSections.length}</strong></span>
                    <span>Places disponibles : <strong>{availableSlots}</strong> / {configuredCapacity} places</span>
                  </div>
                )}
              </div>
            )}

            {/* Class and Method Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Niveau / Classe Cible</label>
                <select
                  value={placementClassId}
                  onChange={(e) => {
                    setPlacementClassId(e.target.value);
                    setSimulationResult(null);
                  }}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#16212B]"
                >
                  <option value="all">Toutes les classes éligibles</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Méthode de Répartition</label>
                <select
                  value={placementMethod}
                  onChange={(e) => {
                    setPlacementMethod(e.target.value as any);
                    setSimulationResult(null);
                  }}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#16212B]"
                >
                  <option value="balanced_headcount">Équilibrage des effectifs (Recommandé)</option>
                  <option value="random">Aléatoire simple</option>
                  <option value="gender_parity">Parité des genres (Filles / Garçons)</option>
                  <option value="academic_balance">Parité académique (Notes / Moyennes)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  {placementMethod === 'balanced_headcount' && 'Répartit les élèves pour obtenir des sections de taille similaire sans dépasser la capacité configurée.'}
                  {placementMethod === 'random' && 'Répartit les élèves de manière aléatoire et équitable sans dépasser la capacité.'}
                  {placementMethod === 'gender_parity' && 'Alterne l’affectation entre filles et garçons pour équilibrer la parité dans chaque section.'}
                  {placementMethod === 'academic_balance' && 'Distribue les élèves en fonction de leurs notes / moyennes pour homogénéiser le niveau des classes.'}
                </p>
              </div>
            </div>

            {/* Simulation Action Bar */}
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSimulatePlacement}
                disabled={simulating || isSimulationBlocked || (placementMode === 'unassigned' && stats.unassigned === 0)}
                className="h-9 px-4 rounded-xl text-xs font-bold border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5 shadow-2xs"
              >
                <Shuffle className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                {simulating ? 'Simulation…' : 'Simuler la répartition'}
              </Button>

              {simulationResult ? (
                simulationResult.simulationValid ? (
                  simulationResult.hasChanges ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Simulation prête : {(simulationResult.newAssignmentsCount ?? 0) === 1 ? '1 nouvelle affectation' : `${simulationResult.newAssignmentsCount ?? 0} nouvelles affectations`}, {(simulationResult.movedCount ?? 0) === 1 ? '1 déplacement' : `${simulationResult.movedCount ?? 0} déplacements`}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sections déjà équilibrées (0 changement requis)
                    </span>
                  )
                ) : (
                  <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Simulation non valide : conflits ou blocages
                  </span>
                )
              ) : (
                <span className="text-xs text-slate-400 font-medium italic">
                  Simulation obligatoire avant validation
                </span>
              )}
            </div>

            {/* SIMULATION RESULT PANEL */}
            {simulationResult && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                {/* No-Op Calm Banner when sections are already balanced */}
                {!simulationResult.hasChanges && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">Aucune modification nécessaire.</p>
                      <p className="text-[11px] text-emerald-700">Les sections sont déjà équilibrées.</p>
                    </div>
                  </div>
                )}

                {/* 1. Summary Metrics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Élèves analysés</p>
                    <p className="text-base font-extrabold text-[#16212B]">{simulationResult.evaluatedStudentsCount ?? simulationResult.placedCount}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Sans changement</p>
                    <p className="text-base font-extrabold text-slate-700">{simulationResult.unchangedCount ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Nouvelles affectations</p>
                    <p className="text-base font-extrabold text-emerald-600">{simulationResult.newAssignmentsCount ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Déplacements</p>
                    <p className="text-base font-extrabold text-purple-700">{simulationResult.movedCount ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Non placés / Conflits</p>
                    <p className={`text-base font-extrabold ${simulationResult.unplacedCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {simulationResult.unplacedCount}
                    </p>
                  </div>
                </div>

                {/* 2. Before / After Section Preview Table */}
                <div className="space-y-1.5">
                  <p className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">
                    Aperçu Avant / Après par Section :
                  </p>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Section</th>
                          <th className="px-3 py-2 text-center">Avant</th>
                          <th className="px-3 py-2 text-center">Mouvement</th>
                          <th className="px-3 py-2 text-center">Après</th>
                          <th className="px-3 py-2 text-center">Capacité</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(simulationResult.breakdown).map(([secId, b]) => (
                          <tr key={secId} className={b.isOverCapacity ? 'bg-rose-50/50' : ''}>
                            <td className="px-3 py-2 font-bold text-[#16212B]">
                              {b.className} ({b.sectionName})
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-slate-600">
                              {b.beforeOccupancy}
                            </td>
                            <td className="px-3 py-2 text-center font-bold">
                              {b.movement > 0 ? (
                                <span className="text-emerald-600">+{b.movement}</span>
                              ) : b.movement < 0 ? (
                                <span className="text-amber-600">{b.movement}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-extrabold text-[#16212B]">
                              {b.afterOccupancy}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {b.maxStudents != null ? (
                                <span className={b.isOverCapacity ? 'text-rose-600 font-extrabold' : 'text-slate-600 font-medium'}>
                                  {b.maxStudents} {b.isOverCapacity && '(Dépassée !)'}
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold">Non définie</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3a. New Student Assignment Details (Requirement 12) */}
                {placementMode === 'unassigned' && simulationResult.placedCount > 0 && (
                  <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-950 text-xs">
                        {simulationResult.placedCount} élève(s) sans section à affecter
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMovementDetails(!showMovementDetails)}
                        className="h-6 px-2 text-[11px] font-bold text-purple-800 hover:bg-purple-100/60 rounded-lg gap-1"
                      >
                        {showMovementDetails ? 'Masquer la liste' : 'Voir les affectations proposées'}
                        {showMovementDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </div>

                    {showMovementDetails && (
                      <div className="max-h-40 overflow-y-auto divide-y divide-purple-100 bg-white rounded-lg border border-purple-100 p-2 text-xs">
                        {simulationResult.assignments.map((a) => (
                          <div key={a.studentId} className="py-1.5 flex items-center justify-between text-slate-700">
                            <span className="font-bold text-[#16212B]">{a.studentName} {a.matricule && `(${a.matricule})`}</span>
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              <span className="text-slate-400 italic">Sans section</span>
                              <ArrowRight className="w-3 h-3 text-purple-600" />
                              <span className="text-purple-900 font-bold">{a.targetClassName} {a.targetSectionName}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3b. Rebalancing Movement Details (Requirement 11) */}
                {placementMode === 'rebalance' && (
                  simulationResult.movedCount > 0 ? (
                    <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-950 text-xs">
                          {simulationResult.movedCount} élève(s) changeront de section
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowMovementDetails(!showMovementDetails)}
                          className="h-6 px-2 text-[11px] font-bold text-purple-800 hover:bg-purple-100/60 rounded-lg gap-1"
                        >
                          {showMovementDetails ? 'Masquer la liste' : 'Voir les élèves concernés'}
                          {showMovementDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>

                      {showMovementDetails && (
                        <div className="max-h-40 overflow-y-auto divide-y divide-purple-100 bg-white rounded-lg border border-purple-100 p-2 text-xs">
                          {simulationResult.assignments.filter(a => a.isMove).map((a) => (
                            <div key={a.studentId} className="py-1.5 flex items-center justify-between text-slate-700">
                              <span className="font-bold text-[#16212B]">{a.studentName} {a.matricule && `(${a.matricule})`}</span>
                              <span className="font-semibold text-xs flex items-center gap-1.5">
                                <span className="text-slate-500">{a.previousClassName || 'Ancienne section'}</span>
                                <ArrowRight className="w-3 h-3 text-purple-600" />
                                <span className="text-purple-900 font-bold">{a.targetClassName} {a.targetSectionName}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-600 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Aucun déplacement nécessaire : les effectifs des sections sont déjà optimaux et équilibrés.</span>
                    </div>
                  )
                )}

                {/* 4. Unassigned Students Alert / Blockers */}
                {simulationResult.unplacedStudents.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-900 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{simulationResult.unplacedStudents.length} élève(s) n&apos;ont pas pu être affecté(s) :</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-rose-100 bg-white rounded-lg border border-rose-200 p-2 text-[11px]">
                      {simulationResult.unplacedStudents.map(u => (
                        <div key={u.studentId} className="py-1 flex items-center justify-between">
                          <span className="font-bold text-slate-800">{u.studentName}</span>
                          <span className="text-rose-700 font-medium">{u.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Mid-Year Safety Advisory */}
                {simulationResult.hasAcademicHistoryWarning && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Certains élèves possèdent déjà un historique pédagogique dans leur section actuelle. Leur historique sera intégralement conservé.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => {
                setShowAutoPlacementModal(false);
                setSimulationResult(null);
                setShowMovementDetails(false);
              }}
              className="rounded-full text-xs h-9"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() => setShowConfirmModal(true)}
              disabled={
                !simulationResult ||
                !simulationResult.simulationValid ||
                !simulationResult.hasChanges ||
                simulationResult.placedCount === 0 ||
                applyingPlacement
              }
              className="rounded-full text-xs h-9 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {simulationResult && simulationResult.simulationValid && simulationResult.hasChanges
                ? `Appliquer ${simulationResult.placedCount} ${simulationResult.placedCount > 1 ? 'affectations' : 'affectation'}`
                : 'Appliquer les affectations'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FINAL CONFIRMATION MODAL */}
      <Dialog open={showConfirmModal && Boolean(simulationResult?.hasChanges && (simulationResult.placedCount ?? 0) > 0)} onOpenChange={setShowConfirmModal}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md bg-white rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span>Confirmer les affectations ?</span>
            </DialogTitle>
          </DialogHeader>

          {simulationResult && (
            <div className="space-y-3 text-xs text-slate-600 my-2">
              {(() => {
                const totalChanges = simulationResult.placedCount ?? ((simulationResult.newAssignmentsCount ?? 0) + (simulationResult.movedCount ?? 0));
                const newCount = simulationResult.newAssignmentsCount ?? 0;
                const moveCount = simulationResult.movedCount ?? 0;
                const unplacedCount = simulationResult.unplacedCount ?? 0;
                return (
                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-1.5 text-purple-950 font-medium">
                    <p>✓ <strong>{totalChanges} {totalChanges > 1 ? 'changements seront appliqués' : 'changement sera appliqué'}</strong>.</p>
                    <p>✓ <strong>{newCount} {newCount > 1 ? 'nouvelles affectations' : 'nouvelle affectation'}</strong>.</p>
                    <p>✓ <strong>{moveCount} {moveCount > 1 ? 'changements de section' : 'changement de section'}</strong>.</p>
                    <p>✓ <strong>0 dépassement de capacité</strong>.</p>
                    <p>✓ <strong>{unplacedCount} {unplacedCount > 1 ? 'conflits' : 'conflit'}</strong>.</p>
                  </div>
                );
              })()}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Note d&apos;audit / Motif (Optionnel)
                </label>
                <Input
                  value={placementAuditNote}
                  onChange={e => setPlacementAuditNote(e.target.value)}
                  placeholder="Ex: Rééquilibrage rentrée 2026..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <p className="text-[11px] text-slate-500 italic">
                L&apos;opération sera enregistrée de façon transactionnelle dans le journal d&apos;audit SchoolOS.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              disabled={applyingPlacement}
              className="rounded-full text-xs h-9"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleApplyPlacement}
              disabled={applyingPlacement}
              className="rounded-full text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1.5"
            >
              {applyingPlacement ? 'Enregistrement transactionnel…' : 'Confirmer définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
