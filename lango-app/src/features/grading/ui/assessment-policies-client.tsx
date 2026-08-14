'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Save, Scale, Trash2,
} from 'lucide-react';
import {
  EvaluationRule, MOCK_WEIGHTS, MOCK_SCALES,
} from '../data/assessment-policies-config';

export function AssessmentPoliciesClient({ locale: _locale }: { locale?: string } = {}) {
  const [cycle, setCycle] = useState('Secondaire Qualifiant (BAC)');
  const [rules, setRules] = useState<EvaluationRule[]>(MOCK_WEIGHTS);
  const [passingScore, setPassingScore] = useState<number>(10);
  const [eliminatoryScore, setEliminatoryScore] = useState<number>(5);

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', weight: '10', description: '' });

  const totalWeight = rules.reduce((acc, curr) => acc + curr.weight, 0);

  const handleRuleWeightChange = (id: string, newWeight: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, weight: Math.max(0, newWeight) } : r));
  };

  const handleAddRule = () => {
    if (!newRule.name.trim()) return;
    const created: EvaluationRule = {
      id: `r-${Date.now()}`,
      name: newRule.name.trim(),
      weight: Number(newRule.weight) || 10,
      description: newRule.description.trim() || 'Règle d\'évaluation complémentaire',
    };
    setRules(prev => [...prev, created]);
    setIsAddOpen(false);
    setNewRule({ name: '', weight: '10', description: '' });
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Politiques d&apos;Évaluation & Barèmes de Notation</h1>
          <p className="text-xs text-slate-500 mt-1">Configuration des coefficients de pondération, échelles de mention et règles de calcul des moyennes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs">
            <Save className="w-4 h-4" />
            <span>Enregistrer la politique</span>
          </Button>
        </div>
      </div>

      {/* Cycle Selector Bar */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">Cycle académique concerné:</span>
            <select
              value={cycle}
              onChange={e => setCycle(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-extrabold bg-white text-[#16212B]"
            >
              <option value="Secondaire Qualifiant (BAC)">Secondaire Qualifiant (BAC)</option>
              <option value="Collège">Collège (1AC - 3AC)</option>
              <option value="Primaire">Primaire</option>
            </select>
          </div>

          <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${
            totalWeight === 100 ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-[#FCE4E2] text-[#E5544B]'
          }`}>
            <Scale className="w-4 h-4" />
            <span>Pondération globale: {totalWeight}% / 100% {totalWeight === 100 ? '(Valide ✔)' : '(Invalide ❌)'}</span>
          </div>
        </div>
      </Card>

      {/* Main 12-col Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Weight Distribution */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#16212B]">Répartition des Coefficients par Modalité</h2>
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              variant="outline"
              className="h-8 text-xs font-bold rounded-xl border-slate-200 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#2487B8]" />
              <span>Ajouter une règle</span>
            </Button>
          </div>

          <div className="space-y-3">
            {rules.map(rule => (
              <Card key={rule.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-[#16212B]">{rule.name}</h3>
                  <p className="text-xs text-slate-400">{rule.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={rule.weight}
                      onChange={e => handleRuleWeightChange(rule.id, Number(e.target.value))}
                      className="w-16 h-9 text-xs font-extrabold text-center rounded-xl"
                    />
                    <span className="text-xs font-extrabold text-[#2487B8]">%</span>
                  </div>
                  <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-400 hover:text-rose-600 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Passing Thresholds Card */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider text-[10px]">Seuils de Réussite & Admissibilité</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Note minimale de passage (/20)</label>
                <Input
                  type="number"
                  value={passingScore}
                  onChange={e => setPassingScore(Number(e.target.value))}
                  className="h-9 text-xs rounded-xl font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Note éliminatoire (/20)</label>
                <Input
                  type="number"
                  value={eliminatoryScore}
                  onChange={e => setEliminatoryScore(Number(e.target.value))}
                  className="h-9 text-xs rounded-xl font-bold text-rose-600"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right 5 cols: Grade Scale Thresholds */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-sm font-extrabold text-[#16212B]">Échelle des Mentions & Seuil d&apos;Admissibilité</h2>
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="space-y-2">
              {MOCK_SCALES.map((scale, i) => (
                <div key={i} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${scale.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm w-8">{scale.letter}</span>
                    <span className="font-bold">{scale.label}</span>
                  </div>
                  <span className="font-mono font-extrabold">{scale.minScore} - {scale.maxScore} /20</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Ajouter une Règle Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#2487B8]" />
              Ajouter une règle de pondération
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Intitulé de la modalité *</label>
              <Input
                placeholder="Ex. Projets de Fin de Module"
                value={newRule.name}
                onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Pondération (%) *</label>
              <Input
                type="number"
                placeholder="10"
                value={newRule.weight}
                onChange={e => setNewRule({ ...newRule, weight: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Description / Modalités</label>
              <Input
                placeholder="Ex. Évaluation sur soutenance orale"
                value={newRule.description}
                onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleAddRule} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Ajouter la règle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
