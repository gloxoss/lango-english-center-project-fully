'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Users, UserPlus, Shield, Key, Search, Plus, Download, Filter, Edit, CheckCircle2, MoreVertical } from 'lucide-react';

export function UsersRolesView({ locale }: { locale: string }) {
  const [activeTab, setActiveTab] = useState<'utilisateurs' | 'roles'>('utilisateurs');
  const [roleFilter, setRoleFilter] = useState('Tous les rôles');

  const usersList = [
    { name: 'Youssef El Amrani', roleTitle: 'Directeur', email: 'y.elamrani@atlas.ma', role: 'Directeur', school: 'Campus Principal', lastConn: 'Aujourd\'hui, 09:21', tfa: true, status: 'Actif' },
    { name: 'Lina Bakkali', roleTitle: 'Enseignante', email: 'l.bakkali@atlas.ma', role: 'Enseignant', school: 'Collège Atlas', lastConn: 'Aujourd\'hui, 08:57', tfa: true, status: 'Actif' },
    { name: 'Omar El Idrissi', roleTitle: 'Enseignant', email: 'o.elidrissi@atlas.ma', role: 'Enseignant', school: 'Lycée Atlas', lastConn: 'Hier, 16:45', tfa: true, status: 'Actif' },
    { name: 'Salma Bouazza', roleTitle: 'Comptable', email: 's.bouazza@atlas.ma', role: 'Comptable', school: 'Campus Principal', lastConn: 'Hier, 11:32', tfa: true, status: 'Actif' },
    { name: 'Hajar El Mansouri', roleTitle: 'Super Admin', email: 'h.elmansouri@atlas.ma', role: 'Super Admin', school: 'Groupe Atlas', lastConn: 'Hier, 10:15', tfa: true, status: 'Actif' },
    { name: 'Yassine El Jibri', roleTitle: 'Enseignant', email: 'y.eljibri@atlas.ma', role: 'Enseignant', school: 'Collège Atlas', lastConn: '18 mai 2025, 14:08', tfa: false, status: 'Actif' },
    { name: 'Aya Benjelloun', roleTitle: 'Enseignante', email: 'a.benjelloun@atlas.ma', role: 'Enseignant', school: 'Primaire Atlas', lastConn: '16 mai 2025, 15:22', tfa: true, status: 'Actif' },
    { name: 'Rachid Ait Ali', roleTitle: 'Comptable', email: 'r.aitali@atlas.ma', role: 'Comptable', school: 'Lycée Atlas', lastConn: '16 mai 2025, 09:41', tfa: true, status: 'Suspendu' },
  ];

  const modulesPermissions = [
    'Tableau de bord', 'Élèves & groupes', 'Présences', 'Emploi du temps', 'Finances', 'Communication (SMS)', 'Examens', 'Rapports', 'Paramètres'
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Utilisateurs & rôles</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez les comptes utilisateurs, les rôles et les accès au système.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 h-9 text-xs rounded-xl">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Inviter un utilisateur</span>
          </Button>
          <Button variant="primary" size="sm" className="gap-2 h-9 text-xs rounded-xl px-4">
            <Plus className="w-4 h-4" />
            <span>Créer un rôle</span>
          </Button>
        </div>
      </div>

      {/* 3 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Utilisateurs actifs</p>
            <p className="text-2xl font-extrabold text-[#16212B]">48</p>
            <p className="text-[11px] font-bold text-[#2487B8]">+8,3% vs mois dernier</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Invitations en attente</p>
            <p className="text-2xl font-extrabold text-[#16212B]">4</p>
            <p className="text-[11px] font-bold text-amber-600">Actions requises</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">2FA activée</p>
            <p className="text-2xl font-extrabold text-[#16212B]">92%</p>
            <p className="text-[11px] font-bold text-emerald-600">+4,1% vs mois dernier</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Main Grid: Left Users Table & Right Selected Role Permissions Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Rechercher un utilisateur (nom, email...)" className="pl-10 h-9 text-xs bg-slate-50 border-none rounded-full" />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px] rounded-full h-9 bg-white">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tous les rôles">Tous les rôles</SelectItem>
                <SelectItem value="Directeur">Directeur</SelectItem>
                <SelectItem value="Enseignant">Enseignant</SelectItem>
                <SelectItem value="Comptable">Comptable</SelectItem>
                <SelectItem value="Super Admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rôle</th>
                    <th className="py-3 px-4">Établissement</th>
                    <th className="py-3 px-4">Dernière connexion</th>
                    <th className="py-3 px-4 text-center">2FA</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {usersList.map((u, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-[#16212B]">{u.name}</p>
                        <p className="text-[10px] text-slate-400">{u.roleTitle}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                      <td className="py-3 px-4">
                        <Badge className={
                          u.role === 'Super Admin' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'Directeur' ? 'bg-sky-100 text-sky-800' :
                          u.role === 'Enseignant' ? 'bg-[#DCEBF4] text-[#1B6C93]' :
                          'bg-[#FCF0DC] text-[#E8A33D]'
                        }>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{u.school}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{u.lastConn}</td>
                      <td className="py-3 px-4 text-center">
                        {u.tfa ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={u.status === 'Actif' ? 'bg-[#DCEBF4] text-[#1B6C93]' : 'bg-rose-100 text-rose-800'}>
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Rail Selected Role Details & Permissions Matrix */}
        <div className="space-y-4 text-xs">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge className="bg-purple-100 text-purple-800 mb-1">Accès complet</Badge>
                <h3 className="text-base font-extrabold text-[#16212B]">Super Admin</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Accès total à toutes les fonctionnalités et paramètres.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1 h-7 rounded-lg text-[10px]">
                <Edit className="w-3 h-3" /> Modifier
              </Button>
            </div>

            {/* Matrix Table */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="font-extrabold text-[#16212B] text-xs">Accès & permissions</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-[11px]">
                  <thead className="bg-[#F6F9FC] text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="py-1.5 text-left px-2">Module</th>
                      <th className="py-1.5 px-1">Voir</th>
                      <th className="py-1.5 px-1">Créer</th>
                      <th className="py-1.5 px-1">Mod.</th>
                      <th className="py-1.5 px-1">Supp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {modulesPermissions.map((mod) => (
                      <tr key={mod} className="hover:bg-slate-50">
                        <td className="py-1.5 text-left px-2 font-bold text-[#16212B]">{mod}</td>
                        <td className="py-1.5 px-1"><input type="checkbox" defaultChecked className="rounded text-[#2487B8]" /></td>
                        <td className="py-1.5 px-1"><input type="checkbox" defaultChecked className="rounded text-[#2487B8]" /></td>
                        <td className="py-1.5 px-1"><input type="checkbox" defaultChecked className="rounded text-[#2487B8]" /></td>
                        <td className="py-1.5 px-1"><input type="checkbox" defaultChecked className="rounded text-[#2487B8]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
