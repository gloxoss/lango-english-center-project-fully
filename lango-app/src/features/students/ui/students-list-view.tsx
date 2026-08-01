'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  FolderOpen, CheckCircle2, AlertTriangle, Wallet,
  Search, Filter, Eye, MoreVertical, Edit2, Trash2,
  ChevronLeft, ChevronRight, Users, UserPlus, Download, Check, X,
} from 'lucide-react';
import { Student } from '../model/types';

import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

export function StudentsDirectoryView({ locale }: { locale: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form State
  const [formStudent, setFormStudent] = useState<Partial<Student>>({
    fullName: '',
    level: '2nde A',
    className: '2BAC-A',
    guardianName: '',
    phone: '',
    status: 'Actif',
    paymentStatus: 'À jour',
  });

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Fetch initial data from API
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/students?pageSize=500');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setStudents(json.data);
            if (json.data.length > 0) {
              setSelectedStudentId(json.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load students API data', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtering
  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    const levelTerm = levelFilter.toLowerCase();

    const matchesSearch =
      (s.fullName ?? '').toLowerCase().includes(term) ||
      (s.matricule ?? '').toLowerCase().includes(term) ||
      (s.className ?? '').toLowerCase().includes(term);

    const matchesLevel = levelFilter === 'all' ||
      (s.level ?? '').toLowerCase().includes(levelTerm) ||
      (s.className ?? '').toLowerCase().includes(levelTerm);

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesLevel && matchesStatus;
  });

  const sel = students.find(s => s.id === selectedStudentId) || (filteredStudents.length > 0 ? filteredStudents[0] : null);

  // Columns definition for DataTable
  const columns: Column<Student>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          className="rounded accent-blue-600 cursor-pointer"
          checked={filteredStudents.length > 0 && selectedStudentId === filteredStudents[0]?.id}
          onChange={() => {
            if (filteredStudents.length > 0 && filteredStudents[0]) {
              setSelectedStudentId(selectedStudentId ? null : filteredStudents[0].id);
            }
          }}
        />
      ),
      cell: (s) => (
        <input
          type="checkbox"
          className="rounded accent-blue-600 cursor-pointer"
          checked={selectedStudentId === s.id}
          onChange={(e) => {
            e.stopPropagation();
            setSelectedStudentId(s.id);
          }}
        />
      ),
      className: 'w-8',
    },
    {
      key: 'fullName',
      header: 'Élève',
      cell: (s) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs font-bold bg-slate-200 text-slate-700">
              {s.fullName.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-bold text-[#16212B]">{s.fullName}</p>
            <p className="text-[10px] text-slate-400 font-normal">{s.level}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'matricule',
      header: 'Matricule',
      cell: (s) => <span className="font-mono text-slate-600 text-[11px]">{s.matricule}</span>,
    },
    {
      key: 'className',
      header: 'Classe',
      cell: (s) => <span className="text-slate-700 font-semibold">{s.className}</span>,
    },
    {
      key: 'guardianName',
      header: 'Tuteur / Parent',
      cell: (s) => <span className="text-slate-700">{s.guardianName}</span>,
    },
    {
      key: 'phone',
      header: 'Téléphone',
      cell: (s) => <span className="font-mono text-slate-500 text-[11px]">{s.phone}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (s) => (
        <Badge className="bg-[#D1F5E8] text-[#17A673] text-[10px] px-2 py-0.5 border-none font-medium">
          {s.status}
        </Badge>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Paiement',
      cell: (s) => (
        s.paymentStatus === 'À jour' ? (
          <Badge className="bg-[#DCEBF4] text-[#1B6C93] text-[10px] px-2 py-0.5 border-none font-medium">À jour</Badge>
        ) : (
          <Badge className="bg-[#FCE4E2] text-[#E5544B] text-[10px] px-2 py-0.5 border-none font-medium">{s.paymentStatus}</Badge>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-center',
      cell: (s) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link href={`/${locale}/dashboard/students/${s.id}`} title="Voir la fiche" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 inline-flex">
            <Eye className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => openEditModal(s)}
            title="Modifier"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-blue-600"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openDeleteModal(s)}
            title="Supprimer"
            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
      className: 'text-center',
    },
  ];

  // Handlers for CRUD Operations
  const handleCreateStudent = async () => {
    if (!formStudent.fullName) return;

    let matricule = '';
    try {
      const matRes = await fetch('/api/students/matricules');
      const matJson = await matRes.json();
      if (matJson.success) {
        matricule = matJson.matricule;
      }
    } catch (e) {
      console.error('Matricule generation failed', e);
    }

    const newStudentObj: Student = {
      id: `STU-${Date.now()}`,
      matricule,
      fullName: formStudent.fullName || '',
      level: formStudent.level || '2nde A',
      className: formStudent.className || '2BAC-A',
      guardianName: formStudent.guardianName || 'Tuteur Légal',
      phone: formStudent.phone || '+212 6 00-000000',
      status: (formStudent.status as Student['status']) || 'Actif',
      paymentStatus: (formStudent.paymentStatus as Student['paymentStatus']) || 'À jour',
    };

    setStudents(prev => [newStudentObj, ...prev]);
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

    try {
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudentObj),
      });
    } catch (e) {
      console.error('API Error saving student', e);
    }
  };

  const handleEditStudent = async () => {
    if (!formStudent.id) return;

    setStudents(prev => prev.map(s => s.id === formStudent.id ? ({ ...s, ...formStudent } as Student) : s));
    setIsEditOpen(false);

    try {
      await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formStudent),
      });
    } catch (e) {
      console.error('API Error updating student', e);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    const id = studentToDelete.id;
    setStudents(prev => prev.filter(s => s.id !== id));
    setIsDeleteOpen(false);
    setStudentToDelete(null);

    try {
      await fetch(`/api/students?id=${id}`, {
        method: 'DELETE',
      });
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
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Répertoire des élèves</h1>
            <p className="text-xs text-slate-500 mt-1">Gestion interactive des profils scolaires & CRUD dynamique</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(filteredStudents, 'eleves-repertoire')}
              className="gap-2 h-10 rounded-full px-4 text-xs font-bold border-slate-200"
            >
              <Download className="w-4 h-4" /> Exporter
            </Button>
            <Button asChild variant="primary" size="sm" className="gap-2 h-10 rounded-full px-4 text-xs font-bold bg-[#0066FF] hover:bg-[#0052CC]">
              <Link href={`/${locale}/dashboard/students/add`}>
                <UserPlus className="w-4 h-4" /> + Inscrire un élève
              </Link>
            </Button>
          </div>
        </div>

        {/* Top KPIs Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Élèves actifs', value: students.filter(s => s.status === 'Actif').length, sub: 'Sur cet établissement', color: 'text-[#0066FF]', icon: Users, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
            { label: 'Inscriptions', value: students.length, sub: 'Total répertorié', color: 'text-emerald-600', icon: CheckCircle2, iconBg: 'bg-[#D1F5E8]', iconColor: 'text-[#17A673]' },
            { label: 'Sans classe assignée', value: students.filter(s => !s.classSectionId).length, sub: 'À placer', color: 'text-amber-600', icon: AlertTriangle, iconBg: 'bg-[#FCF0DC]', iconColor: 'text-[#E8A33D]' },
            { label: 'Paiements en retard', value: students.filter(s => s.paymentStatus === 'En retard' || s.paymentStatus === 'Impayé').length, sub: 'Suivi des impayés', color: 'text-rose-600', icon: Wallet, iconBg: 'bg-[#FCE4E2]', iconColor: 'text-[#E5544B]' },
          ].map((kpi, i) => (
            <Card key={i} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
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
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, matricule, classe..."
              className="pl-10 h-10 text-xs bg-slate-50 border-none rounded-full"
            />
          </div>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-auto min-w-[130px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder="Niveau : Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Niveau : Tous</SelectItem>
              <SelectItem value="2nde">2nde</SelectItem>
              <SelectItem value="1ère">1ère</SelectItem>
              <SelectItem value="3ème">3ème</SelectItem>
              <SelectItem value="5ème">5ème Primaire</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[130px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder="Statut : Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Statut : Tous</SelectItem>
              <SelectItem value="Actif">Actif</SelectItem>
              <SelectItem value="En attente">En attente</SelectItem>
              <SelectItem value="Inactif">Inactif</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearchTerm(''); setLevelFilter('all'); setStatusFilter('all'); }}
            className="h-10 rounded-full px-4 gap-1.5 text-xs font-bold border-slate-200"
          >
            <Filter className="w-3.5 h-3.5" /> Réinitialiser
          </Button>
        </div>

        {/* Dynamic DataTable Component */}
        <DataTable
          data={filteredStudents}
          columns={columns}
          isLoading={isLoading}
          emptyTitle="Aucun élève trouvé"
          emptyDescription="Aucun élève ne correspond à vos critères de recherche actuels."
          defaultPageSize={10}
          selectedRowId={selectedStudentId}
          onRowClick={(row) => setSelectedStudentId(row.id)}
        />
      </div>

      {/* Right Inspector Drawer */}
      {sel && (
        <div className="w-[340px] shrink-0 space-y-4 hidden xl:block">
          <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#16212B]">Profil Élève</h3>
              <Badge className="bg-[#D1F5E8] text-[#17A673] text-[9px] px-2 border-none">
                {sel.status}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="text-base font-bold bg-slate-200 text-slate-700">
                  {sel.fullName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-extrabold text-[#16212B] text-sm">{sel.fullName}</p>
                <p className="text-[11px] text-slate-500">{sel.level} • {sel.className}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sel.matricule}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Tuteur Légal</span>
                <span className="font-bold text-[#16212B]">{sel.guardianName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone</span>
                <span className="font-mono text-[#16212B] font-bold">{sel.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut Financier</span>
                <span className="font-bold text-[#1B6C93]">{sel.paymentStatus}</span>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditModal(sel)}
                className="flex-1 text-xs font-bold h-9 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDeleteModal(sel)}
                className="flex-1 text-xs font-bold h-9 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                Supprimer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CREATE STUDENT DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Ajouter un nouvel élève</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom complet *</label>
              <Input
                value={formStudent.fullName || ''}
                onChange={e => setFormStudent({ ...formStudent, fullName: e.target.value })}
                placeholder="Ex. Youssef Benjelloun"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Niveau *</label>
                <Input
                  value={formStudent.level || ''}
                  onChange={e => setFormStudent({ ...formStudent, level: e.target.value })}
                  placeholder="Ex. 2nde A"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Classe *</label>
                <Input
                  value={formStudent.className || ''}
                  onChange={e => setFormStudent({ ...formStudent, className: e.target.value })}
                  placeholder="Ex. 2BAC-A"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Tuteur Légal *</label>
              <Input
                value={formStudent.guardianName || ''}
                onChange={e => setFormStudent({ ...formStudent, guardianName: e.target.value })}
                placeholder="Ex. M. Karim Benjelloun"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Téléphone *</label>
              <Input
                value={formStudent.phone || ''}
                onChange={e => setFormStudent({ ...formStudent, phone: e.target.value })}
                placeholder="Ex. +212 6 12-345678"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Statut</label>
                <Select
                  value={formStudent.status || 'Actif'}
                  onValueChange={v => setFormStudent({ ...formStudent, status: v as Student['status'] })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Actif">Actif</SelectItem>
                    <SelectItem value="En attente">En attente</SelectItem>
                    <SelectItem value="Inactif">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Paiement</label>
                <Select
                  value={formStudent.paymentStatus || 'À jour'}
                  onValueChange={v => setFormStudent({ ...formStudent, paymentStatus: v as Student['paymentStatus'] })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À jour">À jour</SelectItem>
                    <SelectItem value="En retard">En retard</SelectItem>
                    <SelectItem value="Impayé">Impayé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" onClick={handleCreateStudent} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT STUDENT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Modifier l&apos;élève</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom complet</label>
              <Input
                value={formStudent.fullName || ''}
                onChange={e => setFormStudent({ ...formStudent, fullName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Niveau</label>
                <Input
                  value={formStudent.level || ''}
                  onChange={e => setFormStudent({ ...formStudent, level: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Classe</label>
                <Input
                  value={formStudent.className || ''}
                  onChange={e => setFormStudent({ ...formStudent, className: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Tuteur Légal</label>
              <Input
                value={formStudent.guardianName || ''}
                onChange={e => setFormStudent({ ...formStudent, guardianName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Téléphone</label>
              <Input
                value={formStudent.phone || ''}
                onChange={e => setFormStudent({ ...formStudent, phone: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" onClick={handleEditStudent} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">Mettre à jour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 my-2">
            Êtes-vous sûr de vouloir supprimer l&apos;élève <strong className="text-rose-600">{studentToDelete?.fullName}</strong> ? Cette action est irréversible.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="outline" onClick={handleDeleteStudent} className="rounded-full text-xs h-9 bg-rose-600 text-white hover:bg-rose-700 border-none">Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { StudentsDirectoryView as StudentsListView };
