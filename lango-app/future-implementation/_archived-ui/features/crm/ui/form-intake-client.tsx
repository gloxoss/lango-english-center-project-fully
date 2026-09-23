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
  FileText, ArrowRightLeft, Layers, TrendingUp, Plus, Search, Code, CheckCircle2, Check
} from 'lucide-react';
import { FORM_INTAKE_RECORDS as INITIAL_RECORDS, FormIntakeRecord } from '../data/form-intake-config';

export function FormIntakeClient({ locale: _locale }: { locale?: string }) {
  const [records, setRecords] = useState(INITIAL_RECORDS);
  const [selectedFormId, setSelectedFormId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAddFormModalOpen, setIsAddFormModalOpen] = useState(false);

  const [newForm, setNewForm] = useState<{
    formName: string;
    channel: FormIntakeRecord['channel'];
    assignedAgent: string;
  }>({
    formName: '',
    channel: 'Site web',
    assignedAgent: 'Équipe Admissions',
  });

  const filteredRecords = useMemo(() => {
    return records.filter((form) =>
      form.formName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.assignedAgent.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  const activeForm = useMemo(() => {
    return records.find((f) => f.id === selectedFormId) || records[0];
  }, [records, selectedFormId]);

  const handleCopyEmbed = (e: React.MouseEvent, formId: string, formName: string) => {
    e.stopPropagation();
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleCreateForm = () => {
    if (!newForm.formName.trim()) return;
    const created: FormIntakeRecord = {
      id: `form-${Date.now()}`,
      formName: newForm.formName,
      channel: newForm.channel,
      fieldCount: 6,
      totalSubmissions: 0,
      conversionRate: '0.0%',
      assignedAgent: newForm.assignedAgent,
      status: 'Actif',
    };
    setRecords((prev) => [created, ...prev]);
    setSelectedFormId(created.id);
    setNewForm({ formName: '', channel: 'Site web', assignedAgent: 'Équipe Admissions' });
    setIsAddFormModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Capture &amp; Routage des formulaires</h1>
          <p className="text-xs text-slate-500 mt-1">Créez et gérez vos formulaires d&apos;inscription, règles d&apos;attribution et webhooks.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsAddFormModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau formulaire
          </Button>
        </div>
      </div>

      {/* 5 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Formulaires actifs</p>
            <p className="text-xl font-extrabold text-[#16212B]">{records.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Tous opérationnels</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Soumissions ce mois</p>
            <p className="text-xl font-extrabold text-[#16212B]">1 138</p>
            <p className="text-[10px] font-semibold text-[#17A673]">📈 22% vs mois dernier</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Taux de conversion global</p>
            <p className="text-xl font-extrabold text-[#16212B]">31,2%</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Moyenne haute</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Règles de routage</p>
            <p className="text-xl font-extrabold text-[#16212B]">6</p>
            <p className="text-[10px] font-semibold text-amber-700">Attribution auto active</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 shrink-0 flex items-center justify-center text-blue-700">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Intégrations Webhook</p>
            <p className="text-xl font-extrabold text-[#16212B]">4</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Zapier &amp; Meta Connectés</p>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Liste des formulaires</h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un formulaire..."
                  className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Formulaire</th>
                    <th className="pb-2">Canal</th>
                    <th className="pb-2 text-center">Champs</th>
                    <th className="pb-2 text-center">Soumissions</th>
                    <th className="pb-2 text-center">Taux conversion</th>
                    <th className="pb-2">Attribution par défaut</th>
                    <th className="pb-2">Statut</th>
                    <th className="pb-2 text-right">Code HTML</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRecords.map((form) => (
                    <tr
                      key={form.id}
                      onClick={() => setSelectedFormId(form.id)}
                      className={`cursor-pointer transition-all ${
                        selectedFormId === form.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 font-bold text-[#16212B] text-[11px]">{form.formName}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{form.channel}</td>
                      <td className="py-2.5 text-center font-bold text-[#16212B]">{form.fieldCount}</td>
                      <td className="py-2.5 text-center font-extrabold text-[#2487B8]">{form.totalSubmissions}</td>
                      <td className="py-2.5 text-center font-extrabold text-emerald-700">{form.conversionRate}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{form.assignedAgent}</td>
                      <td className="py-2.5">
                        <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{form.status}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          onClick={(e) => handleCopyEmbed(e, form.id, form.formName)}
                          variant="outline"
                          size="sm"
                          className="h-6 text-[9px] font-bold border-slate-200 rounded-lg px-2 gap-1"
                        >
                          {copiedId === form.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" /> Copié !
                            </>
                          ) : (
                            <>
                              <Code className="w-3 h-3 text-[#2487B8]" /> Copier embed
                            </>
                          )}
                        </Button>
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
            {activeForm ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[#16212B]">{activeForm.formName}</h2>
                    <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{activeForm.status}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Canal principal : {activeForm.channel}</p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-400">Total soumissions :</span><span className="font-bold text-[#16212B]">{activeForm.totalSubmissions}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Taux de conversion :</span><span className="font-bold text-[#17A673]">{activeForm.conversionRate}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Nombre de champs :</span><span className="font-bold text-[#16212B]">{activeForm.fieldCount} champs</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Règle de routage :</span><span className="font-bold text-[#2487B8]">{activeForm.assignedAgent}</span></div>
                </div>

                <Button
                  onClick={(e) => handleCopyEmbed(e, activeForm.id, activeForm.formName)}
                  className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white flex items-center justify-center gap-1.5"
                >
                  <Code className="w-3.5 h-3.5" /> Copier l&apos;intégration HTML
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Aucun formulaire sélectionné.</p>
            )}
          </Card>
        </div>
      </div>

      {/* New Form Modal */}
      <Dialog open={isAddFormModalOpen} onOpenChange={setIsAddFormModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Créer un nouveau formulaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom du formulaire *</label>
              <Input
                placeholder="ex: Formulaire Journée Portes Ouvertes 2025"
                value={newForm.formName}
                onChange={(e) => setNewForm({ ...newForm, formName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Canal de diffusion</label>
                <select
                  value={newForm.channel}
                  onChange={(e) => setNewForm({ ...newForm, channel: e.target.value as FormIntakeRecord['channel'] })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option value="Site web">Site web</option>
                  <option value="Landing Page">Landing Page</option>
                  <option value="Facebook">Facebook</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Attribution par défaut</label>
                <select
                  value={newForm.assignedAgent}
                  onChange={(e) => setNewForm({ ...newForm, assignedAgent: e.target.value })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option>Équipe Admissions</option>
                  <option>Mme Sofia Bennani</option>
                  <option>M. Mehdi Alami</option>
                  <option>Round-Robin Automatique</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddFormModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateForm} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Créer et générer embed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

