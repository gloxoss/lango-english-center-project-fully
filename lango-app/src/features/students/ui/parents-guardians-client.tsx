'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Home, Search, Phone, Plus, X, Users, AlertTriangle, MapPin,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { HouseholdItem } from '../data/parents-guardians-config';

const RELATION_OPTIONS = ['Tous', 'Père', 'Mère', 'Tuteur légal', 'Parent'];

// ponytail: the "household" concept the original mock invented (grouped
// families with a second co-tutor, campus assignment, emergency contacts,
// communication prefs, billing card, interaction history) has no backing in
// the real schema - only individual guardians (guardians + guardianStudents)
// exist. This wires the real list + KPIs + inspector to only what's real;
// the fake sections that used to fill the rest of the inspector panel were
// removed rather than left running on fabricated data - see the linked full
// profile page (/students/parents/[id]) for the real per-guardian detail.
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
    city: '—',
    financialStatus: 'À jour',
    portalAccess: row.portalAccess,
    primaryTutorName: row.name,
    primaryAvatar: row.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    primaryTutorPhone: row.phone || '—',
    primaryTutorEmail: row.email || '—',
    primaryTutorRelation: row.relation || '—',
    children: row.linkedStudents.map(name => ({ name, gradeLevel: '—', classSection: '—' })),
  };
}

export function ParentsGuardiansClient({ locale }: { locale?: string } = {}) {
  const { can } = usePermissions();
  const [households, setHouseholds] = useState<HouseholdItem[]>([]);
  const [search, setSearch] = useState('');
  const [relationFilter, setRelationFilter] = useState('Tous');
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [newHousehold, setNewHousehold] = useState({
    familyName: '',
    primaryTutorName: '',
    primaryTutorPhone: '+212 6 ',
    primaryTutorEmail: '',
    address: 'Casablanca',
    occupation: '',
    emailOptIn: true,
    smsOptIn: true,
    preferredLanguage: '',
    childName: '',
    childClass: '2BAC-A',
  });

  const filtered = households.filter(h =>
    (relationFilter === 'Tous' || h.primaryTutorRelation.toLowerCase().includes(relationFilter.toLowerCase())) &&
    (h.familyName.toLowerCase().includes(search.toLowerCase()) ||
      h.primaryTutorName.toLowerCase().includes(search.toLowerCase()) ||
      h.primaryTutorPhone.includes(search))
  );

  const fetchHouseholds = async () => {
    try {
      const res = await fetch(`/api/students/parents?page=${page}&pageSize=${pageSize}`);
      const json = await res.json();
      if (json.success) {
        setHouseholds((json.data as ApiGuardian[]).map(fromApiGuardian));
        setTotal(json.total ?? 0);
      }
    } catch (e) {
      console.error('Failed to load guardians', e);
    }
  };

  useEffect(() => {
    fetchHouseholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

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
          occupation: newHousehold.occupation || undefined,
          emailOptIn: newHousehold.emailOptIn,
          smsOptIn: newHousehold.smsOptIn,
          preferredLanguage: newHousehold.preferredLanguage || undefined,
          linkedStudents: newHousehold.childName ? [newHousehold.childName] : [],
        }),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('API error creating guardian', json.message);
        return;
      }
      setIsAddOpen(false);
      setNewHousehold({ familyName: '', primaryTutorName: '', primaryTutorPhone: '+212 6 ', primaryTutorEmail: '', address: 'Casablanca', occupation: '', emailOptIn: true, smsOptIn: true, preferredLanguage: '', childName: '', childClass: '2BAC-A' });
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
        {can('guardians.manage') && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un tuteur</span>
            </Button>
          </div>
        )}
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
              value={relationFilter}
              onChange={e => setRelationFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]"
            >
              {RELATION_OPTIONS.map(r => <option key={r}>{r}</option>)}
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
                    <th className="py-3.5 px-4">Relation</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4 text-right">Accès portail</th>
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
                      <td className="py-3.5 px-4 text-slate-600 font-bold">{hh.primaryTutorRelation}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#16212B]">{hh.primaryTutorName}</p>
                        <p className="text-slate-400">{hh.primaryTutorPhone}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          hh.portalAccess ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'
                        }`}
                        >
                          {hh.portalAccess ? 'Actif' : 'Aucun compte'}
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
                <select
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#16212B]"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  sur {total} foyer{total > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Précédent
                </button>
                <span>Page {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Family Inspector Panel */}
        {selectedHousehold && (
          <div className="w-80 xl:w-96 shrink-0 space-y-3 sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
            <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Inspector Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-[#16212B]">{selectedHousehold.familyName}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedHousehold.portalAccess ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-slate-100 text-slate-500'}`}>
                    {selectedHousehold.portalAccess ? 'Accès portail actif' : 'Aucun compte'}
                  </span>
                </div>
                <button onClick={() => setSelectedHousehold(null)} className="text-slate-400 hover:text-slate-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">

                {/* Tuteur principal - real data only, no fabricated co-tutor */}
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Tuteur principal</p>
                  <div className="p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-xs shrink-0">
                        {selectedHousehold.primaryAvatar}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-[#16212B]">{selectedHousehold.primaryTutorName}</p>
                        <p className="text-[10px] text-slate-400">{selectedHousehold.primaryTutorRelation}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">{selectedHousehold.primaryTutorEmail}</p>
                    <p className="text-[10px] text-slate-500">{selectedHousehold.primaryTutorPhone}</p>
                  </div>
                </div>

                {/* Enfants liés */}
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Enfants liés ({selectedHousehold.children.length})</p>
                  {selectedHousehold.children.length === 0
                    ? <p className="text-[11px] text-slate-400">Aucun élève lié.</p>
                    : (
                        <div className="grid grid-cols-2 gap-2">
                          {selectedHousehold.children.map((child, i) => (
                            <div key={i} className="p-2.5 rounded-xl border border-slate-100 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-[10px] shrink-0">
                                  {child.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <p className="text-[10px] font-extrabold text-[#16212B] truncate">{child.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                </div>

                {/* Adresse - real field only */}
                {selectedHousehold.address !== '—' && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Adresse
                    </p>
                    <p className="text-xs text-slate-600">{selectedHousehold.address}</p>
                  </div>
                )}

                {/* Full profile - real tabs (Enfants liés / Informations, with edit) already built at /students/parents/[id] */}
                <a
                  href={`/${locale || 'fr'}/dashboard/students/parents/${selectedHousehold.id}`}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-full bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold transition-colors"
                >
                  Voir le profil complet
                </a>

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
              <label className="font-bold text-slate-700 block mb-1">Email</label>
              <Input
                type="email"
                placeholder="Ex. karim@example.com"
                value={newHousehold.primaryTutorEmail}
                onChange={e => setNewHousehold({ ...newHousehold, primaryTutorEmail: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
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
                <label className="font-bold text-slate-700 block mb-1">Profession</label>
                <Input
                  value={newHousehold.occupation}
                  onChange={e => setNewHousehold({ ...newHousehold, occupation: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Langue de communication</label>
                <select
                  value={newHousehold.preferredLanguage}
                  onChange={e => setNewHousehold({ ...newHousehold, preferredLanguage: e.target.value })}
                  className="h-9 w-full rounded-xl border border-slate-200 px-2 text-xs"
                >
                  <option value="">Par défaut</option>
                  <option value="fr">Français</option>
                  <option value="ar">Arabe</option>
                  <option value="en">Anglais</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 font-semibold text-slate-600">
                <input type="checkbox" checked={newHousehold.emailOptIn} onChange={e => setNewHousehold({ ...newHousehold, emailOptIn: e.target.checked })} className="rounded border-slate-300" />
                Email
              </label>
              <label className="flex items-center gap-1.5 font-semibold text-slate-600">
                <input type="checkbox" checked={newHousehold.smsOptIn} onChange={e => setNewHousehold({ ...newHousehold, smsOptIn: e.target.checked })} className="rounded border-slate-300" />
                SMS
              </label>
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
