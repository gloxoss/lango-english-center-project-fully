'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  UserPlus, Download, Users, UserCheck, Clock, AlertTriangle, FileText, Building, Search, Filter, CheckCircle2, ChevronRight
} from 'lucide-react';

type EmployeeStatus = 'Actif' | 'En congé' | 'En essai';

type HRDirectoryEmployee = {
  id: string;
  name: string;
  code: string;
  role: string;
  dept: string;
  campus: string;
  contact: string;
  phone: string;
  status: EmployeeStatus;
  hireDate: string;
  avatar: string;
};

const HR_EMPLOYEES: HRDirectoryEmployee[] = [
  { id: '1', name: 'Youssef El Fassi', code: 'YE-001', role: 'Directeur Général', dept: 'Direction', campus: 'Casablanca', contact: 'y.el-fassi@alkhawarizmi.ma', phone: '+212 6 61 11 22 33', status: 'Actif', hireDate: '01/09/2018', avatar: 'YF' },
  { id: '2', name: 'Meriem Boussaid', code: 'MB-014', role: 'Directrice Pédagogique', dept: 'Pédagogie', campus: 'Casablanca', contact: 'm.boussaid@alkhawarizmi.ma', phone: '+212 6 62 22 33 44', status: 'Actif', hireDate: '15/09/2020', avatar: 'MB' },
  { id: '3', name: 'Hicham Admin', code: 'HA-002', role: 'Responsable RH', dept: 'Ressources humaines', campus: 'Casablanca', contact: 'h.admin@alkhawarizmi.ma', phone: '+212 6 63 33 44 55', status: 'Actif', hireDate: '10/10/2019', avatar: 'HA' },
  { id: '4', name: 'Salma El Amrani', code: 'SE-023', role: 'Professeure de Mathématiques', dept: 'Mathématiques', campus: 'Casablanca', contact: 's.elamrani@alkhawarizmi.ma', phone: '+212 6 64 44 55 66', status: 'Actif', hireDate: '01/09/2022', avatar: 'SA' },
  { id: '5', name: 'Omar Hamdani', code: 'OH-011', role: 'Responsable Informatique', dept: 'IT & Digital', campus: 'Casablanca', contact: 'o.hamdani@alkhawarizmi.ma', phone: '+212 6 65 55 66 77', status: 'Actif', hireDate: '12/01/2021', avatar: 'OH' },
  { id: '6', name: 'Loubna Zahiri', code: 'LZ-031', role: 'Assistante Administrative', dept: 'Administration', campus: 'Casablanca', contact: 'l.zahiri@alkhawarizmi.ma', phone: '+212 6 66 66 77 88', status: 'En congé', hireDate: '05/06/2023', avatar: 'LZ' },
  { id: '7', name: 'Amine Alami', code: 'AA-047', role: 'Professeur de Physique-Chimie', dept: 'Sciences', campus: 'Casablanca', contact: 'a.alami@alkhawarizmi.ma', phone: '+212 6 67 77 88 99', status: 'Actif', hireDate: '01/09/2024', avatar: 'AA' },
  { id: '8', name: 'Yassine Belkadi', code: 'YB-050', role: 'Surveillant Général', dept: 'Vie scolaire', campus: 'Casablanca', contact: 'y.belkadi@alkhawarizmi.ma', phone: '+212 6 68 88 99 00', status: 'En essai', hireDate: '01/03/2025', avatar: 'YB' },
];

const DEPT_DISTRIBUTION = [
  { name: 'Pédagogie', count: 68, pct: 36.6, color: 'bg-blue-600' },
  { name: 'Administration', count: 32, pct: 17.2, color: 'bg-teal-500' },
  { name: 'Vie scolaire', count: 24, pct: 12.9, color: 'bg-emerald-500' },
  { name: 'Direction', count: 12, pct: 6.5, color: 'bg-[#2487B8]' },
  { name: 'IT & Digital', count: 10, pct: 5.4, color: 'bg-amber-400' },
  { name: 'Autres', count: 40, pct: 21.4, color: 'bg-slate-300' },
];

const RECENT_HR_ACTIONS = [
  { title: 'Nouveau contrat signé : Amine Alami', desc: 'Professeur de Physique-Chimie', date: '21/05/2025' },
  { title: 'Mutation : Loubna Zahiri', desc: 'Transfert vers Administration', date: '20/05/2025' },
  { title: 'Fin de période d\'essai : Yassine Belkadi', desc: 'Statut confirmé', date: '19/05/2025' },
];

const PENDING_HR_APPROVALS = [
  { title: 'Demande de congé – Salma El Amrani', dates: 'Du 26 mai au 30 mai 2025', days: '3 jours', status: 'À valider' },
  { title: 'Avenant de contrat – Omar Hamdani', dates: 'Modification de salaire', status: 'À valider' },
  { title: 'Formation – Meriem Boussaid', dates: 'Certification Leadership en éducation', status: 'À valider' },
];

const CONTRACT_TYPES = [
  { type: 'CDI', count: 132, pct: 71.0 },
  { type: 'CDD', count: 38, pct: 20.4 },
  { type: 'Stage / Essai', count: 16, pct: 8.6 },
];

function getEmployeeStatusBadge(status: EmployeeStatus) {
  switch (status) {
    case 'Actif': return 'bg-[#DDF5EC] text-[#17A673] border-none';
    case 'En congé': return 'bg-amber-100 text-amber-700 border-none';
    case 'En essai': return 'bg-[#DCEBF4] text-[#1B6C93] border-none';
  }
}

export function HRDirectoryView() {
  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Ressources humaines</h1>
          <p className="text-xs text-slate-500 mt-1">Supervisez le personnel, gérez les dossiers employés, les contrats et les affectations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm">
            <UserPlus className="w-3.5 h-3.5" /> Ajouter un employé
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]">
            <Download className="w-3.5 h-3.5" /> Exporter l&apos;annuaire
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]">
            Affecter un responsable
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]">
            Lancer l&apos;onboarding
          </Button>
        </div>
      </div>

      {/* 6 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">Employés totaux</p>
            <p className="text-base font-extrabold text-[#16212B]">186</p>
            <p className="text-[9px] font-semibold text-[#17A673]">vs hier 🟢 3</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">Employés actifs</p>
            <p className="text-base font-extrabold text-[#16212B]">168</p>
            <p className="text-[9px] font-semibold text-slate-500">90,3% du total</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">Onboarding en cours</p>
            <p className="text-base font-extrabold text-[#16212B]">12</p>
            <p className="text-[9px] font-semibold text-slate-500">Nouveaux recrutements</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 shrink-0 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">Absences aujourd&apos;hui</p>
            <p className="text-base font-extrabold text-[#16212B]">8</p>
            <p className="text-[9px] font-semibold text-slate-500">4,3% des effectifs</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">Contrats expirant bientôt</p>
            <p className="text-base font-extrabold text-[#16212B]">14</p>
            <p className="text-[9px] font-semibold text-slate-500">Dans les 60 jours</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">Départements</p>
            <p className="text-base font-extrabold text-[#16212B]">12</p>
            <p className="text-[9px] font-semibold text-slate-500">Unités organ.</p>
          </div>
        </Card>
      </div>

      {/* Main Grid: Left Directory Table (8 cols) & Right Breakdown Panel (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Directory */}
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Annuaire des employés</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-700">
                  <option>Tous les rôles</option>
                </select>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-700">
                  <option>Tous les départements</option>
                </select>
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-700">
                  <option>Tous les statuts</option>
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input placeholder="Rechercher un employé..." className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-44" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Employé</th>
                    <th className="pb-2">Rôle / Poste</th>
                    <th className="pb-2">Département</th>
                    <th className="pb-2">Campus</th>
                    <th className="pb-2">Contact</th>
                    <th className="pb-2 text-center">Statut</th>
                    <th className="pb-2 text-right">Date d&apos;embauche</th>
                    <th className="pb-2 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {HR_EMPLOYEES.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-extrabold text-[10px] flex items-center justify-center shrink-0">
                            {emp.avatar}
                          </div>
                          <div>
                            <p className="font-bold text-[#16212B] text-[11px]">{emp.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{emp.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 font-bold text-slate-700 text-[11px]">{emp.role}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{emp.dept}</td>
                      <td className="py-2.5 text-slate-500 text-[11px]">{emp.campus}</td>
                      <td className="py-2.5">
                        <p className="text-[10px] font-bold text-[#2487B8]">{emp.contact}</p>
                        <p className="text-[9px] text-slate-400 font-mono">{emp.phone}</p>
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge className={`text-[9px] font-bold ${getEmployeeStatusBadge(emp.status)}`}>{emp.status}</Badge>
                      </td>
                      <td className="py-2.5 text-right font-mono text-[11px] text-slate-500">{emp.hireDate}</td>
                      <td className="py-2.5 text-right">
                        <button className="text-slate-400 hover:text-slate-600 font-bold">⋮</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold">
              <span>Affichage 10 lignes par page</span>
              <span>1 à 10 sur 186 employés</span>
            </div>
          </Card>

          {/* Bottom Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Indicateurs clés RH</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Âge moyen</span>
                  <span className="text-base font-extrabold text-[#16212B]">39,8 ans</span>
                  <span className="text-[8px] font-semibold text-[#17A673] block">vs mois dernier 🟢 +0,6</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Ancienneté moy.</span>
                  <span className="text-base font-extrabold text-[#16212B]">4,2 ans</span>
                  <span className="text-[8px] font-semibold text-[#17A673] block">vs mois dernier 🟢 +0,2</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Taux de rotation</span>
                  <span className="text-base font-extrabold text-[#16212B]">6,5%</span>
                  <span className="text-[8px] font-semibold text-[#17A673] block">vs mois dernier 📉 -0,8%</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Répartition par type de contrat</h2>
              <div className="space-y-2 text-xs">
                {CONTRACT_TYPES.map((ct) => (
                  <div key={ct.type} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-[#16212B]">{ct.type}</span>
                      <span className="font-bold text-slate-600">{ct.count} ({ct.pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2487B8] rounded-full" style={{ width: `${ct.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Right Column (4 cols): Répartition département, Actions RH, Approbations */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <h2 className="text-xs font-extrabold text-[#16212B]">Répartition des effectifs par département</h2>

            <div className="flex items-center gap-4 py-2">
              <div className="relative w-24 h-24 rounded-full border-8 border-blue-600 flex flex-col items-center justify-center text-center shrink-0">
                <span className="text-base font-extrabold text-[#16212B]">186</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">Employés</span>
              </div>

              <div className="space-y-1 text-xs flex-1">
                {DEPT_DISTRIBUTION.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${d.color}`} />
                      <span className="font-semibold text-slate-700">{d.name}</span>
                    </div>
                    <span className="font-bold text-[#16212B]">{d.count} ({d.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              Voir le détail par département →
            </button>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Actions RH récentes</h2>
              <button className="text-[11px] font-bold text-[#2487B8] hover:underline">Voir toutes</button>
            </div>

            <div className="space-y-2 text-xs">
              {RECENT_HR_ACTIONS.map((act, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#16212B] text-[11px]">{act.title}</p>
                    <span className="text-[9px] text-slate-400 font-mono">{act.date}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">{act.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">Approbations en attente</h2>
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] flex items-center justify-center">3</span>
            </div>

            <div className="space-y-2 text-xs">
              {PENDING_HR_APPROVALS.map((app, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#16212B] text-[11px]">{app.title}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{app.dates}</p>
                  </div>
                  <Button size="sm" className="h-7 text-[10px] bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-lg px-2">
                    À valider
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
