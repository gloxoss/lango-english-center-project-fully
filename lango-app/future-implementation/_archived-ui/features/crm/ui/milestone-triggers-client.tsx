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
  Cake, Sparkles, Zap, Smartphone, Plus, Search, CheckCircle2, Check, Edit
} from 'lucide-react';
import { MILESTONE_WORKFLOWS as INITIAL_WORKFLOWS, MilestoneWorkflowItem } from '../data/milestone-triggers-config';

export function MilestoneTriggersClient({ locale: _locale }: { locale?: string }) {
  const [workflows, setWorkflows] = useState(INITIAL_WORKFLOWS);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const [newWorkflow, setNewWorkflow] = useState<{
    workflowName: string;
    eventType: MilestoneWorkflowItem['eventType'];
    channel: MilestoneWorkflowItem['channel'];
  }>({
    workflowName: '',
    eventType: 'Anniversaire Élève',
    channel: 'WhatsApp',
  });

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) =>
      wf.workflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.channel.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [workflows, searchQuery]);

  const activeWorkflow = useMemo(() => {
    return workflows.find((w) => w.id === selectedWorkflowId) || workflows[0];
  }, [workflows, selectedWorkflowId]);

  const handleCreateWorkflow = () => {
    if (!newWorkflow.workflowName.trim()) return;
    const created: MilestoneWorkflowItem = {
      id: `wf-${Date.now()}`,
      workflowName: newWorkflow.workflowName,
      eventType: newWorkflow.eventType,
      channel: newWorkflow.channel,
      executionsThisMonth: 0,
      status: 'Actif',
    };
    setWorkflows((prev) => [created, ...prev]);
    setSelectedWorkflowId(created.id);
    setNewWorkflow({ workflowName: '', eventType: 'Anniversaire Élève', channel: 'WhatsApp' });
    setIsAddModalOpen(false);
    setFeedbackMsg(`Flux "${created.workflowName}" activé avec succès !`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Automation des Anniversaires &amp; Événements clés</h1>
          <p className="text-xs text-slate-500 mt-1">Configurez l&apos;envoi automatique de souhaits et félicitations personnalisés.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau flux d&apos;automatisation
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
          <div className="w-10 h-10 rounded-xl bg-pink-100 shrink-0 flex items-center justify-center text-pink-600">
            <Cake className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Anniversaires ce mois</p>
            <p className="text-xl font-extrabold text-[#16212B]">142</p>
            <p className="text-[10px] font-semibold text-[#17A673]">100% félicités 🎉</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Milestones célébrés</p>
            <p className="text-xl font-extrabold text-[#16212B]">242</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Niveau élevé d&apos;engagement</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Flux actifs</p>
            <p className="text-xl font-extrabold text-[#16212B]">{workflows.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Tous opérationnels</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Taux d&apos;ouverture</p>
            <p className="text-xl font-extrabold text-[#16212B]">96,4%</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Très forte appréciation</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Canal favori</p>
            <p className="text-xl font-extrabold text-[#16212B]">WhatsApp</p>
            <p className="text-[10px] font-semibold text-slate-500">Cartes animées</p>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Flux d&apos;automatisation enregistrés</h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un flux..."
                  className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Nom du flux</th>
                    <th className="pb-2">Événement déclencheur</th>
                    <th className="pb-2">Canal</th>
                    <th className="pb-2 text-center">Exécutions (mois)</th>
                    <th className="pb-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredWorkflows.map((wf) => (
                    <tr
                      key={wf.id}
                      onClick={() => setSelectedWorkflowId(wf.id)}
                      className={`cursor-pointer transition-all ${
                        selectedWorkflowId === wf.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 font-bold text-[#16212B] text-[11px]">{wf.workflowName}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{wf.eventType}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{wf.channel}</td>
                      <td className="py-2.5 text-center font-extrabold text-[#2487B8]">{wf.executionsThisMonth}</td>
                      <td className="py-2.5">
                        <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{wf.status}</Badge>
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
            {activeWorkflow ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[#16212B]">{activeWorkflow.workflowName}</h2>
                    <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{activeWorkflow.channel}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Événement : {activeWorkflow.eventType}</p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-400">Total exécutions ce mois :</span><span className="font-bold text-[#16212B]">{activeWorkflow.executionsThisMonth} envois</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Statut du flux :</span><span className="font-bold text-emerald-700">{activeWorkflow.status}</span></div>
                </div>

                <Button
                  onClick={() => {
                    setFeedbackMsg(`Édition du flux "${activeWorkflow.workflowName}"`);
                    setTimeout(() => setFeedbackMsg(null), 3000);
                  }}
                  className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] text-white hover:bg-[#1B6C93] flex items-center justify-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" /> Éditer le template &amp; règles
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Aucun flux sélectionné.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Add Workflow Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Créer un nouveau flux d&apos;automatisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom du flux *</label>
              <Input
                placeholder="ex: Célébration 1 An d'Ancienneté Enseignant"
                value={newWorkflow.workflowName}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, workflowName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Événement déclencheur</label>
                <select
                  value={newWorkflow.eventType}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, eventType: e.target.value as MilestoneWorkflowItem['eventType'] })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option value="Anniversaire Élève">Anniversaire Élève</option>
                  <option value="Ancienneté Collaborateur">Ancienneté Collaborateur</option>
                  <option value="Félicitations Examen">Félicitations Examen</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Canal de diffusion</label>
                <select
                  value={newWorkflow.channel}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, channel: e.target.value as MilestoneWorkflowItem['channel'] })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateWorkflow} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Activer le flux
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

