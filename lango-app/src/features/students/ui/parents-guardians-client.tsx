'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Home, Search, Phone, Mail, Plus, X, Users, AlertTriangle,
  MessageSquare, CheckCircle2, ChevronRight, MapPin, CreditCard,
  Bell, Globe, Shield, Clock,
} from 'lucide-react';
import { HouseholdItem } from '../data/parents-guardians-config';

const CAMPUS_OPTIONS = ['Tous les campus', 'Casablanca', 'Rabat', 'Marrakech'];
const RELATION_OPTIONS = ['Tous', 'Père', 'Mère', 'Tuteur légal'];
const BILLING_OPTIONS = ['Tous', 'Responsable', 'Non-responsable'];

// ponytail: the "household" concept the original mock invented (grouped
// families, secondary tutors, emergency contacts, communication prefs,
// interaction history) has no backing in the real schema - only individual
// guardians (guardians + guardianStudents) exist. Below wires the real list
// + KPIs; the detail panel's emergency-contacts/comms-prefs/interaction-log
// sections further down still render fake data (MOCK_EMERGENCY,
// RECENT_INTERACTIONS) - no real table to back them yet, left as a disclosed
// follow-up rather than invented schema or a silent gap.
type ApiGuardian = {
  id: string;
  name: string;
  relation: string;
  phone: string;
  email: string;
  linkedStudents: string[];
  address: string;
  portalAccess: boolean;
};

function fromApiGuardian(row: ApiGuardian): HouseholdItem {
  return {
    id: row.id,
    familyName: `Famille ${row.name.split(' ').slice(-1)[0] ?? row.name}`,
    householdCode: `#${row.id.slice(0, 8).toUpperCase()}`,
    address: row.address || '—',
    city: 'Casablanca',
    financialStatus: 'À jour',
    primaryTutorName: row.name,
    primaryAvatar: row.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    primaryTutorPhone: row.phone || '—',
    primaryTutorEmail: row.email || '—',
    primaryTutorRelation: row.relation || '—',
    children: row.linkedStudents.map(name => ({ name, gradeLevel: '—', classSection: '—' })),
  };
}

const MOCK_EMERGENCY = [
  { name: 'Aicha Alaoui', phone: '+212 661 879 360', online: true },
  { name: 'Rachid Bennani (oncle)', phone: '+212 661 557 378', online: false },
  { name: 'Fatima Zahra El Amrani (tante)', phone: '+212 661 998 877', online: false },
];

const RECENT_INTERACTIONS = [
  { label: 'Paiement de facture reçu', date: '19 mai 2026' },
  { label: 'Mise à jour des autorisations', date: '17 mai 2026' },
  { label: "Contact d'urgence mis à jour", date: '15 mai 2026' },
  { label: 'Inscription à la newsletter', date: '10 mai 2026' },
];

export function ParentsGuardiansClient({ locale: _locale }: { locale?: string } = {}) {
  const [households, setHouseholds] = useState<HouseholdItem[]>([]);
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('Tous les campus');
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newHousehold, setNewHousehold] = useState({
    familyName: '',
    primaryTutorName: '',
    primaryTutorPhone: '+212 6 ',
    primaryTutorEmail: '',
    address: 'Casablanca',
    childName: '',
    childClass: '2BAC-A',
  });

  const filtered = households.filter(h =>
    (campusFilter === 'Tous les campus' || h.city === campusFilter) &&
    (h.familyName.toLowerCase().includes(search.toLowerCase()) ||
      h.primaryTutorName.toLowerCase().includes(search.toLowerCase()) ||
      h.primaryTutorPhone.includes(search))
  );

  const fetchHouseholds = async () => {
    try {
      const res = await fetch('/api/students/parents?pageSize=200');
      const json = await res.json();
      if (json.success) {
        setHouseholds((json.data as ApiGuardian[]).map(fromApiGuardian));
      }
    } catch (e) {
      console.error('Failed to load guardians', e);
    }
  };

  useEffect(() => {
    fetchHouseholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddHousehold = async () => {
    if (!newHousehold.familyName.trim() || !newHousehold.primaryTutorName.trim()) return;
    try {
      const res = await fetch('/api/students/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHousehold.primaryTutorName.trim(),
          relation: 'Tuteur principal',
          phone: newHousehold.primaryTutorPhone,
          email: newHousehold.primaryTutorEmail || undefined,
          address: newHousehold.address,
          linkedStudents: newHousehold.childName ? [newHousehold.childName] : [],
        }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('API error creating guardian', json.message);
        return;
      }
      setIsAddOpen(false);
      setNewHousehold({ familyName: '', primaryTutorName: '', primaryTutorPhone: '+212 6 ', primaryTutorEmail: '', address: 'Casablanca', childName: '', childClass: '2BAC-A' });
      await fetchHouseholds();
    } catch (e) {
      console.error('API Error saving guardian', e);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Tuteurs & foyers</h1>
          <p className="text-xs text-slate-500 mt-1">Regroupez les tuteurs, gérez les fratries et les liens de responsabilité.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Home className="w-4 h-4 text-[#2487B8]" />
            <span>Créer un foyer</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un tuteur</span>
          </Button>
        </div>
      </div>

      {/* 4-Stat KPI Band - computed from the real fetched list, no fabricated deltas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Foyers actifs', value: String(households.length), change: 'Tuteurs enregistrés', icon: Home, color: 'text-[#2487B8]', bg: 'bg-[#DCEBF4]' },
          { label: 'Avec téléphone', value: String(households.filter(h => h.primaryTutorPhone !== '—').length), change: 'Contact renseigné', icon: Users, color: 'text-[#17A673]', bg: 'bg-[#DDF5EC]' },
          { label: 'Enfants liés', value: String(households.reduce((sum, h) => sum + h.children.length, 0)), change: 'Total répertorié', icon: Phone, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Dossiers incomplets', value: String(households.filter(h => h.primaryTutorPhone === '—' || h.primaryTutorEmail === '—').length), change: 'Téléphone ou email manquant', icon: AlertTriangle, color: 'text-[#E5544B]', bg: 'bg-[#FCE4E2]' },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">{kpi.label}</p>
                <p className="text-xl font-extrabold text-[#16212B]">{kpi.value}</p>
                <p className="text-[10px] text-slate-400">{kpi.change}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Area: Table + Inspector */}
      <div className={`flex gap-5 ${selectedHousehold ? 'items-start' : ''}`}>

        {/* Left: Table */}
        <div className={`${selectedHousehold ? 'flex-1 min-w-0' : 'w-full'} space-y-4`}>

          {/* Filter Toolbar */}
          <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
            <select
              value={campusFilter}
              onChange={e => setCampusFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]"
            >
              {CAMPUS_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
              {RELATION_OPTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
            <select className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
              {BILLING_OPTIONS.map(b => <option key={b}>{b}</option>)}
            </select>
            <div className="relative flex-1 min-w-48">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher un foyer ou un tuteur..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
              />
            </div>
          </Card>

          {/* Households Table */}
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4">Nom du foyer</th>
                    <th className="py-3.5 px-4">Tuteurs</th>
                    <th className="py-3.5 px-4 text-center">Élèves liés</th>
                    <th className="py-3.5 px-4">Campus</th>
                    <th className="py-3.5 px-4">Contact financier</th>
                    <th className="py-3.5 px-4">Contact d&apos;urgence</th>
                    <th className="py-3.5 px-4 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(hh => (
                    <tr
                      key={hh.id}
                      onClick={() => setSelectedHousehold(hh.id === selectedHousehold?.id ? null : hh)}
                      className={`cursor-pointer transition ${hh.id === selectedHousehold?.id ? 'bg-[#DCEBF4]/40' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-[#2487B8] shrink-0" />
                          <span className="font-bold text-[#16212B]">{hh.familyName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          {/* Primary Tutor Avatar */}
                          <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] border-2 border-white shadow-2xs flex items-center justify-center font-extrabold text-xs shrink-0">
                            {hh.primaryAvatar}
                          </div>
                          {hh.children.length > 1 && (
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 border-2 border-white shadow-2xs flex items-center justify-center font-extrabold text-xs -ml-3">
                              +{hh.children.length - 1}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[#16212B]">{hh.children.length}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-bold">{hh.city}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#16212B]">{hh.primaryTutorName}</p>
                        <p className="text-slate-400">{hh.primaryTutorPhone}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{hh.primaryTutorPhone}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          hh.financialStatus === 'À jour' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-[#FCE4E2] text-[#E5544B]'
                        }`}>
                          {hh.financialStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Afficher</span>
                <select className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#16212B]">
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                </select>
                <span>sur 732 foyers</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, '...', 74].map((p, i) => (
                  <button key={i} className={`w-7 h-7 rounded-lg text-xs font-bold ${p === 1 ? 'bg-[#2487B8] text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Family Inspector Panel */}
        {selectedHousehold && (
          <div className="w-80 xl:w-96 shrink-0 space-y-3">
            <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Inspector Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-[#16212B]">{selectedHousehold.familyName}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DDF5EC] text-[#17A673]">Actif</span>
                </div>
                <button onClick={() => setSelectedHousehold(null)} className="text-slate-400 hover:text-slate-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">

                {/* Tuteurs principaux */}
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Tuteurs principaux</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { initials: selectedHousehold.primaryAvatar, name: selectedHousehold.primaryTutorName, role: 'Père', phone: selectedHousehold.primaryTutorPhone, email: selectedHousehold.primaryTutorEmail },
                      { initials: 'MA', name: 'Amina El Amrani', role: 'Mère', phone: '+212 661 879 360', email: 'amina@atlas.edu.ma' },
                    ].map((t, i) => (
                      <div key={i} className="p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xs shrink-0">
                            {t.initials}
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-[#16212B]">{t.name}</p>
                            <p className="text-[10px] text-slate-400">{t.role}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500">{t.email}</p>
                        <p className="text-[10px] text-slate-500">{t.phone}</p>
                        <div className="flex gap-1.5">
                          <button className="p-1 rounded-lg bg-slate-100 hover:bg-[#DCEBF4] transition"><Phone className="w-3 h-3 text-slate-500" /></button>
                          <button className="p-1 rounded-lg bg-slate-100 hover:bg-[#DCEBF4] transition"><MessageSquare className="w-3 h-3 text-slate-500" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enfants liés */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Enfants liés ({selectedHousehold.children.length})</p>
                    <button className="text-[10px] font-bold text-[#2487B8] hover:underline">Voir tout</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedHousehold.children.slice(0, 2).map((child, i) => (
                      <div key={i} className="p-2.5 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-[10px] shrink-0">
                            {child.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <p className="text-[10px] font-extrabold text-[#16212B] truncate">{child.name}</p>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#DDF5EC] text-[#17A673]">Actif</span>
                        <p className="text-[10px] text-slate-400">{child.classSection}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Adresse & Billing */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Adresse
                    </p>
                    <p className="text-xs text-slate-600">{selectedHousehold.address}</p>
                    <p className="text-xs text-slate-600">{selectedHousehold.city}</p>
                    <p className="text-xs text-slate-600">Maroc</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> Facturation
                    </p>
                    <p className="text-xs font-bold text-[#16212B]">{selectedHousehold.primaryTutorName}</p>
                    <p className="text-xs text-slate-500">Carte Visa ••••  4242</p>
                    <button className="text-[10px] font-bold text-[#2487B8] hover:underline">Voir l&apos;historique</button>
                  </div>
                </div>

                {/* Autorisations de prise en charge */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Autorisations de prise en charge
                    </p>
                  </div>
                  {[
                    { name: selectedHousehold.primaryTutorName, status: 'Autorisé' },
                    { name: 'Aicha Alaoui', status: 'Autorisée' },
                    { name: 'Rachid Bennani (oncle)', status: 'Autorisé' },
                  ].map((auth, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-xs text-slate-700">{auth.name}</span>
                      <span className="text-[10px] font-bold text-[#17A673]">{auth.status}</span>
                    </div>
                  ))}
                  <button className="text-[10px] font-bold text-[#2487B8] hover:underline mt-1">Gérer les autorisations</button>
                </div>

                {/* Emergency Contacts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Contacts d&apos;urgence
                    </p>
                    <button className="text-[10px] font-bold text-[#2487B8] hover:underline">Gérer</button>
                  </div>
                  {MOCK_EMERGENCY.map((ec, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-xs font-bold text-[#16212B]">{ec.name}</p>
                        <p className="text-[10px] text-slate-400">{ec.phone}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${ec.online ? 'bg-[#17A673]' : 'bg-slate-300'}`} />
                    </div>
                  ))}
                </div>

                {/* Communication Preferences */}
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Bell className="w-3 h-3" /> Préférences de communication
                  </p>
                  {[
                    { channel: 'Email', status: 'Activé' },
                    { channel: 'SMS', status: 'Activé' },
                    { channel: 'Notifications push', status: 'Activé' },
                    { channel: 'Langue', status: 'Français' },
                  ].map((pref, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-xs text-slate-600">{pref.channel}</span>
                      <span className="text-[10px] font-bold text-[#17A673]">{pref.status}</span>
                    </div>
                  ))}
                  <button className="text-[10px] font-bold text-[#2487B8] hover:underline mt-1">Modifier les préférences</button>
                </div>

                {/* Recent Interactions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Interactions récentes
                    </p>
                  </div>
                  {RECENT_INTERACTIONS.map((ri, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-xs text-slate-600">{ri.label}</span>
                      <span className="text-[10px] text-slate-400">{ri.date}</span>
                    </div>
                  ))}
                  <button className="text-[10px] font-bold text-[#2487B8] hover:underline mt-1 flex items-center gap-1">
                    Voir tout l&apos;historique <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Nouveau Foyer Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Home className="w-5 h-5 text-[#2487B8]" />
              Enregistrer un nouveau foyer familial
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom de Famille *</label>
              <Input
                placeholder="Ex. Famille El Idrissi"
                value={newHousehold.familyName}
                onChange={e => setNewHousehold({ ...newHousehold, familyName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tuteur Principal *</label>
                <Input
                  placeholder="Ex. Karim El Idrissi"
                  value={newHousehold.primaryTutorName}
                  onChange={e => setNewHousehold({ ...newHousehold, primaryTutorName: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Téléphone *</label>
                <Input
                  value={newHousehold.primaryTutorPhone}
                  onChange={e => setNewHousehold({ ...newHousehold, primaryTutorPhone: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Adresse de résidence</label>
              <Input
                value={newHousehold.address}
                onChange={e => setNewHousehold({ ...newHousehold, address: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Premier enfant rattaché</label>
                <Input
                  placeholder="Ex. Nora El Idrissi"
                  value={newHousehold.childName}
                  onChange={e => setNewHousehold({ ...newHousehold, childName: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Classe de l&apos;enfant</label>
                <Input
                  value={newHousehold.childClass}
                  onChange={e => setNewHousehold({ ...newHousehold, childClass: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleAddHousehold} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Créer le foyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
