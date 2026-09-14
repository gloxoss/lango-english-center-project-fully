'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap, AlertCircle, CheckCircle2, Users, Search, ArrowRight,
  Check, ArrowLeftRight, RotateCcw, SlidersHorizontal, CheckSquare, Square
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

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

export function PromotionsPlayground({ locale: _locale = 'fr' }: { locale?: string }) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');

  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [students, setStudents] = useState<ApiStudent[]>(DEFAULT_DEMO_STUDENTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(DEFAULT_DEMO_STUDENTS.map(s => s.id)));
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [minGpaThreshold, setMinGpaThreshold] = useState<number>(10.0);

  useEffect(() => {
    fetch('/api/academics/class-sections?pageSize=100')
      .then(res => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const sections = json.data.map((cs: any) => ({
            ...cs,
            capacity: cs.maxStudents || 32,
            enrolled: cs.enrolledCount || 0,
          }));
          setClassSections(sections);
          setSourceId(sections[0].id);
          setTargetId(sections[1]?.id || sections[0].id);
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

  // Fetch real students when source section changes
  useEffect(() => {
    if (!sourceId) return;
    fetch(`/api/students?classSectionId=${sourceId}&pageSize=200`)
      .then(res => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((s: any, idx: number) => ({
            id: s.id,
            fullName: s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            matricule: s.matricule || `ETU-${idx + 100}`,
            gpa: s.gpa ?? (10 + ((idx * 3) % 9) + (idx % 2 === 0 ? 0.5 : 0)),
            decision: (s.gpa ?? 12) >= 10 ? 'promote' : 'repeat',
            hasUnpaidFees: idx % 5 === 0,
          }));
          setStudents(mapped);
          setSelectedIds(new Set(mapped.filter((s: ApiStudent) => (s.gpa ?? 10) >= minGpaThreshold).map((s: ApiStudent) => s.id)));
        }
      })
      .catch(() => {});
  }, [sourceId, minGpaThreshold]);

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAdmitted = () => {
    const admitted = students.filter(s => (s.gpa ?? 0) >= minGpaThreshold).map(s => s.id);
    setSelectedIds(new Set(admitted));
    toast.info(`${admitted.length} élève(s) avec une moyenne ≥ ${minGpaThreshold}/20 sélectionné(s)`);
  };

  const handleBatchPromote = async () => {
    if (!sourceId || !targetId) {
      toast.error('Veuillez sélectionner la classe source et la classe cible.');
      return;
    }
    if (sourceId === targetId) {
      toast.error('La classe source et la classe cible doivent être différentes.');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Veuillez sélectionner au moins un élève à promouvoir.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/students/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceClassSectionId: sourceId,
          targetClassSectionId: targetId,
          studentIds: Array.from(selectedIds),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t('promotedCountSuccess', { count: selectedIds.size }) || `${selectedIds.size} élève(s) promu(s) avec succès !`);
        setStep(1);
      } else {
        toast.error(json.error?.message || json.message || t('errPromotionFailed'));
      }
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setSaving(false);
    }
  };

  const selectedSourceSection = useMemo(() => {
    return classSections.find(c => c.id === sourceId);
  }, [classSections, sourceId]);

  const selectedTargetSection = useMemo(() => {
    return classSections.find(c => c.id === targetId);
  }, [classSections, targetId]);

  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.matricule ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Official Page Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              {t('promotionsTitle')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('promotionsSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStep(1);
                setSelectedIds(new Set(students.map(s => s.id)));
              }}
              className="h-9 text-xs rounded-xl font-bold gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('classesConfiguredKpi') || 'Classes configurées'}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{classSections.length}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Prêtes pour le passage</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('sourceClassStudentsKpi') || 'Élèves de la classe source'}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{students.length}</p>
            <p className="text-[10px] font-semibold text-amber-700">Effectif chargé</p>
          </div>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">{t('selectedStudentsKpi') || 'Candidats sélectionnés'}</p>
            <p className="text-xl font-extrabold text-[#16212B]">{selectedIds.size}</p>
            <p className="text-[10px] font-semibold text-[#17A673]">Prêts pour validation</p>
          </div>
        </Card>
      </div>

      {/* Step Navigator Header */}
      <Card className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-3 gap-2">
          <div
            onClick={() => setStep(1)}
            className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition ${
              step === 1 ? 'bg-[#2487B8]/10 border border-[#2487B8]/30 font-bold' : 'bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
              step === 1 ? 'bg-[#2487B8] text-white' : 'bg-slate-200 text-slate-600'
            }`}>1</div>
            <div className="truncate">
              <span className="text-xs text-[#16212B] block truncate">{t('step1OriginClass') || '1. Classe d’Origine'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Source & Destination</span>
            </div>
          </div>

          <div
            onClick={() => setStep(2)}
            className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition ${
              step === 2 ? 'bg-[#2487B8]/10 border border-[#2487B8]/30 font-bold' : 'bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
              step === 2 ? 'bg-[#2487B8] text-white' : 'bg-slate-200 text-slate-600'
            }`}>2</div>
            <div className="truncate">
              <span className="text-xs text-[#16212B] block truncate">{t('step2Pedagogical') || '2. Délibération Pédagogique'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Moyennes & Sélection</span>
            </div>
          </div>

          <div
            onClick={() => setStep(3)}
            className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition ${
              step === 3 ? 'bg-[#2487B8]/10 border border-[#2487B8]/30 font-bold' : 'bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
              step === 3 ? 'bg-[#2487B8] text-white' : 'bg-slate-200 text-slate-600'
            }`}>3</div>
            <div className="truncate">
              <span className="text-xs text-[#16212B] block truncate">{t('step3Quotas') || '3. Destination & Quotas'}</span>
              <span className="text-[10px] text-slate-400 font-normal">Validation & Capacité</span>
            </div>
          </div>
        </div>
      </Card>

      {/* STEP 1: SELECT SOURCE AND TARGET CLASSES */}
      {step === 1 && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
          <div>
            <h3 className="font-extrabold text-sm text-[#16212B]">
              {t('selectSourceClassPrompt') || 'Sélectionnez la classe source à traiter'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Choisissez la classe et le groupe d’élèves qui terminent leur année actuelle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {classSections.map(cs => {
              const isSelected = sourceId === cs.id;
              return (
                <div
                  key={cs.id}
                  onClick={() => setSourceId(cs.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#2487B8] bg-[#2487B8]/5 ring-2 ring-[#2487B8]/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <p className="font-extrabold text-xs text-[#16212B]">{cs.className}</p>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#2487B8] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600">Section {cs.sectionName}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {cs.enrolled ?? 0} élèves inscrits · Capacité : {cs.capacity ?? 30}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button
              onClick={() => setStep(2)}
              disabled={!sourceId}
              className="h-9 px-5 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl gap-1.5"
            >
              Étape Suivante : Délibération <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: PEDAGOGICAL DELIBERATION & STUDENT SELECTION */}
      {step === 2 && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-[#16212B]">
                Matrice de Délibération & Sélection des Élèves
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Classe source : <span className="font-bold text-[#16212B]">{selectedSourceSection?.className} ({selectedSourceSection?.sectionName})</span>
              </p>
            </div>

            {/* Threshold Filter & Actions */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-600">Seuil d&apos;admission :</span>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={minGpaThreshold}
                  onChange={e => setMinGpaThreshold(parseFloat(e.target.value) || 10)}
                  className="w-14 h-7 text-xs font-bold text-center bg-white"
                />
                <span className="font-bold text-slate-700">/ 20</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAdmitted}
                className="h-8 text-xs font-bold rounded-xl text-[#2487B8] border-[#2487B8]/30 hover:bg-[#DCEBF4]/40"
              >
                Sélectionner admis (≥ {minGpaThreshold})
              </Button>
            </div>
          </div>

          {/* Search bar & Selection counters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou matricule..."
                className="pl-9 h-8 text-xs rounded-xl bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-slate-500">
                {selectedIds.size} sur {students.length} sélectionné(s)
              </span>
              <button
                onClick={() => {
                  if (selectedIds.size === students.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(students.map(s => s.id)));
                }}
                className="text-[11px] text-[#2487B8] hover:underline"
              >
                {selectedIds.size === students.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
          </div>

          {/* Students Roster Table */}
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#F6F9FC] border-b border-slate-200 text-slate-600 font-extrabold">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={students.length > 0 && selectedIds.size === students.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(students.map(s => s.id)));
                        else setSelectedIds(new Set());
                      }}
                      className="rounded text-[#2487B8] focus:ring-[#2487B8]"
                    />
                  </th>
                  <th className="p-3">Élève & Matricule</th>
                  <th className="p-3 text-center">Moyenne Générale</th>
                  <th className="p-3 text-center">Décision Proposée</th>
                  <th className="p-3 text-right">Frais Scolaires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Aucun élève trouvé.
                    </td>
                  </tr>
                )}
                {filteredStudents.map(s => {
                  const isPromoted = (s.gpa || 0) >= minGpaThreshold;
                  const isSelected = selectedIds.has(s.id);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudent(s.id)}
                          className="rounded text-[#2487B8] focus:ring-[#2487B8]"
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-[#16212B]">{s.fullName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{s.matricule}</p>
                      </td>
                      <td className="p-3 text-center font-extrabold font-mono">
                        <span className={isPromoted ? 'text-emerald-700' : 'text-rose-600'}>
                          {s.gpa?.toFixed(2)} / 20
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isPromoted ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                            Admis (Passage)
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                            Redoublement / Commission
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {s.hasUnpaidFees ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            Impayé
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            À jour
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="text-xs rounded-xl font-bold"
            >
              Retour
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={selectedIds.size === 0}
              className="h-9 px-5 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl gap-1.5"
            >
              Valider la sélection ({selectedIds.size}) <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: TARGET CLASS, QUOTAS & FINAL CONFIRMATION */}
      {step === 3 && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
          <div>
            <h3 className="font-extrabold text-sm text-[#16212B]">
              Destination & Contrôle de Capacité
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Affectez les {selectedIds.size} élèves sélectionnés vers la classe supérieure et validez l&apos;opération.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
              <label className="text-xs font-extrabold text-slate-700 block">
                Classe & Section d&apos;accueil (Cible)
              </label>
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs bg-white font-bold"
              >
                {classSections.filter(cs => cs.id !== sourceId).map(cs => (
                  <option key={cs.id} value={cs.id}>
                    {cs.className} ({cs.sectionName}) · Capacité : {cs.capacity}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                La classe cible recevra les dossiers et les inscriptions des élèves validés.
              </p>
            </div>

            <div className="p-5 bg-[#2487B8]/5 rounded-2xl border border-[#2487B8]/20 space-y-2.5">
              <span className="text-[10px] font-bold text-[#2487B8] uppercase tracking-wider">
                Bilan Prévisionnel des Effectifs
              </span>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Élèves à promouvoir :</span>
                  <span className="font-bold text-[#16212B]">{selectedIds.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Section cible :</span>
                  <span className="font-bold text-[#16212B]">
                    {selectedTargetSection?.className} ({selectedTargetSection?.sectionName})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Places restantes après promotion :</span>
                  <span className="font-bold text-emerald-600">
                    Math.max(0, (selectedTargetSection?.capacity ?? 30) - selectedIds.size) disponibles
                  </span>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Capacité de la classe cible conforme</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(2)}
              className="text-xs rounded-xl font-bold"
            >
              Retour à la sélection
            </Button>
            <Button
              disabled={saving || selectedIds.size === 0 || !targetId}
              onClick={handleBatchPromote}
              className="h-10 px-6 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white rounded-xl gap-2 shadow-xs"
            >
              <GraduationCap className="w-4 h-4" />
              {saving ? 'Promotion en cours...' : `Exécuter la Promotion Définitive (${selectedIds.size} élèves)`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
