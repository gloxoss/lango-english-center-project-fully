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
  Users, Target, Filter, Plus, Search, Layers, CheckCircle2, Sliders, Play, Check, Edit
} from 'lucide-react';
import { AUDIENCE_SEGMENTS as INITIAL_SEGMENTS, AudienceSegmentItem } from '../data/audience-segments-config';

export function AudienceSegmentsClient({ locale: _locale }: { locale?: string }) {
  const [segments, setSegments] = useState(INITIAL_SEGMENTS);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const [newSegment, setNewSegment] = useState({
    segmentName: '',
    description: '',
    targetCount: 150,
  });

  const filteredSegments = useMemo(() => {
    return segments.filter((seg) =>
      seg.segmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seg.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [segments, searchQuery]);

  const activeSegment = useMemo(() => {
    return segments.find((s) => s.id === selectedSegmentId) || segments[0];
  }, [segments, selectedSegmentId]);

  const handleCreateSegment = () => {
    if (!newSegment.segmentName.trim()) return;
    const created: AudienceSegmentItem = {
      id: `seg-${Date.now()}`,
      segmentName: newSegment.segmentName,
      description: newSegment.description || 'Segment dynamique sur mesure',
      targetCount: newSegment.targetCount || 150,
      conditionCount: 2,
      lastUpdated: 'À l\'instant',
      status: 'Actif',
    };
    setSegments((prev) => [created, ...prev]);
    setSelectedSegmentId(created.id);
    setNewSegment({ segmentName: '', description: '', targetCount: 150 });
    setIsAddModalOpen(false);
    setFeedbackMsg(`Segment "${created.segmentName}" créé avec succès !`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Segmentation de l&apos;audience</h1>
          <p className="text-xs text-slate-500 mt-1">Créez des critères dynamiques pour cibler précisément vos campagnes de communication.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Créer un segment
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 5 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Total segments</p>
            <p className="text-xl font-extrabold text-[#16212B]">{segments.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">11 dynamiques</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Contacts segmentés</p>
            <p className="text-xl font-extrabold text-[#16212B]">3 420</p>
            <p className="text-[10px] font-semibold text-[#17A673]">94% de la base</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Mise à jour auto</p>
            <p className="text-xl font-extrabold text-[#16212B]">Temps réel</p>
            <p className="text-[10px] font-semibold text-slate-500">Synchro automatique</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Règles actives</p>
            <p className="text-xl font-extrabold text-[#16212B]">38</p>
            <p className="text-[10px] font-semibold text-amber-700">Conditions cumulées</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 shrink-0 flex items-center justify-center text-blue-700">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Utilisés dans campagnes</p>
            <p className="text-xl font-extrabold text-[#16212B]">9</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Campagnes actives</p>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Segments d&apos;audience enregistrés</h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un segment..."
                  className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Nom du segment</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-center">Taille ciblée</th>
                    <th className="pb-2 text-center">Conditions</th>
                    <th className="pb-2">Mise à jour</th>
                    <th className="pb-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSegments.map((seg) => (
                    <tr
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      className={`cursor-pointer transition-all ${
                        selectedSegmentId === seg.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 font-bold text-[#16212B] text-[11px]">{seg.segmentName}</td>
                      <td className="py-2.5 text-slate-500 text-[10px] max-w-[200px] truncate">{seg.description}</td>
                      <td className="py-2.5 text-center font-extrabold text-[#2487B8]">{seg.targetCount}</td>
                      <td className="py-2.5 text-center font-bold text-slate-700">{seg.conditionCount}</td>
                      <td className="py-2.5 text-[10px] text-slate-400 font-mono">{seg.lastUpdated}</td>
                      <td className="py-2.5">
                        <Badge className={`text-[9px] font-bold ${
                          seg.status === 'Actif' ? 'bg-[#DDF5EC] text-[#17A673] border-none' : 'bg-slate-100 text-slate-600 border-none'
                        }`}>{seg.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            {activeSegment ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[#16212B]">{activeSegment.segmentName}</h2>
                    <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{activeSegment.status}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">{activeSegment.description}</p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-400">Contacts éligibles :</span><span className="font-bold text-[#16212B]">{activeSegment.targetCount} contacts</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Conditions actives :</span><span className="font-bold text-[#2487B8]">{activeSegment.conditionCount} règles</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Dernière synchro :</span><span className="font-bold text-slate-600">{activeSegment.lastUpdated}</span></div>
                </div>

                <Button
                  onClick={() => {
                    setFeedbackMsg(`Édition des règles pour "${activeSegment.segmentName}"`);
                    setTimeout(() => setFeedbackMsg(null), 3000);
                  }}
                  className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] text-white hover:bg-[#1B6C93] flex items-center justify-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" /> Éditer les règles
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Aucun segment sélectionné.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Add Segment Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Créer un nouveau segment d&apos;audience</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom du segment *</label>
              <Input
                placeholder="ex: Parents Élèves Collège Maarif"
                value={newSegment.segmentName}
                onChange={(e) => setNewSegment({ ...newSegment, segmentName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description / Critères</label>
              <Input
                placeholder="ex: Contacts avec au moins 1 enfant inscrit en 1ère ou 2nde"
                value={newSegment.description}
                onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Taille estimée de l&apos;audience</label>
              <Input
                type="number"
                placeholder="150"
                value={newSegment.targetCount}
                onChange={(e) => setNewSegment({ ...newSegment, targetCount: Number(e.target.value) || 0 })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateSegment} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Enregistrer le segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

