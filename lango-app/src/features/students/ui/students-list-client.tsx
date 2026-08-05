'use client';

import { useState } from 'react';
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
  Wallet, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useEffect } from 'react';
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

export function StudentsListClient({ locale }: { locale?: string } = {}) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [formStudent, setFormStudent] = useState<Partial<Student>>({
    fullName: '', level: '2nde A', className: '2BAC-A', guardianName: '', phone: '', status: 'Actif', paymentStatus: 'À jour',
  });

  const activeStudent = students.find(s => s.id === selectedId) ?? students[0];

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.matricule.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === 'all' || s.gradeLevel.includes(levelFilter);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesLevel && matchesStatus;
  });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students?pageSize=200');
      const json = await res.json();
      if (json.success) {
        const mapped = (json.data as ApiStudent[]).map(fromApiStudent);
        setStudents(mapped);
        setSelectedId(prev => (mapped.some(s => s.id === prev) ? prev : (mapped[0]?.id ?? '')));
      }
    } catch (e) {
      console.error('Failed to load students', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <Button asChild size="sm" className="gap-2 h-10 rounded-full px-4 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white shadow-2xs">
              <Link href={`/${locale || 'fr'}/dashboard/students/add`}>
                <UserPlus className="w-4 h-4" /> + Inscrire un élève
              </Link>
            </Button>
          </div>
        </div>

        {/* Top KPIs Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Élèves actifs', value: students.filter(s => s.status === 'Actif').length, sub: 'Sur cet établissement', color: 'text-[#2487B8]', icon: Users, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
            { label: 'Inscriptions', value: students.length, sub: 'Total répertorié', color: 'text-emerald-600', icon: CheckCircle2, iconBg: 'bg-[#D1F5E8]', iconColor: 'text-[#17A673]' },
            { label: 'Sans classe assignée', value: students.filter(s => !s.classSection).length, sub: 'À placer', color: 'text-amber-600', icon: AlertTriangle, iconBg: 'bg-[#FCF0DC]', iconColor: 'text-[#E8A33D]' },
            { label: 'Paiements en retard', value: students.filter(s => s.financialStatus !== 'À jour').length, sub: 'Suivi des impayés', color: 'text-rose-600', icon: Wallet, iconBg: 'bg-[#FCE4E2]', iconColor: 'text-[#E5544B]' },
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            onClick={() => { setSearch(''); setLevelFilter('all'); setStatusFilter('all'); }}
            className="h-10 rounded-full px-4 gap-1.5 text-xs font-bold border-slate-200"
          >
            <Filter className="w-3.5 h-3.5" /> Réinitialiser
          </Button>
        </div>

        {/* Dynamic Students Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <Table>
            <TableHeader className="bg-[#F6F9FC]">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">Élève</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">Niveau / Classe</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">Tuteur Légal</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">Statut Financier</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 h-10 px-4">Statut</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Right Inspector Drawer */}
      {activeStudent && (
        <div className="w-[340px] shrink-0 space-y-4 hidden xl:block">
          <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#16212B]">Profil Élève</h3>
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

            <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Tuteur Légal</span>
                <span className="font-bold text-[#16212B]">{activeStudent.guardianName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone</span>
                <span className="font-mono text-[#16212B] font-bold">{activeStudent.guardianPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut Financier</span>
                <span className="font-bold text-[#1B6C93]">{activeStudent.financialStatus}</span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditModal({ id: activeStudent.id, fullName: activeStudent.name, level: activeStudent.gradeLevel, className: activeStudent.classSection, guardianName: activeStudent.guardianName, phone: activeStudent.guardianPhone, status: activeStudent.status, paymentStatus: activeStudent.financialStatus })}
                className="flex-1 text-xs font-bold h-9 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDeleteModal({ id: activeStudent.id, fullName: activeStudent.name, level: activeStudent.gradeLevel, className: activeStudent.classSection, guardianName: activeStudent.guardianName, phone: activeStudent.guardianPhone, status: activeStudent.status, paymentStatus: activeStudent.financialStatus })}
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
            <Button onClick={handleCreateStudent} className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">Enregistrer</Button>
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
            <Button onClick={handleEditStudent} className="rounded-full text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">Mettre à jour</Button>
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
            <Button onClick={handleDeleteStudent} className="rounded-full text-xs h-9 bg-rose-600 text-white hover:bg-rose-700 border-none">Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
