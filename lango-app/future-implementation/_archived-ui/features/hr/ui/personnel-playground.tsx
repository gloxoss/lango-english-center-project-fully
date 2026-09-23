'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users, UserCheck, Search, Plus, Filter, Phone, Mail, FileText,
  ShieldCheck, AlertTriangle, Sparkles, Layers, SlidersHorizontal,
  Building2, CheckCircle2, Clock, Calendar, ChevronRight, X,
  GraduationCap, Briefcase, Award, Check, UserPlus, FileCheck
} from 'lucide-react';
import { EmployeeDirectoryView } from './employee-directory-view';

type EmployeeItem = {
  id: string;
  matricule: string;
  fullName: string;
  role: 'teacher' | 'admin' | 'accountant' | 'guard' | 'driver' | 'receptionist';
  roleLabel: string;
  department: 'Pédagogie' | 'Administration & Finances' | 'Logistique & Sécurité' | 'Direction';
  email: string;
  phone: string;
  hireDate: string;
  contractType: 'CDI' | 'CDD' | 'ANAPEC' | 'Vacataire';
  cnssNumber: string;
  cimrNumber?: string;
  status: 'active' | 'leave' | 'probation' | 'pending';
  workload?: { assignedHours: number; maxHours: number; assignedClassesCount: number };
  medicalCheckExpiry?: string;
  contractEnd?: string;
};

const DEFAULT_DEMO_PERSONNEL: EmployeeItem[] = [
  {
    id: 'emp-1',
    matricule: 'PERS-2025-001',
    fullName: 'Dr. Mohammed El Amrani',
    role: 'teacher',
    roleLabel: 'Professeur Agrégé',
    department: 'Pédagogie',
    email: 'm.elamrani@atlas.edu.ma',
    phone: '+212 6 61 23 45 67',
    hireDate: '2021-09-01',
    contractType: 'CDI',
    cnssNumber: '184920491',
    cimrNumber: 'CIMR-9042',
    status: 'active',
    workload: { assignedHours: 18, maxHours: 21, assignedClassesCount: 4 },
  },
  {
    id: 'emp-2',
    matricule: 'PERS-2025-002',
    fullName: 'Pr. Fatima Zahra Bennani',
    role: 'teacher',
    roleLabel: 'Professeure de Physique',
    department: 'Pédagogie',
    email: 'fz.bennani@atlas.edu.ma',
    phone: '+212 6 62 89 12 34',
    hireDate: '2022-09-01',
    contractType: 'CDI',
    cnssNumber: '193849102',
    status: 'active',
    workload: { assignedHours: 16, maxHours: 21, assignedClassesCount: 3 },
  },
  {
    id: 'emp-3',
    matricule: 'PERS-2025-003',
    fullName: 'Mme. Kenza Tazi',
    role: 'accountant',
    roleLabel: 'Comptable Principale',
    department: 'Administration & Finances',
    email: 'k.tazi@atlas.edu.ma',
    phone: '+212 6 64 56 78 90',
    hireDate: '2020-03-15',
    contractType: 'CDI',
    cnssNumber: '172839104',
    cimrNumber: 'CIMR-4011',
    status: 'active',
  },
  {
    id: 'emp-4',
    matricule: 'PERS-2025-004',
    fullName: 'M. Ahmed Berrada',
    role: 'guard',
    roleLabel: 'Chef de Poste Sécurité',
    department: 'Logistique & Sécurité',
    email: 'a.berrada@atlas.edu.ma',
    phone: '+212 6 63 11 22 33',
    hireDate: '2023-01-10',
    contractType: 'CDI',
    cnssNumber: '204918273',
    status: 'active',
  },
  {
    id: 'emp-5',
    matricule: 'PERS-2025-005',
    fullName: 'M. Hassan Mansouri',
    role: 'driver',
    roleLabel: 'Chauffeur Bus Scolaire',
    department: 'Logistique & Sécurité',
    email: 'h.mansouri@atlas.edu.ma',
    phone: '+212 6 65 99 88 77',
    hireDate: '2024-02-01',
    contractType: 'CDD',
    contractEnd: '2025-06-30',
    cnssNumber: '219384019',
    status: 'probation',
    medicalCheckExpiry: '2025-09-15',
  },
  {
    id: 'emp-6',
    matricule: 'PERS-2025-006',
    fullName: 'Mme. Salma Idrissi',
    role: 'receptionist',
    roleLabel: 'Chargée d\'Accueil & Admissions',
    department: 'Administration & Finances',
    email: 's.idrissi@atlas.edu.ma',
    phone: '+212 6 66 44 33 22',
    hireDate: '2023-09-01',
    contractType: 'CDI',
    cnssNumber: '198273645',
    status: 'active',
  },
];

export function PersonnelPlayground({ locale = 'fr' }: { locale?: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'standard' | 'variation-a' | 'variation-b' | 'variation-c'>('variation-a');

  const [employees, setEmployees] = useState<EmployeeItem[]>(DEFAULT_DEMO_PERSONNEL);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);

  // Compliance Hub subtab for Variation C
  const [complianceTab, setComplianceTab] = useState<'roster' | 'alerts' | 'payroll' | 'onboarding'>('roster');

  useEffect(() => {
    fetch('/api/hr/employees')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
          setEmployees(j.data.map((e: any, idx: number) => ({
            id: e.id || `emp-${idx}`,
            matricule: e.matricule || `PERS-2025-00${idx + 1}`,
            fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.fullName || 'Personnel',
            role: (e.role as any) || 'teacher',
            roleLabel: e.designation || 'Collaborateur',
            department: 'Pédagogie',
            email: e.email || 'staff@atlas.edu.ma',
            phone: e.phone || '+212 6 00 00 00 00',
            hireDate: e.joiningDate || '2023-09-01',
            contractType: 'CDI',
            cnssNumber: '184920491',
            status: 'active',
            workload: { assignedHours: 18, maxHours: 21, assignedClassesCount: 3 },
          })));
        }
      })
      .catch(() => {});
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchQuery = e.fullName.toLowerCase().includes(search.toLowerCase()) ||
        e.matricule.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = selectedRole === 'all' || e.role === selectedRole;
      return matchQuery && matchRole;
    });
  }, [employees, search, selectedRole]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Playground Header & Variation Switcher Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0EA5C4]/15 text-[#0EA5C4] border border-[#0EA5C4]/30">
                <Sparkles className="w-3.5 h-3.5" /> Design Exploration (Bucket 5 - §7.4)
              </span>
              <span className="text-xs font-semibold text-slate-400">Interactif · 3 Variations</span>
            </div>
            <h1 className="text-xl font-bold text-[#16212B] mt-1.5 tracking-tight">
              Annuaire du Personnel & Registre RH
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Explorez les 3 déclinaisons : Table Haute Densité & Inspecteur, Trombinoscope & Cartes d&apos;Équipe, et Hub Conformité & RH.
            </p>
          </div>

          {/* Interactive Variation Tabs */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('variation-a')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-a'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Var. A : Table Haute Densité & Inspecteur</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-b')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-b'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Var. B : Cartes d&apos;Équipe & Trombinoscope</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-c')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-c'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Var. C : Hub Conformité & Workflow RH</span>
            </button>
            <button
              onClick={() => setActiveTab('standard')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'standard'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Vue Standard</span>
            </button>
          </div>
        </div>
      </div>

      {/* VARIATION A: DIRECTORY-FIRST EVOLUTION (DATA-DENSE TABLE & INSPECTOR DRAWER) */}
      {activeTab === 'variation-a' && (
        <div className="space-y-4">
          {/* Filter Bar with Moroccan Role Chips */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {[
                { id: 'all', label: 'Tous les collaborateurs' },
                { id: 'teacher', label: 'Enseignants' },
                { id: 'accountant', label: 'Comptabilité & Finance' },
                { id: 'receptionist', label: 'Accueil & Admissions' },
                { id: 'guard', label: 'Surveillance & Sécurité' },
                { id: 'driver', label: 'Transport Scolaire' },
              ].map(chip => (
                <button
                  key={chip.id}
                  onClick={() => setSelectedRole(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs transition-all ${
                    selectedRole === chip.id
                      ? 'bg-[#2487B8] text-white font-bold shadow-xs'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 font-medium'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, matricule..."
                className="h-9 pl-9 text-xs rounded-xl border-slate-200"
              />
            </div>
          </div>

          {/* Main Grid: Data Table + Quick Inspector Slideout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className={`space-y-4 transition-all ${selectedEmployee ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3.5 text-left">Collaborateur</th>
                      <th className="p-3.5 text-left">Fonction & Pôle</th>
                      <th className="p-3.5 text-left">Contrat & CNSS</th>
                      <th className="p-3.5 text-center">Statut</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map(emp => {
                      const isSelected = selectedEmployee?.id === emp.id;

                      return (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedEmployee(emp)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#2487B8]/5' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#2487B8] font-bold flex items-center justify-center text-xs">
                                {emp.fullName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[#16212B]">{emp.fullName}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{emp.matricule}</p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <p className="font-semibold text-slate-800">{emp.roleLabel}</p>
                            <p className="text-[10px] text-slate-500">{emp.department}</p>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                {emp.contractType}
                              </span>
                              <span className="font-mono text-slate-400 text-[10px]">CNSS: {emp.cnssNumber}</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-none text-[10px]">
                              Actif
                            </Badge>
                          </td>

                          <td className="p-3.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); }}
                              className="h-7 text-xs font-semibold text-[#2487B8]"
                            >
                              Inspecter <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Inspector Sidepanel (Slideout) */}
            {selectedEmployee && (
              <div className="lg:col-span-4 sticky top-6">
                <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-md space-y-4">
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#2487B8] text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {selectedEmployee.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#16212B]">{selectedEmployee.fullName}</h3>
                        <p className="text-xs text-[#2487B8] font-medium">{selectedEmployee.roleLabel}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedEmployee(null)} className="text-slate-400 hover:text-slate-700 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Inspector Metadata List */}
                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200/60">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Matricule :</span>
                        <span className="font-mono font-bold text-slate-700">{selectedEmployee.matricule}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Date d&apos;embauche :</span>
                        <span className="font-semibold text-slate-700">{selectedEmployee.hireDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Contrat :</span>
                        <span className="font-bold text-[#2487B8]">{selectedEmployee.contractType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">N° CNSS :</span>
                        <span className="font-mono text-slate-700">{selectedEmployee.cnssNumber}</span>
                      </div>
                    </div>

                    {selectedEmployee.workload && (
                      <div className="p-3 bg-[#2487B8]/5 border border-[#2487B8]/20 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-[#2487B8] uppercase">Charge de cours hebdomadaire</span>
                        <div className="flex justify-between font-semibold">
                          <span>Volume horaire :</span>
                          <span className="text-slate-800">{selectedEmployee.workload.assignedHours}h / {selectedEmployee.workload.maxHours}h</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Groupes assignés :</span>
                          <span className="text-slate-800">{selectedEmployee.workload.assignedClassesCount} classes</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <a href={`tel:${selectedEmployee.phone}`} className="w-full flex items-center justify-center gap-2 p-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" /> {selectedEmployee.phone}
                      </a>
                      <a href={`mailto:${selectedEmployee.email}`} className="w-full flex items-center justify-center gap-2 p-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors truncate">
                        <Mail className="w-3.5 h-3.5 text-[#2487B8]" /> {selectedEmployee.email}
                      </a>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VARIATION B: VISUAL ROSTER & DEPARTMENT CARDS */}
      {activeTab === 'variation-b' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map(emp => (
              <Card key={emp.id} className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-[#2487B8] font-bold flex items-center justify-center text-sm">
                      {emp.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-[#16212B]">{emp.fullName}</h3>
                      <p className="text-[11px] text-slate-500">{emp.roleLabel}</p>
                    </div>
                  </div>
                  <Badge variant="neutral" className="text-[9px] font-mono">{emp.contractType}</Badge>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600">
                  <p className="flex justify-between"><span>Pôle :</span> <strong className="text-slate-800">{emp.department}</strong></p>
                  <p className="flex justify-between"><span>Matricule :</span> <strong className="font-mono text-slate-800">{emp.matricule}</strong></p>
                  {emp.workload && (
                    <p className="flex justify-between text-emerald-700"><span>Volume cours :</span> <strong>{emp.workload.assignedHours}h / sem.</strong></p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <a href={`tel:${emp.phone}`} className="flex-1 text-center py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                    Appeler
                  </a>
                  <a href={`mailto:${emp.email}`} className="flex-1 text-center py-1.5 rounded-lg bg-[#2487B8] text-[11px] font-bold text-white hover:bg-[#1B6C93]">
                    Contacter
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* VARIATION C: HR COMPLIANCE & WORKFLOW HUB */}
      {activeTab === 'variation-c' && (
        <div className="space-y-6">
          {/* Subtabs for Hub */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'roster', label: 'Effectif Global & Roster' },
              { id: 'alerts', label: 'Alertes & Renouvellements CDD' },
              { id: 'payroll', label: 'Déclarations CNSS & CIMR' },
              { id: 'onboarding', label: 'Pipeline Recrutement (3)' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setComplianceTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  complianceTab === tab.id
                    ? 'bg-[#16212B] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {complianceTab === 'roster' && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-[#16212B]">Registre Légal des Salariés (Loi 65-99 Code du Travail)</h3>
              <p className="text-xs text-slate-500">Conformité CNDP, matricules uniques et affiliation aux caisses de retraite.</p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Total Effectif</span>
                  <p className="text-2xl font-bold text-[#16212B] mt-1">{employees.length}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Contrats CDI</span>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{employees.filter(e => e.contractType === 'CDI').length}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">CDD / ANAPEC</span>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{employees.filter(e => e.contractType !== 'CDI').length}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Taux CNSS</span>
                  <p className="text-2xl font-bold text-[#2487B8] mt-1">100%</p>
                </div>
              </div>
            </Card>
          )}

          {complianceTab === 'alerts' && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Fin de Période d&apos;Essai & Visite Médicale — Hassan Mansouri</h4>
                  <p className="mt-0.5 text-amber-700">Contrat CDD expirant le 30 Juin 2025. Visite d&apos;aptitude médicale requise pour le permis transport.</p>
                </div>
              </div>
            </Card>
          )}

          {complianceTab === 'payroll' && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-[#16212B]">Déclarations Mensuelles CNSS (Damancom)</h3>
              <p className="text-xs text-slate-500">Téléchargement du fichier de télé-déclaration salariale conforme DGI & CNSS.</p>
              <Button size="sm" className="h-9 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl gap-2">
                <FileCheck className="w-4 h-4" /> Générer Fichier Damancom (TXT/EDI)
              </Button>
            </Card>
          )}

          {complianceTab === 'onboarding' && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-[#16212B]">Candidats & Nouvelles Recrues en Cours d&apos;Intégration</h3>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <p className="font-bold">Dr. Yassine El Fassi</p>
                    <p className="text-slate-400">Poste : Professeur d&apos;Informatique & Robotique · Entretien Validé</p>
                  </div>
                  <Badge className="bg-[#2487B8] text-white">Édition du contrat</Badge>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* STANDARD BASELINE VIEW */}
      {activeTab === 'standard' && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <EmployeeDirectoryView />
        </div>
      )}
    </div>
  );
}
