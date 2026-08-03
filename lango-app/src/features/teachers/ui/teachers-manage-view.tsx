'use client';

import Link from 'next/link';
import type { Teacher } from '../model/types';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
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

export function TeachersManageView({ locale }: { locale: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<string>('Tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', employeeId: '', specialization: '' });
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
    setForm({ fullName: '', email: '', phone: '', employeeId: '', specialization: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (t: Teacher) => {
    setEditingTeacher(t);
    setForm({ fullName: t.name, email: t.email, phone: t.phone, employeeId: t.employeeId, specialization: t.specialization });
    setDialogOpen(true);
  };

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
          body: JSON.stringify({ id: editingTeacher.id, fullName: form.fullName, phone: form.phone, specialization: form.specialization }),
        });
      } else {
        await fetch('/api/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
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

  const filteredTeachers = teachers.filter((t) => {
    if (filterTab === 'Actifs' && t.status !== 'Actif' && t.status !== 'active') {
      return false;
    }
    if (filterTab === 'Profil incomplet' && t.status !== 'Incomplet') {
      return false;
    }
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }
    return (
      (t.name ?? '').toLowerCase().includes(term) ||
      (t.employeeId ?? '').toLowerCase().includes(term) ||
      (t.specialization ?? '').toLowerCase().includes(term)
    );
  });

  const columns: Column<Teacher>[] = [
    {
      key: 'name',
      header: 'Enseignant',
      cell: (t) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-slate-200 text-xs font-bold text-slate-700">
              {t.name.split(' ').map((n) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-[#16212B]">{t.name}</p>
            <p className="text-[10px] font-normal text-slate-400">Professeure</p>
          </div>
        </div>
      ),
    },
    {
      key: 'employeeId',
      header: 'Matricule',
      cell: (t) => <span className="font-mono text-[11px] text-slate-600">{t.employeeId}</span>,
    },
    {
      key: 'specialization',
      header: 'Spécialité',
      cell: (t) => <span className="font-semibold text-slate-700">{t.specialization}</span>,
    },
    {
      key: 'subjects',
      header: 'Matières',
      cell: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.subjects?.map((s) => (
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
      header: 'Classes',
      cell: (t) => <span className="text-[11px] text-slate-600">{t.assignedClasses.join(', ')}</span>,
    },
    {
      key: 'workloadHours',
      header: 'Charge',
      cell: (t) => <span className="font-bold text-[#16212B]">{t.workloadHours}h</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (t) => (
        <div className="text-[10px] text-slate-500">
          <p>{t.phone}</p>
          <p className="text-slate-400">{t.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (t) => getStatusBadge(t.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-center',
      cell: (t) => (
        <div className="flex items-center justify-center gap-1">
          <Link
            href={`/${locale}/dashboard/teachers/${t.id}`}
            title="Voir la fiche"
            className="inline-flex rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <Eye className="size-4" />
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEditDialog(t); }}
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
              <DropdownMenuItem onClick={() => handleDelete(t.id)} className="text-rose-600 focus:text-rose-600">
                <Trash2 className="mr-2 size-3.5" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: 'text-center',
    },
  ];

  const sel = teachers.find(t => t.id === selectedTeacherId) || (filteredTeachers.length > 0 ? filteredTeachers[0] : null);

  const docsComplete = teachers.filter(t => t.documents?.contract && t.documents?.cin && t.documents?.diploma).length;
  const docsMissing = teachers.filter(t => !t.documents?.contract && !t.documents?.cin && !t.documents?.diploma).length;
  const docsIncomplete = teachers.length - docsComplete - docsMissing;
  const docsTotal = teachers.length || 1;
  const pctComplete = (docsComplete / docsTotal) * 100;
  const pctIncomplete = (docsIncomplete / docsTotal) * 100;
  const pctMissing = (docsMissing / docsTotal) * 100;

  const getStatusBadge = (status: Teacher['status']) => {
    switch (status) {
      case 'Actif':
      case 'active':
        return (
          <Badge className="
            border-none bg-[#D1F5E8] px-2 py-0.5 text-[10px] text-[#17A673]
          "
          >
            Actif
          </Badge>
        );
      case 'Incomplet':
        return (
          <Badge className="
            border-none bg-[#FCF0DC] px-2 py-0.5 text-[10px] text-[#E8A33D]
          "
          >
            Incomplet
          </Badge>
        );
      case 'Congé':
      case 'leave':
        return (
          <Badge className="
            border-none bg-[#DCEBF4] px-2 py-0.5 text-[10px] text-[#1B6C93]
          "
          >
            Congé
          </Badge>
        );
      default:
        return (
          <Badge className="
            border-none bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600
          "
          >
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Enseignants & personnel pédagogique</h1>
          <p className="mt-1 text-xs text-slate-500">Annuaire, charge horaire et suivi des profils</p>
        </div>

        {/* Top KPIs */}
        <div className="
          grid grid-cols-1 gap-4
          sm:grid-cols-2
          lg:grid-cols-4
        "
        >
          {[
            {
              label: 'Enseignants actifs',
              value: teachers.filter(t => t.status === 'Actif' || t.status === 'active').length,
              sub: `sur ${teachers.length} au total`,
              color: 'text-emerald-600',
              icon: Users,
              iconBg: 'bg-[#DCEBF4]',
              iconColor: 'text-[#1B6C93]',
            },
            {
              label: 'Charge moyenne',
              value: teachers.length > 0 ? `${Math.round(teachers.reduce((sum, t) => sum + t.workloadHours, 0) / teachers.length)}h / semaine` : '—',
              sub: 'Toutes affectations',
              color: 'text-blue-600',
              icon: Clock,
              iconBg: 'bg-[#DCEBF4]',
              iconColor: 'text-[#1B6C93]',
            },
            {
              label: 'Profils incomplets',
              value: teachers.filter(t => t.status === 'Incomplet').length,
              sub: 'À compléter',
              color: 'text-amber-600',
              icon: AlertCircle,
              iconBg: 'bg-[#FCF0DC]',
              iconColor: 'text-[#E8A33D]',
            },
            {
              label: 'En congé',
              value: teachers.filter(t => t.status === 'Congé' || t.status === 'leave').length,
              sub: 'Actuellement',
              color: 'text-rose-600',
              icon: Calendar,
              iconBg: 'bg-[#FCE4E2]',
              iconColor: 'text-[#E5544B]',
            },
          ].map((kpi, i) => (
            <Card
              key={i}
              className="
                flex items-center justify-between rounded-2xl border
                border-slate-200/80 bg-white p-5 shadow-2xs
              "
            >
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{kpi.value}</p>
                <p className={`
                  text-[11px] font-bold
                  ${kpi.color}
                `}
                >
                  {kpi.sub}
                </p>
              </div>
              <div className={`
                size-10 rounded-full
                ${kpi.iconBg}
                ${kpi.iconColor}
                flex items-center justify-center
              `}
              >
                <kpi.icon className="size-5" />
              </div>
            </Card>
          ))}
        </div>

        {/* Directory Card */}
        <Card className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-[#16212B]">Annuaire des enseignants</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCsv(filteredTeachers, 'enseignants')}
                className="
                  h-9 gap-1.5 rounded-full border-slate-200 px-3 text-xs
                  font-bold
                "
              >
                <Download className="size-3.5" />
                {' '}
                Exporter
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateDialog}
                className="
                  h-9 gap-1.5 rounded-full bg-[#0066FF] px-4 text-xs font-bold
                  hover:bg-[#0052CC]
                "
              >
                <Plus className="size-3.5" />
                {' '}
                Ajouter un enseignant
              </Button>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="
                absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400
              "
              />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher un enseignant..."
                className="
                  h-9 rounded-full border-slate-200 bg-slate-50 pl-10 text-xs
                "
              />
            </div>

            <div className="
              flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs
            "
            >
              {['Tous', 'Actifs', 'Profil incomplet'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`
                    rounded-full px-3 py-1 text-[11px] font-bold
                    transition-colors
                    ${
                filterTab === tab
                  ? 'bg-white text-[#16212B] shadow-2xs'
                  : `
                    text-slate-500
                    hover:text-slate-800
                  `
                }
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic DataTable Component */}
          <DataTable
            data={filteredTeachers}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="Aucun enseignant trouvé"
            emptyDescription="Aucun enseignant ne correspond à vos critères de recherche actuels."
            defaultPageSize={10}
            selectedRowId={selectedTeacherId}
            onRowClick={(row) => setSelectedTeacherId(row.id)}
          />
        </Card>

        {/* Documents & Compliance - real per-teacher document flags */}
        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <h3 className="mb-1 text-sm font-extrabold text-[#16212B]">Documents & conformité</h3>
          <p className="mb-4 text-[10px] text-slate-400">Statut des dossiers enseignants (contrat, CIN, diplôme)</p>

          <div className="flex items-center justify-around gap-4">
            <div className="relative flex size-32 items-center justify-center">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#17A673" strokeWidth="4" strokeDasharray={`${pctComplete} ${100 - pctComplete}`} strokeDashoffset="0" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E8A33D" strokeWidth="4" strokeDasharray={`${pctIncomplete} ${100 - pctIncomplete}`} strokeDashoffset={-pctComplete} />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E5544B" strokeWidth="4" strokeDasharray={`${pctMissing} ${100 - pctMissing}`} strokeDashoffset={-(pctComplete + pctIncomplete)} />
              </svg>
              <div className="
                absolute inset-0 flex flex-col items-center justify-center
              "
              >
                <span className="text-xl font-extrabold text-[#16212B]">{teachers.length}</span>
                <span className="text-[9px] text-slate-400">Enseignants</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#17A673]" />
                <span className="text-slate-600">Complets</span>
                <span className="ml-auto font-bold text-[#16212B]">{docsComplete}</span>
                <span className="text-[10px] text-slate-400">{pctComplete.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#E8A33D]" />
                <span className="text-slate-600">Incomplets</span>
                <span className="ml-auto font-bold text-[#16212B]">{docsIncomplete}</span>
                <span className="text-[10px] text-slate-400">{pctIncomplete.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#E5544B]" />
                <span className="text-slate-600">Manquants</span>
                <span className="ml-auto font-bold text-[#16212B]">{docsMissing}</span>
                <span className="text-[10px] text-slate-400">{pctMissing.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Inspector Drawer */}
      {sel && (
        <div className="
          hidden w-[320px] shrink-0 space-y-4
          xl:block
        "
        >
          <Card className="
            space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
            shadow-2xs
          "
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                <AvatarFallback className="
                  bg-slate-200 text-base font-bold text-slate-700
                "
                >
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
                  Matricule :
                  {sel.employeeId}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t pt-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <BookOpen className="size-3.5 shrink-0 text-blue-500" />
                <span>
                  Matières :
                  <strong className="text-[#16212B]">{sel.subjects?.join(', ') || 'Maths'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="size-3.5 shrink-0 text-emerald-500" />
                <span>
                  Classes :
                  <strong className="text-[#16212B]">{sel.assignedClasses.join(', ')}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-purple-500" />
                <span>
                  Charge :
                  <strong className="text-[#16212B]">
                    {sel.workloadHours}
                    h / semaine
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <CalendarCheck className="size-3.5 shrink-0 text-amber-500" />
                <span>
                  Embauche :
                  <strong className="text-[#16212B]">{sel.hireDate || 'Non renseigné'}</strong>
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
                <Link href={`/${locale}/dashboard/teachers/${sel.id}`}>Voir le profil</Link>
              </Button>
            </div>

            {/* Documents Check Section - real per-teacher flags, no filenames stored */}
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold text-[#16212B]">Documents</h4>
              {[
                { name: 'Contrat de travail', valid: sel.documents?.contract ?? false },
                { name: 'CIN', valid: sel.documents?.cin ?? false },
                { name: 'Diplôme', valid: sel.documents?.diploma ?? false },
              ].map((doc, i) => (
                <div
                  key={i}
                  className="
                    flex items-center justify-between rounded-lg bg-slate-50 p-2
                    text-xs
                  "
                >
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-slate-400" />
                    <p className="text-[11px] font-bold text-[#16212B]">{doc.name}</p>
                  </div>
                  {doc.valid ? (
                    <Badge className="border-none bg-[#D1F5E8] px-1.5 py-0 text-[9px] text-[#17A673]">Fourni</Badge>
                  ) : (
                    <Badge className="border-none bg-[#FCE4E2] px-1.5 py-0 text-[9px] text-[#E5544B]">Manquant</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">
              {editingTeacher ? 'Modifier l\'enseignant' : 'Créer un nouvel enseignant'}
            </DialogTitle>
          </DialogHeader>
          <div className="my-2 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-bold text-slate-700">Nom complet *</label>
              <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            {!editingTeacher && (
              <div>
                <label className="mb-1 block font-bold text-slate-700">Email</label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9 rounded-xl text-xs" />
              </div>
            )}
            <div>
              <label className="mb-1 block font-bold text-slate-700">Téléphone</label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
            {!editingTeacher && (
              <div>
                <label className="mb-1 block font-bold text-slate-700">Matricule</label>
                <Input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="h-9 rounded-xl text-xs" />
              </div>
            )}
            <div>
              <label className="mb-1 block font-bold text-slate-700">Spécialité</label>
              <Input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} className="h-9 rounded-xl text-xs" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9 rounded-full text-xs">Annuler</Button>
            <Button variant="primary" disabled={isSubmitting} onClick={handleSubmit} className="h-9 rounded-full bg-[#0066FF] text-xs text-white">
              {editingTeacher ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
