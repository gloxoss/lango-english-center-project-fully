'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap, AlertCircle, CheckCircle2, Users, Search, ArrowRight,
  CheckSquare, Square, Sparkles, Layers, SlidersHorizontal, ArrowLeftRight,
  RotateCcw, ShieldCheck, Check, AlertTriangle, Filter, Award, ChevronRight
} from 'lucide-react';
import { PromotionsView } from './promotions-view';

type ApiStudent = {
  id: string;
  fullName: string;
  matricule: string | null;
  gpa?: number;
  decision?: 'promote' | 'repeat' | 'redirect' | 'review';
  behaviorScore?: number;
  hasUnpaidFees?: boolean;
};

type ApiClassSection = {
  id: string;
  className: string;
  sectionName: string;
  capacity?: number;
  enrolled?: number;
};

const DEFAULT_DEMO_STUDENTS: ApiStudent[] = [
  { id: 'p-std-1', fullName: 'Yasmine Benjelloun', matricule: 'ETU-2025-0042', gpa: 16.45, decision: 'promote', behaviorScore: 19, hasUnpaidFees: false },
  { id: 'p-std-2', fullName: 'Mehdi El Amrani', matricule: 'ETU-2025-0118', gpa: 14.80, decision: 'promote', behaviorScore: 18, hasUnpaidFees: false },
  { id: 'p-std-3', fullName: 'Kenza Tazi', matricule: 'ETU-2025-0095', gpa: 12.10, decision: 'promote', behaviorScore: 16, hasUnpaidFees: false },
  { id: 'p-std-4', fullName: 'Omar Berrada', matricule: 'ETU-2025-0210', gpa: 9.35, decision: 'repeat', behaviorScore: 14, hasUnpaidFees: true },
  { id: 'p-std-5', fullName: 'Salma Idrissi', matricule: 'ETU-2025-0304', gpa: 11.50, decision: 'promote', behaviorScore: 17, hasUnpaidFees: false },
  { id: 'p-std-6', fullName: 'Anas Bennani', matricule: 'ETU-2025-0155', gpa: 9.85, decision: 'review', behaviorScore: 15, hasUnpaidFees: false },
  { id: 'p-std-7', fullName: 'Hiba Mansouri', matricule: 'ETU-2025-0078', gpa: 15.90, decision: 'promote', behaviorScore: 19, hasUnpaidFees: false },
  { id: 'p-std-8', fullName: 'Karim Chaoui', matricule: 'ETU-2025-0288', gpa: 7.60, decision: 'repeat', behaviorScore: 12, hasUnpaidFees: false },
];

export function PromotionsPlayground({ locale = 'fr' }: { locale?: string }) {
  const [activeTab, setActiveTab] = useState<'standard' | 'variation-a' | 'variation-b' | 'variation-c'>('variation-a');

  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [students, setStudents] = useState<ApiStudent[]>(DEFAULT_DEMO_STUDENTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(DEFAULT_DEMO_STUDENTS.map(s => s.id)));
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Wizard (Variation A) step: 1: Source, 2: Criteria, 3: Target & Confirm
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [minGpaThreshold, setMinGpaThreshold] = useState<number>(10.0);

  useEffect(() => {
    fetch('/api/academics/class-sections?pageSize=100')
      .then(res => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setClassSections(json.data.map((cs: any) => ({
            ...cs,
            capacity: 32,
            enrolled: 26,
          })));
          setSourceId(json.data[0].id);
          setTargetId(json.data[1]?.id || json.data[0].id);
        } else {
          const fallback = [
            { id: 'sec-tc1', className: 'Tronc Commun Scientifique', sectionName: 'Groupe 1', capacity: 32, enrolled: 28 },
            { id: 'sec-1bac-a', className: '1ère Année Bac Sciences Ex', sectionName: 'Groupe A', capacity: 30, enrolled: 22 },
            { id: 'sec-1bac-b', className: '1ère Année Bac Sciences Ex', sectionName: 'Groupe B', capacity: 30, enrolled: 25 },
            { id: 'sec-2bac-sm', className: '2ème Année Bac Sciences Maths', sectionName: 'Groupe A', capacity: 28, enrolled: 20 },
          ];
          setClassSections(fallback);
          setSourceId(fallback[0]!.id);
          setTargetId(fallback[1]!.id);
        }
      })
      .catch(() => {});
  }, []);

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchPromote = () => {
    setSaving(true);
    setTimeout(() => {
      setSuccess(`${selectedIds.size} élèves ont été promus avec succès dans la classe cible.`);
      setSaving(false);
    }, 800);
  };

  const selectedTargetSection = useMemo(() => {
    return classSections.find(c => c.id === targetId);
  }, [classSections, targetId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Playground Header & Variation Switcher Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0EA5C4]/15 text-[#0EA5C4] border border-[#0EA5C4]/30">
                <Sparkles className="w-3.5 h-3.5" /> Design Exploration (Bucket 5 - §6.15)
              </span>
              <span className="text-xs font-semibold text-slate-400">Interactif · 3 Variations</span>
            </div>
            <h1 className="text-xl font-bold text-[#16212B] mt-1.5 tracking-tight">
              Assistant de Passage & Réinscription Annuelle
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparez les modèles de passage : Assistant par Étape, Espace Bi-Colonne, et Centre de Transition Annuelle.
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
              <span>Var. A : Assistant Guidé (3 Étapes)</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-b')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-b'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Var. B : Espace Bi-Colonne</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-c')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-c'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Var. C : Command Center Annuel</span>
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

      {success && (
        <div className="p-4 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl flex items-center justify-between text-[#17A673] text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSuccess(null)} className="h-7 text-xs bg-white">Fermer</Button>
        </div>
      )}

      {/* VARIATION A: STEP-BY-STEP FLOW */}
      {activeTab === 'variation-a' && (
        <div className="space-y-6">
          {/* Step Pill Header */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="grid grid-cols-3 gap-2">
              <div
                onClick={() => setWizardStep(1)}
                className={`p-2.5 rounded-xl cursor-pointer flex items-center gap-3 ${
                  wizardStep === 1 ? 'bg-[#2487B8]/10 border border-[#2487B8]/30 font-bold' : 'bg-slate-50'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  wizardStep === 1 ? 'bg-[#2487B8] text-white' : 'bg-slate-200 text-slate-600'
                }`}>1</div>
                <span className="text-xs text-[#16212B] truncate">1. Classe d&apos;Origine</span>
              </div>

              <div
                onClick={() => setWizardStep(2)}
                className={`p-2.5 rounded-xl cursor-pointer flex items-center gap-3 ${
                  wizardStep === 2 ? 'bg-[#2487B8]/10 border border-[#2487B8]/30 font-bold' : 'bg-slate-50'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  wizardStep === 2 ? 'bg-[#2487B8] text-white' : 'bg-slate-200 text-slate-600'
                }`}>2</div>
                <span className="text-xs text-[#16212B] truncate">2. Décision Pédagogique</span>
              </div>

              <div
                onClick={() => setWizardStep(3)}
                className={`p-2.5 rounded-xl cursor-pointer flex items-center gap-3 ${
                  wizardStep === 3 ? 'bg-[#2487B8]/10 border border-[#2487B8]/30 font-bold' : 'bg-slate-50'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  wizardStep === 3 ? 'bg-[#2487B8] text-white' : 'bg-slate-200 text-slate-600'
                }`}>3</div>
                <span className="text-xs text-[#16212B] truncate">3. Destination & Quotas</span>
              </div>
            </div>
          </Card>

          {wizardStep === 1 && (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-[#16212B]">Sélectionnez la classe source à traiter</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {classSections.map(cs => (
                  <div
                    key={cs.id}
                    onClick={() => setSourceId(cs.id)}
                    className={`p-4 rounded-xl border cursor-pointer ${
                      sourceId === cs.id ? 'border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]' : 'border-slate-200'
                    }`}
                  >
                    <p className="font-bold text-xs text-[#16212B]">{cs.className}</p>
                    <p className="text-[10px] text-slate-500">{cs.sectionName} · {cs.enrolled || 24} élèves inscrits</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-3">
                <Button onClick={() => setWizardStep(2)} className="h-9 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl gap-1">
                  Étape Suivante <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          )}

          {wizardStep === 2 && (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#16212B]">Matrice de Délibération Automatique</h3>
                  <p className="text-xs text-slate-500">Filtrer les élèves admis selon le seuil de moyenne générale.</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span>Seuil d&apos;admission :</span>
                  <Input
                    type="number"
                    value={minGpaThreshold}
                    onChange={e => setMinGpaThreshold(parseFloat(e.target.value) || 10)}
                    className="w-16 h-8 text-xs font-bold"
                  />
                  <span>/ 20</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="p-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === students.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(new Set(students.map(s => s.id)));
                            else setSelectedIds(new Set());
                          }}
                          className="rounded text-[#2487B8]"
                        />
                      </th>
                      <th className="p-3 text-left font-bold">Élève & Matricule</th>
                      <th className="p-3 text-center font-bold">Moyenne Générale</th>
                      <th className="p-3 text-center font-bold">Décision Proposée</th>
                      <th className="p-3 text-right font-bold">Frais</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map(s => {
                      const isPromoted = (s.gpa || 0) >= minGpaThreshold;
                      const isSelected = selectedIds.has(s.id);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudent(s.id)}
                              className="rounded text-[#2487B8]"
                            />
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-[#16212B]">{s.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{s.matricule}</p>
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            <span className={isPromoted ? 'text-emerald-700' : 'text-rose-700'}>
                              {s.gpa?.toFixed(2)} / 20
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {isPromoted ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 border-none text-[10px]">
                                Admis (Passage)
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/15 text-amber-700 border-none text-[10px]">
                                Redoublement / Commission
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {s.hasUnpaidFees ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Impayé</span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">À jour</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-3">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(1)} className="text-xs rounded-xl">Retour</Button>
                <Button onClick={() => setWizardStep(3)} className="h-9 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl gap-1">
                  Valider vers l&apos;Étape 3 <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          )}

          {wizardStep === 3 && (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-[#16212B]">Destination & Contrôle de Capacité</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Classe Cible</span>
                  <select
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    className="w-full h-10 mt-1 rounded-xl border border-slate-200 px-3 text-xs bg-white font-bold"
                  >
                    {classSections.map(cs => (
                      <option key={cs.id} value={cs.id}>{cs.className} ({cs.sectionName})</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-[#2487B8]/5 rounded-xl border border-[#2487B8]/20">
                  <span className="text-[10px] font-bold text-[#2487B8] uppercase">Impact Effectif</span>
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    {selectedIds.size} élèves à transférer vers {selectedTargetSection?.className} ({selectedTargetSection?.sectionName})
                  </p>
                  <p className="text-[11px] text-emerald-600 font-bold mt-1">Capacité vérifiée (OK)</p>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(2)} className="text-xs rounded-xl">Retour</Button>
                <Button
                  disabled={saving || selectedIds.size === 0}
                  onClick={handleBatchPromote}
                  className="h-10 px-6 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl gap-2 shadow-xs"
                >
                  <GraduationCap className="w-4 h-4" />
                  {saving ? 'Promotion en cours...' : 'Exécuter la Promotion Définitive'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* VARIATION B: DUAL-COLUMN WORKSPACE */}
      {activeTab === 'variation-b' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Liste Source (À Promouvoir)</h3>
                  <p className="text-[11px] text-slate-400">Cochez les élèves retenus pour la promotion.</p>
                </div>
                <Badge variant="neutral" className="text-[10px]">{selectedIds.size} sélectionné(s)</Badge>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {students.map(s => {
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected ? 'border-[#2487B8] bg-[#2487B8]/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-[#2487B8] text-white border-[#2487B8]' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#16212B]">{s.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.matricule}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-700">{s.gpa?.toFixed(2)}/20</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#2487B8]">Classe Cible & Quotas</h3>
                <Badge className="bg-[#2487B8] text-white text-[10px]">Cible</Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Classe d&apos;accueil</label>
                  <select
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs bg-white font-bold"
                  >
                    {classSections.map(cs => (
                      <option key={cs.id} value={cs.id}>{cs.className} ({cs.sectionName})</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Capacité max :</span>
                    <span className="font-bold text-slate-800">32 places</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Élèves ajoutés :</span>
                    <span className="font-bold text-[#2487B8]">+{selectedIds.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Statut de saturation :</span>
                    <span className="font-bold text-emerald-600">Conforme (90%)</span>
                  </div>
                </div>

                <Button
                  disabled={saving || selectedIds.size === 0}
                  onClick={handleBatchPromote}
                  className="w-full h-10 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2 shadow-xs"
                >
                  <GraduationCap className="w-4 h-4" />
                  Valider le Passage Immédiat
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* VARIATION C: WHOLE-SCHOOL ACADEMIC TRANSITION COMMAND CENTER */}
      {activeTab === 'variation-c' && (
        <div className="space-y-6">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-[#16212B]">Command Center — Transition Globale Année N vers N+1</h3>
                <p className="text-xs text-slate-500">Gérez le passage de l&apos;ensemble des niveaux en un clic.</p>
              </div>
              <Button
                onClick={handleBatchPromote}
                className="h-9 text-xs font-bold bg-[#16212B] hover:bg-slate-800 text-white rounded-xl gap-2 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Auto-Promouvoir Tous les Niveaux (&gt;= 10/20)
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Collège vers Lycée</span>
                <h4 className="text-xs font-bold text-slate-800">3ème AC → Tronc Commun</h4>
                <p className="text-[11px] text-emerald-600 font-semibold">48/52 élèves éligibles (92%)</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Troncs Communs</span>
                <h4 className="text-xs font-bold text-slate-800">TC Scientifique → 1ère Bac Sc. Ex</h4>
                <p className="text-[11px] text-emerald-600 font-semibold">54/58 élèves éligibles (93%)</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cycle Terminal</span>
                <h4 className="text-xs font-bold text-slate-800">1ère Bac → 2ème Bac (Baccalauréat)</h4>
                <p className="text-[11px] text-emerald-600 font-semibold">42/45 élèves éligibles (93%)</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* STANDARD BASELINE VIEW */}
      {activeTab === 'standard' && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <PromotionsView />
        </div>
      )}
    </div>
  );
}
