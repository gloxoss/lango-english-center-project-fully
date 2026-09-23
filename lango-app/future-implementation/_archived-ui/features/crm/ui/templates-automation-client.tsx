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
  FileCode, Zap, Mail, MessageSquare, Smartphone, Plus, Search, Filter, CheckCircle2, Check, Edit
} from 'lucide-react';
import { MESSAGE_TEMPLATES as INITIAL_TEMPLATES, TemplateItem } from '../data/templates-automation-config';

export function TemplatesAutomationClient({ locale: _locale }: { locale?: string }) {
  const [templates, setTemplates] = useState<TemplateItem[]>(INITIAL_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const [newTemplate, setNewTemplate] = useState<{
    templateName: string;
    category: TemplateItem['category'];
    channel: TemplateItem['channel'];
    content: string;
  }>({
    templateName: '',
    category: 'Absences',
    channel: 'SMS',
    content: '',
  });

  const filteredTemplates = useMemo(() => {
    return templates.filter((tmpl) =>
      tmpl.templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tmpl.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tmpl.channel.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [templates, searchQuery]);

  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  const handleCreateTemplate = () => {
    if (!newTemplate.templateName.trim()) return;
    const created: TemplateItem = {
      id: `tmpl-${Date.now()}`,
      templateName: newTemplate.templateName,
      category: newTemplate.category,
      channel: newTemplate.channel,
      variableCount: 3,
      usageCount: 0,
      lastModified: 'À l\'instant',
      status: 'Actif',
    };
    setTemplates((prev) => [created, ...prev]);
    setSelectedTemplateId(created.id);
    setNewTemplate({ templateName: '', category: 'Absences', channel: 'SMS', content: '' });
    setIsAddModalOpen(false);
    setFeedbackMsg(`Modèle "${created.templateName}" créé avec succès !`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Modèles de messages &amp; Déclencheurs</h1>
          <p className="text-xs text-slate-500 mt-1">Standardisez vos communications et automatisez les envois selon des événements précis.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau modèle
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
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Total modèles</p>
            <p className="text-xl font-extrabold text-[#16212B]">{templates.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Modèles prêts à l&apos;emploi</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Règles automatiques</p>
            <p className="text-xl font-extrabold text-[#16212B]">12</p>
            <p className="text-[10px] font-semibold text-amber-700">Déclencheurs actifs</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Envois automatisés (30j)</p>
            <p className="text-xl font-extrabold text-[#16212B]">3 200</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Taux de succès 99,4%</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Canal le plus utilisé</p>
            <p className="text-xl font-extrabold text-[#16212B]">SMS</p>
            <p className="text-[10px] font-semibold text-slate-500">58% des envois</p>
          </div>
        </Card>

        <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 shrink-0 flex items-center justify-center text-blue-700">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Variables dynamiques</p>
            <p className="text-xl font-extrabold text-[#16212B]">15</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Disponibles</p>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Bibliothèque de modèles</h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un modèle..."
                  className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-xl w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase">
                    <th className="pb-2">Nom du modèle</th>
                    <th className="pb-2">Catégorie</th>
                    <th className="pb-2">Canal</th>
                    <th className="pb-2 text-center">Variables</th>
                    <th className="pb-2 text-center">Utilisations</th>
                    <th className="pb-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTemplates.map((tmpl) => (
                    <tr
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={`cursor-pointer transition-all ${
                        selectedTemplateId === tmpl.id ? 'bg-[#DCEBF4]/40 font-bold' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 font-bold text-[#16212B] text-[11px]">{tmpl.templateName}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{tmpl.category}</td>
                      <td className="py-2.5 text-slate-600 text-[11px]">{tmpl.channel}</td>
                      <td className="py-2.5 text-center font-bold text-[#2487B8]">{tmpl.variableCount}</td>
                      <td className="py-2.5 text-center font-extrabold text-[#16212B]">{tmpl.usageCount}</td>
                      <td className="py-2.5">
                        <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{tmpl.status}</Badge>
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
            {activeTemplate ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[#16212B]">{activeTemplate.templateName}</h2>
                    <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">{activeTemplate.channel}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Catégorie : {activeTemplate.category}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1">
                  <p className="font-mono text-[11px] leading-relaxed">
                    Bonjour {"{{parent_name}}"}, notification importante concernant {"{{student_name}}"}. Merci de consulter le portail.
                  </p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-400">Variables incluses :</span><span className="font-bold text-[#2487B8]">{activeTemplate.variableCount} variables</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Total utilisations :</span><span className="font-bold text-[#16212B]">{activeTemplate.usageCount} fois</span></div>
                </div>

                <Button
                  onClick={() => {
                    setFeedbackMsg(`Modification activée pour "${activeTemplate.templateName}"`);
                    setTimeout(() => setFeedbackMsg(null), 3000);
                  }}
                  className="w-full h-9 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white flex items-center justify-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" /> Modifier le modèle
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Aucun modèle sélectionné.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Add Template Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Créer un nouveau modèle de message</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom du modèle *</label>
              <Input
                placeholder="ex: Relance Frais de Scolarité"
                value={newTemplate.templateName}
                onChange={(e) => setNewTemplate({ ...newTemplate, templateName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Catégorie</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value as TemplateItem['category'] })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option value="Absences">Absences</option>
                  <option value="Notes">Notes</option>
                  <option value="Facturation">Facturation</option>
                  <option value="Événements">Événements</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Canal de diffusion</label>
                <select
                  value={newTemplate.channel}
                  onChange={(e) => setNewTemplate({ ...newTemplate, channel: e.target.value as TemplateItem['channel'] })}
                  className="w-full h-9 text-xs rounded-xl border border-slate-200 px-3 font-medium bg-white"
                >
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Contenu avec variables (ex: {"{{student_name}}"})</label>
              <textarea
                rows={3}
                placeholder="Bonjour {{parent_name}}, nous vous informons que..."
                value={newTemplate.content}
                onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateTemplate} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Enregistrer le modèle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

