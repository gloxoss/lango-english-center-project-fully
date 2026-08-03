'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Users, Phone, Search, Filter, Plus, ChevronLeft, ChevronRight, Mail, Shield, UserPlus, Loader2, X, Link as LinkIcon, ExternalLink,
} from 'lucide-react';
import { Guardian } from '../model/types';

type StudentOption = { id: string; name: string; matricule?: string };

export function ParentsGuardiansView({ locale: _locale }: { locale: string }) {
  const router = useRouter();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<number | null>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [relationFilter, setRelationFilter] = useState('all');

  // Add Guardian Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newGuardian, setNewGuardian] = useState({
    name: '',
    relation: 'Père',
    phone: '',
    email: '',
    address: 'Casablanca',
  });

  // Link Student Modal
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [targetGuardian, setTargetGuardian] = useState<Guardian | null>(null);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [linkRelation, setLinkRelation] = useState('Parent');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadGuardians = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students/parents?pageSize=100');
      if (res.ok) {
        const json = await res.json();
        setGuardians(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load parents data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuardians();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students?pageSize=100');
      if (res.ok) {
        const json = await res.json();
        setStudentOptions(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch student options', err);
    }
  };

  const filtered = guardians.filter(g => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (g.name ?? '').toLowerCase().includes(term) ||
      (g.email ?? '').toLowerCase().includes(term) ||
      (g.phone ?? '').toLowerCase().includes(term);
    const matchesRelation = relationFilter === 'all' || g.relation === relationFilter;
    return matchesSearch && matchesRelation;
  });

  const sel = selectedContact !== null && filtered[selectedContact] ? filtered[selectedContact] : null;

  const handleAddGuardian = async () => {
    if (!newGuardian.name.trim() || !newGuardian.phone.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/students/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGuardian.name,
          relation: newGuardian.relation,
          phone: newGuardian.phone,
          email: newGuardian.email || undefined,
          address: newGuardian.address,
        }),
      });
      if (res.ok) {
        setIsAddOpen(false);
        setNewGuardian({ name: '', relation: 'Père', phone: '', email: '', address: 'Casablanca' });
        loadGuardians();
      }
    } catch (e) {
      console.error('API Error adding parent', e);
    } finally {
      setSaving(false);
    }
  };

  const openLinkModal = (g: Guardian) => {
    setTargetGuardian(g);
    setSelectedStudentId('');
    setLinkRelation('Parent');
    setLinkError(null);
    setIsLinkOpen(true);
    fetchStudents();
  };

  const handleLinkStudent = async () => {
    if (!targetGuardian || !selectedStudentId) return;
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch('/api/students/parents/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guardianId: targetGuardian.id,
          studentId: selectedStudentId,
          relationshipType: linkRelation,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Erreur lors de la liaison');
      }
      setIsLinkOpen(false);
      loadGuardians();
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'Erreur lors de la liaison');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      <div className="flex-1 space-y-6 min-w-0">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Parents & Tuteurs Tuteurs</h1>
            <p className="text-xs text-slate-500 mt-1">Gestion des fiches de contact des parents et tuteurs légaux</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-medium gap-2 h-9 px-3 rounded-lg"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau tuteur</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher nom, téléphone, email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            <Select value={relationFilter} onValueChange={setRelationFilter}>
              <SelectTrigger className="w-36 text-xs h-9">
                <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
                <SelectValue placeholder="Lien de parenté" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les liens</SelectItem>
                <SelectItem value="Père">Père</SelectItem>
                <SelectItem value="Mère">Mère</SelectItem>
                <SelectItem value="Tuteur">Tuteur légal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filtered.length} contact{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Directory List */}
        <Card className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#2487B8]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Aucun tuteur trouvé. Cliquez sur « Nouveau tuteur » pour en ajouter un.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Nom du tuteur</th>
                    <th className="py-3 px-3">Lien</th>
                    <th className="py-3 px-3">Téléphone</th>
                    <th className="py-3 px-3">Élèves associés</th>
                    <th className="py-3 px-3">Accès Portail</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filtered.map((g, idx) => (
                    <tr
                      key={g.id}
                      onClick={() => setSelectedContact(idx)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        selectedContact === idx ? 'bg-slate-50/80' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-bold text-xs flex items-center justify-center">
                            {g.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{g.name}</p>
                            <p className="text-[10px] text-slate-400">{g.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="neutral" className="text-[10px] font-semibold">
                          {g.relation}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">{g.phone}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {g.linkedStudents && g.linkedStudents.length > 0 ? (
                            g.linkedStudents.map((st, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                                {st}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Aucun élève lié</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.portalAccess ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {g.portalAccess ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1 text-[#2487B8] hover:text-[#1B6C93]"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLinkModal(g);
                          }}
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span>Lier un élève</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1 text-slate-600 hover:text-[#16212B]"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/${_locale}/dashboard/students/parents/${g.id}`);
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Profil</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Selected Contact Details Sidebar */}
      {sel && (
        <div className="w-80 space-y-4">
          <Card className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-bold text-base flex items-center justify-center">
                {sel.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{sel.name}</h3>
                <p className="text-xs text-slate-500">{sel.relation}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono">{sel.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{sel.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>Accès Portail: {sel.portalAccess ? 'Autorisé' : 'Non autorisé'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-700 mb-2">Élèves sous responsabilité:</p>
              <div className="space-y-1">
                {sel.linkedStudents && sel.linkedStudents.length > 0 ? (
                  sel.linkedStudents.map((st, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                      <span className="font-medium text-slate-800">{st}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">Aucun élève lié pour le moment.</p>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full mt-3 text-xs gap-2 h-8 rounded-lg border-slate-200"
                onClick={() => openLinkModal(sel)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Associer un nouvel élève</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Create Guardian */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Ajouter un tuteur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom complet *</label>
              <Input
                placeholder="ex: Youssef Bennani"
                value={newGuardian.name}
                onChange={e => setNewGuardian({ ...newGuardian, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Lien de parenté</label>
              <Select value={newGuardian.relation} onValueChange={val => setNewGuardian({ ...newGuardian, relation: val })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Père">Père</SelectItem>
                  <SelectItem value="Mère">Mère</SelectItem>
                  <SelectItem value="Tuteur">Tuteur légal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Téléphone *</label>
              <Input
                placeholder="+212 600-000000"
                value={newGuardian.phone}
                onChange={e => setNewGuardian({ ...newGuardian, phone: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Email</label>
              <Input
                placeholder="parent@email.com"
                value={newGuardian.email}
                onChange={e => setNewGuardian({ ...newGuardian, email: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>Annuler</Button>
            <Button size="sm" className="bg-[#2487B8] text-white hover:bg-[#1B6C93]" onClick={handleAddGuardian} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Link Student */}
      {isLinkOpen && targetGuardian && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-[#0F172A]">
                Lier un élève à {targetGuardian.name}
              </h2>
              <button onClick={() => setIsLinkOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Sélectionner un élève <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Choisir un élève dans l&apos;annuaire…</option>
                  {studentOptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.matricule ? `(${s.matricule})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Relation spécifique
                </label>
                <select
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 bg-white text-[#0F172A] font-medium"
                  value={linkRelation}
                  onChange={e => setLinkRelation(e.target.value)}
                >
                  <option value="Père">Père</option>
                  <option value="Mère">Mère</option>
                  <option value="Tuteur">Tuteur légal</option>
                  <option value="Oncle/Tante">Oncle/Tante</option>
                  <option value="Grand-parent">Grand-parent</option>
                </select>
              </div>

              {linkError && (
                <p className="text-[11px] text-red-600 font-medium">{linkError}</p>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setIsLinkOpen(false)} className="text-xs h-9 rounded-xl" disabled={linking}>
                  Annuler
                </Button>
                <Button
                  onClick={handleLinkStudent}
                  disabled={linking || !selectedStudentId}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 rounded-xl gap-2"
                >
                  {linking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lier l&apos;élève
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
