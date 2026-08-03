'use client';

import { useState, useEffect } from 'react';
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
  Users, UserCheck, ShieldAlert, Key, Search, Filter,
  Plus, Edit2, Trash2, Eye, ChevronLeft, ChevronRight,
  Mail, Phone, Shield, Lock, CheckCircle2,
} from 'lucide-react';
import { User } from '../model/types';

export function UsersManageView({ locale }: { locale: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIdx, setSelectedUserIdx] = useState<number | null>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [formUser, setFormUser] = useState<Partial<User>>({
    fullName: '',
    email: '',
    phone: '',
    role: 'Enseignant',
    status: 'Actif',
  });

  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/users?page=${page}&pageSize=${pageSize}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setUsers(json.data);
            setTotal(json.total ?? json.data.length);
          }
        }
      } catch (err) {
        console.error('Failed to load users data', err);
      }
    }
    loadData();
  }, [page]);

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (u.fullName ?? '').toLowerCase().includes(term) ||
      (u.email ?? '').toLowerCase().includes(term) ||
      (u.phone ?? '').toLowerCase().includes(term);

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const sel = selectedUserIdx !== null && filteredUsers[selectedUserIdx] ? filteredUsers[selectedUserIdx] : null;

  const handleCreateUser = async () => {
    if (!formUser.fullName || !formUser.email) return;

    const newUserObj: User = {
      id: `USR-${Date.now()}`,
      schoolId: 'SCH-01',
      fullName: formUser.fullName,
      email: formUser.email,
      phone: formUser.phone || '+212 6 00-000000',
      role: formUser.role || 'Enseignant',
      status: formUser.status || 'Actif',
      createdAt: "Aujourd'hui",
      lastLogin: 'Jamais',
      qualification: formUser.qualification,
      salary: formUser.salary,
    };

    setUsers(prev => [newUserObj, ...prev]);
    setIsAddOpen(false);
    setFormUser({ fullName: '', email: '', phone: '', role: 'Enseignant', status: 'Actif' });

    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserObj),
      });
    } catch (e) {
      console.error('API Error saving user', e);
    }
  };

  const handleEditUser = async () => {
    if (!formUser.id) return;

    setUsers(prev => prev.map(u => u.id === formUser.id ? ({ ...u, ...formUser } as User) : u));
    setIsEditOpen(false);

    try {
      await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formUser),
      });
    } catch (e) {
      console.error('API Error updating user', e);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    const id = userToDelete.id;

    setUsers(prev => prev.filter(u => u.id !== id));
    setIsDeleteOpen(false);
    setUserToDelete(null);

    try {
      await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('API Error deleting user', e);
    }
  };

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'Super Admin':
      case 'Admin':
        return <Badge className="bg-[#DCEBF4] text-[#1B6C93] text-[10px] px-2 py-0.5 border-none font-bold">Admin</Badge>;
      case 'Enseignant':
        return <Badge className="bg-[#D1F5E8] text-[#17A673] text-[10px] px-2 py-0.5 border-none font-bold">Enseignant</Badge>;
      case 'Tuteur':
        return <Badge className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 border-none font-bold">Tuteur</Badge>;
      case 'Comptable':
        return <Badge className="bg-[#FCF0DC] text-[#E8A33D] text-[10px] px-2 py-0.5 border-none font-bold">Comptable</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 border-none font-medium">{role}</Badge>;
    }
  };

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      {/* Left Main Roster */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Gestion des utilisateurs</h1>
            <p className="text-xs text-slate-500 mt-1">Comptes d&apos;accès, rôles et privilèges multi-établissement</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-2 h-10 rounded-full px-4 text-xs font-bold bg-[#0066FF] hover:bg-[#0052CC]"
          >
            <Plus className="w-4 h-4" /> + Nouvel utilisateur
          </Button>
        </div>

        {/* Top KPIs Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Utilisateurs totaux', value: users.length, sub: 'Sur votre établissement', icon: Users, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
            { label: 'Enseignants actifs', value: users.filter(u => u.role === 'Enseignant').length, sub: 'Droits de saisie', icon: UserCheck, iconBg: 'bg-[#D1F5E8]', iconColor: 'text-[#17A673]' },
            { label: 'Tuteurs connectés', value: users.filter(u => u.role === 'Tuteur').length, sub: 'Accès portail mobile', icon: Key, iconBg: 'bg-purple-100', iconColor: 'text-purple-700' },
            { label: 'Comptes suspendus', value: users.filter(u => u.status === 'Suspendu').length, sub: 'Action requise', icon: ShieldAlert, iconBg: 'bg-[#FCE4E2]', iconColor: 'text-[#E5544B]' },
          ].map((kpi, i) => (
            <Card key={i} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{kpi.value}</p>
                <p className="text-[11px] font-bold text-slate-500">{kpi.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-full ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white p-3 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, e-mail, téléphone..."
              className="pl-10 h-10 text-xs bg-slate-50 border-none rounded-full"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-auto min-w-[130px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder="Rôle : Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Rôle : Tous</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Enseignant">Enseignant</SelectItem>
              <SelectItem value="Tuteur">Tuteur</SelectItem>
              <SelectItem value="Comptable">Comptable</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[130px] rounded-full h-10 bg-white border-slate-200/80 text-xs font-semibold">
              <SelectValue placeholder="Statut : Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Statut : Tous</SelectItem>
              <SelectItem value="Actif">Actif</SelectItem>
              <SelectItem value="Inactif">Inactif</SelectItem>
              <SelectItem value="Suspendu">Suspendu</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); }}
            className="h-10 rounded-full px-4 text-xs font-bold border-slate-200"
          >
            <Filter className="w-3.5 h-3.5" /> Réinitialiser
          </Button>
        </div>

        {/* Users Table */}
        <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#F6F9FC] text-slate-500 font-semibold text-xs border-b border-slate-200/80">
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredUsers.map((u, i) => (
                  <TableRow
                    key={u.id}
                    onClick={() => setSelectedUserIdx(i)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${selectedUserIdx === i ? 'bg-blue-50/60' : ''}`}
                  >
                    <TableCell className="font-bold text-[#16212B]">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs font-bold bg-slate-200 text-slate-700">
                            {u.fullName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-[#16212B]">{u.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-normal">Créé le {u.createdAt}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 font-mono text-[11px]">{u.email}</TableCell>
                    <TableCell className="text-slate-600 font-mono text-[11px]">{u.phone}</TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell>
                      {u.status === 'Actif' ? (
                        <Badge className="bg-[#D1F5E8] text-[#17A673] text-[10px] px-2 py-0.5 border-none font-medium">Actif</Badge>
                      ) : (
                        <Badge className="bg-[#FCE4E2] text-[#E5544B] text-[10px] px-2 py-0.5 border-none font-medium">{u.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-[11px]">{u.lastLogin}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setFormUser(u); setIsEditOpen(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setUserToDelete(u); setIsDeleteOpen(true); }} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Page {page} sur {Math.max(1, Math.ceil(total / pageSize))} ({total} utilisateurs au total)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-lg bg-[#0066FF] text-white font-bold flex items-center justify-center">{page}</button>
              <button
                type="button"
                disabled={page * pageSize >= total}
                onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Inspector */}
      {sel && (
        <div className="w-[320px] shrink-0 space-y-4 hidden xl:block">
          <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#16212B]">Profil Utilisateur</h3>
              {getRoleBadge(sel.role)}
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="text-base font-bold bg-slate-200 text-slate-700">
                  {sel.fullName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-extrabold text-[#16212B] text-sm">{sel.fullName}</p>
                <p className="text-[11px] text-slate-500">{sel.role} • Atlas</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sel.email}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone</span>
                <span className="font-mono text-[#16212B] font-bold">{sel.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut Compte</span>
                <span className="font-bold text-emerald-600">{sel.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Créé le</span>
                <span className="text-slate-700">{sel.createdAt}</span>
              </div>
              {sel.qualification && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Qualification</span>
                  <span className="font-bold text-[#16212B]">{sel.qualification}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFormUser(sel); setIsEditOpen(true); }}
                className="flex-1 text-xs font-bold h-9 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setUserToDelete(sel); setIsDeleteOpen(true); }}
                className="flex-1 text-xs font-bold h-9 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                Supprimer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CREATE USER DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Créer un nouvel utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom complet *</label>
              <Input
                value={formUser.fullName || ''}
                onChange={e => setFormUser({ ...formUser, fullName: e.target.value })}
                placeholder="Ex. Mohammed Bennani"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Adresse E-mail *</label>
              <Input
                value={formUser.email || ''}
                onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                placeholder="Ex. m.bennani@atlas.ma"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Téléphone</label>
              <Input
                value={formUser.phone || ''}
                onChange={e => setFormUser({ ...formUser, phone: e.target.value })}
                placeholder="Ex. +212 6 12-345678"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Rôle</label>
                <Select
                  value={formUser.role || 'Enseignant'}
                  onValueChange={v => setFormUser({ ...formUser, role: v as User['role'] })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Enseignant">Enseignant</SelectItem>
                    <SelectItem value="Tuteur">Tuteur</SelectItem>
                    <SelectItem value="Comptable">Comptable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Statut</label>
                <Select
                  value={formUser.status || 'Actif'}
                  onValueChange={v => setFormUser({ ...formUser, status: v as User['status'] })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Actif">Actif</SelectItem>
                    <SelectItem value="Inactif">Inactif</SelectItem>
                    <SelectItem value="Suspendu">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" onClick={handleCreateUser} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">Créer le compte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT USER DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Modifier l&apos;utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom complet</label>
              <Input
                value={formUser.fullName || ''}
                onChange={e => setFormUser({ ...formUser, fullName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">E-mail</label>
              <Input
                value={formUser.email || ''}
                onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Téléphone</label>
              <Input
                value={formUser.phone || ''}
                onChange={e => setFormUser({ ...formUser, phone: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Rôle</label>
              <Select
                value={formUser.role || 'Enseignant'}
                onValueChange={v => setFormUser({ ...formUser, role: v as User['role'] })}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Enseignant">Enseignant</SelectItem>
                  <SelectItem value="Tuteur">Tuteur</SelectItem>
                  <SelectItem value="Comptable">Comptable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="primary" onClick={handleEditUser} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">Mettre à jour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE USER DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Supprimer l&apos;utilisateur</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 my-2">
            Êtes-vous sûr de vouloir supprimer <strong className="text-rose-600">{userToDelete?.fullName}</strong> ({userToDelete?.email}) ?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button variant="outline" onClick={handleDeleteUser} className="rounded-full text-xs h-9 bg-rose-600 text-white border-none">Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
