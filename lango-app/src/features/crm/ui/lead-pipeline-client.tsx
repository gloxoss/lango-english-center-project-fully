'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Users, UserCheck, Calendar, TrendingUp, Filter, Plus, CheckCircle2, Clock, Globe, Search, ArrowRight
} from 'lucide-react';
import { KANBAN_COLUMNS as INITIAL_COLUMNS, PriorityLevel, LeadCardItem } from '../data/lead-pipeline-config';

function getPriorityBadge(p: PriorityLevel) {
  switch (p) {
    case 'Haute': return 'bg-rose-100 text-rose-700 border-none';
    case 'Moyenne': return 'bg-amber-100 text-amber-700 border-none';
    case 'Basse': return 'bg-[#DCEBF4] text-[#1B6C93] border-none';
  }
}

export function LeadPipelineClient({ locale: _locale }: { locale?: string }) {
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('Tous les campus');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  // New lead form state
  const [newLead, setNewLead] = useState({
    name: '',
    grade: 'Maternelle',
    campus: 'Campus Principal',
    parentName: '',
    phone: '',
    email: '',
    priority: 'Moyenne' as PriorityLevel,
  });

  // Find currently selected lead across all columns
  const selectedLeadWithCol = useMemo(() => {
    for (const col of columns) {
      const found = col.leads.find((l) => l.id === selectedLeadId);
      if (found) return { lead: found, column: col };
    }
    // Fallback to first lead in first column if present
    const firstCol = columns[0];
    const firstLead = firstCol?.leads[0];
    return { lead: firstLead, column: firstCol };
  }, [columns, selectedLeadId]);

  const activeLead = selectedLeadWithCol.lead;
  const activeCol = selectedLeadWithCol.column;

  // Filter leads based on search and campus
  const filteredColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      leads: col.leads.filter((l) => {
        const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.grade.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCampus = selectedCampus === 'Tous les campus' || l.campus === selectedCampus;
        return matchesSearch && matchesCampus;
      }),
    }));
  }, [columns, searchQuery, selectedCampus]);

  const handleAddLead = () => {
    if (!newLead.name.trim()) return;
    const created: LeadCardItem = {
      id: `lead-${Date.now()}`,
      name: newLead.name,
      grade: newLead.grade,
      campus: newLead.campus,
      source: 'Direct Admin',
      priority: newLead.priority,
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      assigned: 'YB',
    };

    setColumns((prev) =>
      prev.map((col, idx) =>
        idx === 0
          ? { ...col, count: col.count + 1, leads: [created, ...col.leads] }
          : col
      )
    );
    setSelectedLeadId(created.id);
    setNewLead({
      name: '',
      grade: 'Maternelle',
      campus: 'Campus Principal',
      parentName: '',
      phone: '',
      email: '',
      priority: 'Moyenne',
    });
    setIsAddModalOpen(false);
  };

  const handleMoveLead = (targetColId: string) => {
    if (!activeLead) return;
    setColumns((prev) => {
      let movedItem: LeadCardItem | null = null;

      // Remove from source
      const cleaned = prev.map((col) => {
        const item = col.leads.find((l) => l.id === activeLead.id);
        if (item) {
          movedItem = item;
          return {
            ...col,
            count: col.count - 1,
            leads: col.leads.filter((l) => l.id !== activeLead.id),
          };
        }
        return col;
      });

      // Insert into target
      if (!movedItem) return prev;
      return cleaned.map((col) => {
        if (col.id === targetColId) {
          return {
            ...col,
            count: col.count + 1,
            leads: [movedItem!, ...col.leads],
          };
        }
        return col;
      });
    });
    setIsMoveModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Pipeline des prospects</h1>
          <p className="text-xs text-slate-500 mt-1">Suivez les leads, leur progression et les prochaines actions commerciales.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un prospect..."
              className="pl-8 h-9 text-xs bg-white border-slate-200 rounded-xl w-48 font-medium"
            />
          </div>
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-[#16212B] h-9 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
          >
            <option>Tous les campus</option>
            <option>Campus Principal</option>
            <option>Campus Anfa</option>
            <option>Campus Agdal</option>
          </select>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter un prospect
          </Button>
        </div>
      </div>

      {/* 5 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Nouveaux leads</p>
            <p className="text-xl font-extrabold text-[#16212B]">128</p>
            <p className="text-[10px] font-semibold text-[#17A673]">vs mois dernier 📈 18%</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Prospects qualifiés</p>
            <p className="text-xl font-extrabold text-[#16212B]">82</p>
            <p className="text-[10px] font-semibold text-[#17A673]">vs mois dernier 📈 12%</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Visites planifiées</p>
            <p className="text-xl font-extrabold text-[#16212B]">37</p>
            <p className="text-[10px] font-semibold text-[#17A673]">vs mois dernier 📈 5%</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Taux de conversion</p>
            <p className="text-xl font-extrabold text-[#16212B]">21,4%</p>
            <p className="text-[10px] font-semibold text-[#17A673]">vs mois dernier 📈 3.2 pts</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 shrink-0 flex items-center justify-center text-blue-700">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Sources actives</p>
            <p className="text-xl font-extrabold text-[#16212B]">9</p>
            <p className="text-[10px] font-semibold text-slate-500">vs mois dernier ➔ 0</p>
          </div>
        </Card>
      </div>

      {/* Kanban Board (8 cols) & Right Inspector (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 overflow-x-auto">
          <div className="grid grid-cols-5 gap-3 min-w-[900px]">
            {filteredColumns.map((col) => (
              <div key={col.id} className="space-y-3 bg-slate-100/60 p-2.5 rounded-2xl border border-slate-200/60">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#16212B]">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span>{col.title}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400 bg-white px-1.5 py-0.5 rounded-full border border-slate-200">{col.leads.length}</span>
                </div>

                <div className="space-y-2 min-h-[120px]">
                  {col.leads.map((lead) => (
                    <Card
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`p-3 bg-white rounded-xl border cursor-pointer transition-all space-y-2 ${
                        selectedLeadId === lead.id ? 'border-[#2487B8] ring-2 ring-[#2487B8]/20 shadow-md' : 'border-slate-200/80 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-extrabold text-[#16212B] text-xs">{lead.name}</p>
                        {selectedLeadId === lead.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#2487B8]" />}
                      </div>

                      <div className="text-[10px] text-slate-500 space-y-0.5">
                        <p><strong className="text-slate-700">Grade recherché :</strong> {lead.grade}</p>
                        <p><strong className="text-slate-700">Campus :</strong> {lead.campus}</p>
                        {lead.visitDate && <p className="text-amber-700 font-bold">🗓️ Visite : {lead.visitDate}</p>}
                        {lead.dossierDate && <p className="text-purple-700 font-bold">📄 Dossier : {lead.dossierDate}</p>}
                        {lead.enrollmentDate && <p className="text-[#17A673] font-bold">✓ Inscrit le : {lead.enrollmentDate}</p>}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">{lead.source}</span>
                          <span className="w-5 h-5 rounded-full bg-[#DCEBF4] text-[#1B6C93] font-extrabold flex items-center justify-center text-[8px]">{lead.assigned}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-[8px] font-bold ${getPriorityBadge(lead.priority)}`}>{lead.priority}</Badge>
                          <span className="text-slate-400 font-mono">{lead.date}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-[11px] font-bold text-[#2487B8] hover:bg-[#DCEBF4]/50 justify-start px-2 gap-1 rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter un prospect
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Lead Inspector */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            {activeLead ? (
              <>
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-[#16212B]">{activeLead.name}</h2>
                      <Badge className={`font-bold text-[9px] ${getPriorityBadge(activeLead.priority)}`}>{activeLead.priority}</Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Étape : {activeCol?.title} • Ajouté le {activeLead.date}</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-[#16212B] text-[11px]">Détails du prospect</h3>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-slate-400">Niveau recherché :</span><span className="font-bold text-[#16212B]">{activeLead.grade}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Campus :</span><span className="font-bold text-[#16212B]">{activeLead.campus}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Source :</span><span className="font-bold text-[#2487B8]">{activeLead.source}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Responsable :</span><span className="font-bold text-[#16212B]">{activeLead.assigned}</span></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-extrabold text-[#16212B] text-[11px]">Informations contact</h3>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-slate-400">Parents :</span><span className="font-bold text-[#16212B]">Famille {activeLead.name.split(' ').pop()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Téléphone :</span><span className="font-bold text-[#2487B8]">+212 6 61 88 99 00</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Email :</span><span className="font-bold text-[#2487B8]">prospect@lango.ma</span></div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setIsMoveModalOpen(true)}
                  className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white flex items-center justify-center gap-1.5"
                >
                  Changer l&apos;étape du prospect <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Aucun prospect sélectionné.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Add Lead Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Ajouter un nouveau prospect</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom complet de l&apos;élève *</label>
              <Input
                placeholder="ex: Amina Tazi"
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Niveau recherché</label>
                <select
                  value={newLead.grade}
                  onChange={(e) => setNewLead({ ...newLead, grade: e.target.value })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option>Maternelle</option>
                  <option>CP Primaire</option>
                  <option>CE1 Primaire</option>
                  <option>1ère Année Collège</option>
                  <option>2BAC Lycée</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Priorité</label>
                <select
                  value={newLead.priority}
                  onChange={(e) => setNewLead({ ...newLead, priority: e.target.value as PriorityLevel })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option value="Haute">Haute</option>
                  <option value="Moyenne">Moyenne</option>
                  <option value="Basse">Basse</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Campus principal</label>
              <select
                value={newLead.campus}
                onChange={(e) => setNewLead({ ...newLead, campus: e.target.value })}
                className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
              >
                <option>Campus Principal</option>
                <option>Campus Anfa</option>
                <option>Campus Agdal</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleAddLead} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Créer le prospect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Lead Dialog */}
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Déplacer {activeLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <p className="text-xs text-slate-500 mb-3">Sélectionnez la nouvelle étape dans le pipeline :</p>
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => handleMoveLead(col.id)}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                  activeCol?.id === col.id ? 'border-[#2487B8] bg-[#DCEBF4]/40 text-[#1B6C93]' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <span>{col.title}</span>
                </div>
                {activeCol?.id === col.id && <span className="text-[10px] bg-[#2487B8] text-white px-2 py-0.5 rounded-full">Actuel</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

