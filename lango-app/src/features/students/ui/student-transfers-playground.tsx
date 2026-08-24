'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, ArrowLeftRight, CheckCircle2, Building2, GraduationCap,
  UserCheck, AlertCircle, ArrowRight, Sparkles, SlidersHorizontal,
  ChevronRight, Calendar, ShieldCheck, FileText, Check, Layers,
  MapPin, Users, ArrowUpRight, Info
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { StudentTransfersClient } from './student-transfers-client';

type StudentResult = {
  id: string;
  fullName: string;
  matricule: string | null;
  className: string | null;
  branchName?: string;
  avatarUrl?: string | null;
  phone?: string | null;
};

type BranchOption = {
  id: string;
  name: string;
  city: string | null;
  capacity?: number;
  enrolled?: number;
  code?: string;
};

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
  branchId?: string;
  capacity?: number;
  enrolled?: number;
};

type TransferStats = {
  transfersThisMonth: number;
  byBranch: { branchId: string; name: string; studentCount: number }[]
};

// Fallback seed branches for rich playground visualization if tenant has 1 branch
const DEFAULT_PLAYGROUND_BRANCHES: BranchOption[] = [
  { id: 'branch-casablanca-main', name: 'Campus Principal - Casablanca Anfa', city: 'Casablanca', capacity: 450, enrolled: 392, code: 'CASA-ANFA' },
  { id: 'branch-rabat-agdal', name: 'Campus Rabat - Agdal', city: 'Rabat', capacity: 320, enrolled: 245, code: 'RAB-AGD' },
  { id: 'branch-marrakech-gueliz', name: 'Campus Marrakech - Guéliz', city: 'Marrakech', capacity: 280, enrolled: 210, code: 'RAK-GUE' },
  { id: 'branch-tanger-malabata', name: 'Campus Tanger - Malabata', city: 'Tanger', capacity: 220, enrolled: 165, code: 'TNG-MAL' },
];

const DEFAULT_PLAYGROUND_CLASSES: ClassSectionOption[] = [
  { id: 'sec-1', className: '1ère Année Bac Sciences Ex', sectionName: 'Groupe A', capacity: 30, enrolled: 26 },
  { id: 'sec-2', className: '1ère Année Bac Sciences Ex', sectionName: 'Groupe B', capacity: 30, enrolled: 28 },
  { id: 'sec-3', className: '2ème Année Bac Sciences Maths', sectionName: 'Groupe A', capacity: 28, enrolled: 22 },
  { id: 'sec-4', className: 'Tronc Commun Scientifique', sectionName: 'Groupe 1', capacity: 32, enrolled: 30 },
  { id: 'sec-5', className: 'Tronc Commun Littéraire', sectionName: 'Groupe A', capacity: 25, enrolled: 18 },
  { id: 'sec-6', className: '3ème Année Collège', sectionName: 'Groupe C', capacity: 30, enrolled: 24 },
];

export function StudentTransfersPlayground({ locale = 'fr' }: { locale?: string }) {
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState<'standard' | 'variation-a' | 'variation-b' | 'variation-c'>('variation-a');

  // Shared state & API data
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetClassSectionId, setTargetClassSectionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState<TransferStats | null>(null);

  // Wizard (Variation A) step tracking: 1: Student, 2: Destination, 3: Impact & Confirm
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [transferReason, setTransferReason] = useState<string>('Déménagement familial');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]!);
  const [generateCertificate, setGenerateCertificate] = useState(true);
  const [notifyGuardian, setNotifyGuardian] = useState(true);

  // Load backend data
  const loadStats = () => {
    fetch('/api/students/transfer-stats')
      .then(r => r.json())
      .then(j => j?.success && setStats(j.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/settings/branches')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
          // Merge API branches with fallback metadata if single branch
          if (j.data.length === 1) {
            setBranches([
              { ...j.data[0], capacity: 400, enrolled: 340, code: 'CAMPUS-01' },
              ...DEFAULT_PLAYGROUND_BRANCHES.slice(1),
            ]);
          } else {
            setBranches(j.data.map((b: any, idx: number) => ({
              ...b,
              capacity: 350,
              enrolled: 250 + (idx * 20),
              code: `BR-${b.name.substring(0, 3).toUpperCase()}`
            })));
          }
        } else {
          setBranches(DEFAULT_PLAYGROUND_BRANCHES);
        }
      })
      .catch(() => setBranches(DEFAULT_PLAYGROUND_BRANCHES));

    fetch('/api/academics/class-sections?pageSize=200')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
          setClassSections(j.data.map((cs: any) => ({
            id: cs.id,
            className: cs.className || 'Classe Standard',
            sectionName: cs.sectionName || 'Section A',
            capacity: 30,
            enrolled: 24,
          })));
        } else {
          setClassSections(DEFAULT_PLAYGROUND_CLASSES);
        }
      })
      .catch(() => setClassSections(DEFAULT_PLAYGROUND_CLASSES));

    loadStats();
  }, []);

  // Student Search Hook with live fallback sample
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      fetch(`/api/students?search=${encodeURIComponent(query)}&pageSize=10`)
        .then(r => r.json())
        .then(j => {
          if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
            setResults(j.data);
          } else {
            // Provide realistic Moroccan fallback student matches for test search
            const samples: StudentResult[] = [
              { id: 'demo-std-1', fullName: 'Yasmine Benjelloun', matricule: 'ETU-2025-0042', className: '2ème Année Bac Sciences Maths - A', branchName: 'Campus Casablanca Anfa', phone: '+212 6 61 23 45 67' },
              { id: 'demo-std-2', fullName: 'Mehdi El Amrani', matricule: 'ETU-2025-0118', className: '1ère Année Bac Sciences Ex - B', branchName: 'Campus Casablanca Anfa', phone: '+212 6 62 89 12 34' },
              { id: 'demo-std-3', fullName: 'Kenza Tazi', matricule: 'ETU-2025-0095', className: 'Tronc Commun Scientifique - 1', branchName: 'Campus Rabat Agdal', phone: '+212 6 64 56 78 90' },
            ].filter(s => s.fullName.toLowerCase().includes(query.toLowerCase()) || s.matricule?.toLowerCase().includes(query.toLowerCase()));
            setResults(samples);
          }
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const handleExecuteTransfer = async () => {
    if (!selected || !targetBranchId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    // If selected is a demo ID, simulate instantaneous success
    if (selected.id.startsWith('demo-')) {
      setTimeout(() => {
        setSuccess(`Le transfert de ${selected.fullName} vers le campus cible a été enregistré.`);
        setSelected(null);
        setSearch('');
        setTargetBranchId('');
        setTargetClassSectionId('');
        setWizardStep(1);
        setSubmitting(false);
      }, 700);
      return;
    }

    try {
      const res = await fetch(`/api/students/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: targetBranchId,
          classSectionId: targetClassSectionId || undefined,
          reason: transferReason,
          effectiveDate,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || 'Échec du transfert.');
        return;
      }
      setSuccess(`${selected.fullName} a été transféré(e) avec succès.`);
      setSelected(null);
      setSearch('');
      setTargetBranchId('');
      setTargetClassSectionId('');
      setWizardStep(1);
      loadStats();
    } catch {
      setError('Erreur réseau ou connexion impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTargetBranch = useMemo(() => {
    return branches.find(b => b.id === targetBranchId);
  }, [branches, targetBranchId]);

  const selectedTargetClass = useMemo(() => {
    return classSections.find(c => c.id === targetClassSectionId);
  }, [classSections, targetClassSectionId]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Playground Header & Variation Switcher Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0EA5C4]/15 text-[#0EA5C4] border border-[#0EA5C4]/30">
                <Sparkles className="w-3.5 h-3.5" /> Design Exploration (Bucket 5 - §2.8)
              </span>
              <span className="text-xs font-semibold text-slate-400">Interactif · 3 Variations</span>
            </div>
            <h1 className="text-xl font-bold text-[#16212B] mt-1.5 tracking-tight">
              Module Transferts d&apos;Élèves & Mutations Inter-Campus
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparez les modèles d&apos;interaction pour le transfert d&apos;élèves entre établissements et sections.
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
              <span>Var. B : Panneau Comparatif</span>
            </button>
            <button
              onClick={() => setActiveTab('variation-c')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'variation-c'
                  ? 'bg-white text-[#2487B8] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Var. C : Matrice de Campus</span>
            </button>
            <button
              onClick={() => setActiveTab('standard')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'standard'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Vue Initiale</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Alert Notification */}
      {success && (
        <div className="p-4 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl flex items-center justify-between text-[#17A673] text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#17A673]" />
            <div>
              <p className="font-bold text-sm">Opération effectuée avec succès</p>
              <p className="text-slate-600 text-xs mt-0.5">{success}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSuccess(null)}
            className="h-7 text-xs border-[#17A673]/40 text-[#17A673] bg-white hover:bg-[#DDF5EC]"
          >
            Fermer
          </Button>
        </div>
      )}

      {/* VARIATION A: GUIDED 3-STEP WIZARD */}
      {activeTab === 'variation-a' && (
        <div className="space-y-6">
          {/* Step Indicator Header */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="grid grid-cols-3 gap-2">
              <div
                onClick={() => setWizardStep(1)}
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                  wizardStep === 1
                    ? 'bg-[#2487B8]/10 border border-[#2487B8]/30'
                    : wizardStep > 1
                    ? 'bg-emerald-50/70 border border-emerald-200/50'
                    : 'bg-slate-50 border border-transparent'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  wizardStep === 1
                    ? 'bg-[#2487B8] text-white'
                    : wizardStep > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {wizardStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#16212B] truncate">1. Sélection Élève</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {selected ? selected.fullName : 'Rechercher le dossier'}
                  </p>
                </div>
              </div>

              <div
                onClick={() => selected && setWizardStep(2)}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                  !selected ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
                } ${
                  wizardStep === 2
                    ? 'bg-[#2487B8]/10 border border-[#2487B8]/30'
                    : wizardStep > 2
                    ? 'bg-emerald-50/70 border border-emerald-200/50'
                    : 'bg-slate-50 border border-transparent'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  wizardStep === 2
                    ? 'bg-[#2487B8] text-white'
                    : wizardStep > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {wizardStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#16212B] truncate">2. Destination & Capacité</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {selectedTargetBranch ? selectedTargetBranch.name : 'Choisir le campus'}
                  </p>
                </div>
              </div>

              <div
                onClick={() => selected && targetBranchId && setWizardStep(3)}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                  (!selected || !targetBranchId) ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
                } ${
                  wizardStep === 3
                    ? 'bg-[#2487B8]/10 border border-[#2487B8]/30'
                    : 'bg-slate-50 border border-transparent'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  wizardStep === 3
                    ? 'bg-[#2487B8] text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  3
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#16212B] truncate">3. Synthèse & Confirmation</p>
                  <p className="text-[10px] text-slate-500 truncate">Validation du dossier</p>
                </div>
              </div>
            </div>
          </Card>

          {/* STEP 1: Student Search & Selection */}
          {wizardStep === 1 && (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#16212B]">Étape 1 : Trouver l&apos;élève à muter</h2>
                  <Badge variant="neutral" className="text-[10px] font-semibold text-slate-500">
                    Recherche directe multi-campus
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Tapez le matricule (ex: ETU-2025-0042) ou le nom de l&apos;élève pour charger son dossier scolaire actif.
                </p>
              </div>

              {!selected ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Ex: Yasmine Benjelloun, Mehdi El Amrani ou matricule..."
                      className="h-11 pl-10 rounded-xl text-xs border-slate-200 focus:border-[#2487B8]"
                    />
                  </div>

                  {searching && (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      Recherche dans la base de données...
                    </div>
                  )}

                  {results.length > 0 && (
                    <div className="space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50/50 max-h-72 overflow-y-auto">
                      {results.map(r => (
                        <div
                          key={r.id}
                          onClick={() => { setSelected(r); setResults([]); setSearch(''); }}
                          className="flex items-center justify-between p-3 rounded-xl bg-white hover:bg-[#2487B8]/5 border border-slate-200/70 hover:border-[#2487B8]/40 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-[#2487B8]">
                              {r.fullName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#16212B] group-hover:text-[#2487B8] transition-colors">
                                {r.fullName}
                              </p>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">{r.matricule || 'Sans matricule'}</span>
                                <span>·</span>
                                <span>{r.className || 'Classe non assignée'}</span>
                              </p>
                            </div>
                          </div>

                          <Button size="sm" variant="ghost" className="h-8 text-xs font-semibold text-[#2487B8] gap-1 group-hover:bg-[#2487B8] group-hover:text-white">
                            Choisir <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {search.length < 2 && (
                    <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-600">Recherchez un élève pour démarrer</p>
                      <p className="text-[11px] text-slate-400 mt-1">Vous pouvez tester avec &quot;Yasmine&quot; ou &quot;Mehdi&quot;.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Student Card */
                <div className="p-4 rounded-2xl border border-[#2487B8]/30 bg-[#2487B8]/5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-[#2487B8] text-white flex items-center justify-center text-sm font-bold shadow-xs">
                        {selected.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#16212B]">{selected.fullName}</h3>
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">
                            Inscrit actif
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-slate-700 font-semibold">{selected.matricule}</span>
                          <span>·</span>
                          <span className="text-[#2487B8] font-medium">{selected.className || 'Classe standard'}</span>
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSelected(null); setTargetBranchId(''); }}
                      className="h-8 text-xs font-semibold text-slate-600 hover:text-rose-600 border-slate-200"
                    >
                      Changer d&apos;élève
                    </Button>
                  </div>

                  <div className="pt-3 border-t border-[#2487B8]/15 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Campus d&apos;origine</span>
                      <span className="font-semibold text-slate-700">{selected.branchName || 'Campus Principal'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Frais de scolarité</span>
                      <span className="font-semibold text-emerald-700">À jour (Solde 0,00 DH)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Assiduité</span>
                      <span className="font-semibold text-slate-700">96.4% de présence</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={() => setWizardStep(2)}
                      className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5 shadow-xs"
                    >
                      Passer au choix de destination <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* STEP 2: Destination Branch & Class Selection with Capacity Check */}
          {wizardStep === 2 && (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#16212B]">Étape 2 : Campus & Classe de destination</h2>
                  <Badge variant="neutral" className="text-[10px] font-semibold text-slate-500">
                    Vérification des quotas en temps réel
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Sélectionnez le campus d&apos;accueil ainsi que la classe correspondante. Le système vérifie la capacité disponible.
                </p>
              </div>

              {/* Campus Grid Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#2487B8]" />
                  1. Sélectionner l&apos;Établissement / Campus d&apos;accueil
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {branches.map(b => {
                    const isSelected = targetBranchId === b.id;
                    const enrolled = b.enrolled || 210;
                    const capacity = b.capacity || 300;
                    const percent = Math.round((enrolled / capacity) * 100);
                    const isFull = percent >= 95;

                    return (
                      <div
                        key={b.id}
                        onClick={() => !isFull && setTargetBranchId(b.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
                          isSelected
                            ? 'border-[#2487B8] bg-[#2487B8]/5 ring-2 ring-[#2487B8]/20 shadow-xs'
                            : isFull
                            ? 'border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-[#16212B]">{b.name}</h4>
                              {b.city && (
                                <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 font-medium flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5 text-slate-400" /> {b.city}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{enrolled} / {capacity} places occupées</span>
                            </p>
                          </div>

                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                            isSelected ? 'bg-[#2487B8] text-white' : 'border border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>

                        {/* Capacity Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] font-semibold mb-1">
                            <span className="text-slate-400">Remplissage</span>
                            <span className={percent > 90 ? 'text-amber-600' : 'text-slate-600'}>{percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                percent > 90 ? 'bg-amber-500' : percent > 75 ? 'bg-[#2487B8]' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Class Section Selector */}
              {targetBranchId && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-[#2487B8]" />
                    2. Section / Groupe d&apos;accueil (Optionnel mais recommandé)
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      onClick={() => setTargetClassSectionId('')}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        targetClassSectionId === ''
                          ? 'border-[#2487B8] bg-[#2487B8]/5 font-bold text-[#2487B8]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-bold">Non assigné pour l&apos;instant</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">Affectation ultérieure par le directeur</p>
                    </div>

                    {classSections.slice(0, 5).map(cs => {
                      const isSelected = targetClassSectionId === cs.id;
                      const enrolled = cs.enrolled || 24;
                      const capacity = cs.capacity || 30;
                      const isFull = enrolled >= capacity;

                      return (
                        <div
                          key={cs.id}
                          onClick={() => !isFull && setTargetClassSectionId(cs.id)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]'
                              : isFull
                              ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#16212B] truncate">{cs.className}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              {cs.sectionName}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Disponibilité : <span className="font-semibold text-emerald-600">{capacity - enrolled} places libres</span> ({enrolled}/{capacity})
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep(1)}
                  className="text-xs border-slate-200"
                >
                  Retour
                </Button>
                <Button
                  disabled={!targetBranchId}
                  onClick={() => setWizardStep(3)}
                  className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5"
                >
                  Continuer vers la synthèse <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 3: Transfer Impact & Final Confirmation */}
          {wizardStep === 3 && selected && (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#16212B]">Étape 3 : Récapitulatif & Validation Légale</h2>
                  <Badge className="bg-[#2487B8]/10 text-[#2487B8] border-[#2487B8]/30 text-[10px]">
                    Action certifiée
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Vérifiez les paramètres avant l&apos;application définitive de la mutation dans le registre d&apos;établissement.
                </p>
              </div>

              {/* Source vs Destination Comparison Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provenance Actuelle</span>
                    <Badge variant="neutral" className="text-[10px] text-slate-500">Source</Badge>
                  </div>
                  <p className="text-sm font-bold text-[#16212B]">{selected.fullName}</p>
                  <p className="text-xs text-slate-600 font-mono">{selected.matricule}</p>
                  <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                    <p className="text-slate-500">Campus : <strong className="text-slate-700">{selected.branchName || 'Campus Principal'}</strong></p>
                    <p className="text-slate-500">Classe : <strong className="text-slate-700">{selected.className || 'Non assigné'}</strong></p>
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-[#2487B8]/5 rounded-xl border border-[#2487B8]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#2487B8] uppercase tracking-wider">Nouvelle Affectation</span>
                    <Badge className="bg-[#2487B8] text-white text-[10px]">Cible</Badge>
                  </div>
                  <p className="text-sm font-bold text-[#16212B]">{selectedTargetBranch?.name}</p>
                  <p className="text-xs text-[#2487B8] font-medium">{selectedTargetBranch?.city || 'Maroc'}</p>
                  <div className="pt-2 border-t border-[#2487B8]/15 text-xs space-y-1">
                    <p className="text-slate-500">Nouvelle Classe : <strong className="text-[#16212B]">{selectedTargetClass ? `${selectedTargetClass.className} (${selectedTargetClass.sectionName})` : 'Non assigné (à ventiler)'}</strong></p>
                    <p className="text-slate-500">Statut inscription : <strong className="text-emerald-600">Place confirmée</strong></p>
                  </div>
                </div>
              </div>

              {/* Transfer Metadata Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date d&apos;effet de la mutation</label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="h-10 text-xs rounded-xl border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Motif du transfert</label>
                  <select
                    value={transferReason}
                    onChange={e => setTransferReason(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs bg-white"
                  >
                    <option value="Déménagement familial">Déménagement familial</option>
                    <option value="Rapprochement géographique">Rapprochement géographique</option>
                    <option value="Changement de filière / option">Changement de filière / option</option>
                    <option value="Convenance personnelle des tuteurs">Convenance personnelle des tuteurs</option>
                    <option value="Décision pédagogique interne">Décision pédagogique interne</option>
                  </select>
                </div>
              </div>

              {/* Automatic Options / Automation Toggles */}
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="gen-cert"
                    checked={generateCertificate}
                    onChange={e => setGenerateCertificate(e.target.checked)}
                    className="w-4 h-4 text-[#2487B8] rounded border-slate-300"
                  />
                  <label htmlFor="gen-cert" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Générer automatiquement le <strong>Certificat de Mutation / Quitus</strong> officiel
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="notif-guard"
                    checked={notifyGuardian}
                    onChange={e => setNotifyGuardian(e.target.checked)}
                    className="w-4 h-4 text-[#0EA5C4] rounded border-slate-300"
                  />
                  <label htmlFor="notif-guard" className="text-xs text-slate-700 font-medium cursor-pointer flex items-center gap-1.5">
                    Envoyer une notification de confirmation par WhatsApp aux tuteurs légaux
                    <Badge className="bg-[#0EA5C4]/15 text-[#0EA5C4] text-[9px] border-none">WhatsApp Auto</Badge>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep(2)}
                  className="text-xs border-slate-200"
                >
                  Modifier les choix
                </Button>

                <Button
                  disabled={submitting}
                  onClick={handleExecuteTransfer}
                  className="h-10 px-6 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2 shadow-sm"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {submitting ? 'Validation et transfert en cours...' : 'Confirmer et Exécuter le Transfert'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* VARIATION B: SIDE-BY-SIDE COMPARATIVE PANEL */}
      {activeTab === 'variation-b' && (
        <div className="space-y-6">
          {/* Top Quick Search Bar for Variation B */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un élève pour le banc de transfert comparatif..."
                  className="h-10 pl-10 rounded-xl text-xs border-slate-200"
                />
              </div>

              {results.length > 0 && !selected && (
                <div className="w-full sm:w-auto">
                  <select
                    onChange={e => {
                      const match = results.find(r => r.id === e.target.value);
                      if (match) { setSelected(match); setResults([]); setSearch(''); }
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3 text-xs bg-slate-50 w-full font-semibold"
                  >
                    <option value="">{results.length} élève(s) trouvé(s) — Choisir...</option>
                    {results.map(r => (
                      <option key={r.id} value={r.id}>{r.fullName} ({r.matricule})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Card>

          {/* Dual Column Comparative Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Source Dossier */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Campus Source</h3>
                  </div>
                  <Badge variant="neutral" className="text-[10px]">Origine</Badge>
                </div>

                {selected ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
                        {selected.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#16212B]">{selected.fullName}</h4>
                        <p className="text-xs text-slate-500 font-mono">{selected.matricule}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Établissement :</span>
                        <span className="font-semibold text-slate-800">{selected.branchName || 'Campus Casablanca Anfa'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Classe active :</span>
                        <span className="font-semibold text-slate-800">{selected.className || 'Non assigné'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dernière moyenne :</span>
                        <span className="font-semibold text-emerald-700">15.80 / 20</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Statut financier :</span>
                        <span className="font-semibold text-emerald-700">Quitus validé</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Recherchez un élève ci-dessus pour afficher le dossier source.
                  </div>
                )}
              </Card>
            </div>

            {/* Middle Transfer Bridge */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center gap-2 py-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2487B8] text-white flex items-center justify-center shadow-md">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                Banc de Transfert
              </span>
            </div>

            {/* Right Column: Destination Target Picker */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2487B8]" />
                    <h3 className="text-xs font-bold text-[#2487B8] uppercase tracking-wider">Campus Cible</h3>
                  </div>
                  <Badge className="bg-[#2487B8] text-white text-[10px]">Destination</Badge>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Campus de destination</label>
                    <select
                      value={targetBranchId}
                      onChange={e => setTargetBranchId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs bg-white font-medium"
                    >
                      <option value="">Sélectionner un campus...</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.city || 'Maroc'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Classe d&apos;accueil</label>
                    <select
                      value={targetClassSectionId}
                      onChange={e => setTargetClassSectionId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs bg-white font-medium"
                    >
                      <option value="">Affectation automatique / Sans classe</option>
                      {classSections.map(cs => (
                        <option key={cs.id} value={cs.id}>{cs.className} - {cs.sectionName}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTargetBranch && (
                    <div className="p-3 bg-[#2487B8]/5 border border-[#2487B8]/20 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Capacité disponible :</span>
                        <span className="font-bold text-emerald-700">
                          {(selectedTargetBranch.capacity || 300) - (selectedTargetBranch.enrolled || 210)} places libres
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Directeur pédagogique :</span>
                        <span className="font-semibold text-slate-800">Pr. A. Alami</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-3">
                    <Button
                      disabled={!selected || !targetBranchId || submitting}
                      onClick={handleExecuteTransfer}
                      className="w-full h-10 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {submitting ? 'Transfert en cours...' : 'Exécuter la Mutation Directe'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* VARIATION C: INTERACTIVE BRANCH & CLASS MATRIX BOARD */}
      {activeTab === 'variation-c' && (
        <div className="space-y-6">
          {/* Top Selection Ribbon */}
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-10 h-10 rounded-xl bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#16212B]">Matrice de Gestion & Répartition Inter-Campus</h3>
                  <p className="text-[11px] text-slate-500">Cliquez sur une branche pour afficher ses quotas et sélectionner la cible.</p>
                </div>
              </div>

              {selected ? (
                <div className="flex items-center gap-2 bg-[#2487B8]/10 px-3 py-1.5 rounded-xl border border-[#2487B8]/20">
                  <span className="text-xs font-bold text-[#16212B]">{selected.fullName}</span>
                  <Badge variant="neutral" className="text-[10px] font-mono">{selected.matricule}</Badge>
                  <button onClick={() => setSelected(null)} className="text-[10px] text-rose-600 font-bold ml-1">Retirer</button>
                </div>
              ) : (
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Élève à transférer..."
                    className="h-9 pl-9 text-xs rounded-xl border-slate-200"
                  />
                  {results.length > 0 && (
                    <div className="absolute top-10 left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-1">
                      {results.map(r => (
                        <div
                          key={r.id}
                          onClick={() => { setSelected(r); setResults([]); setSearch(''); }}
                          className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs flex justify-between"
                        >
                          <span className="font-bold">{r.fullName}</span>
                          <span className="text-slate-400">{r.matricule}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Interactive Matrix Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {branches.map(b => {
              const isSelected = targetBranchId === b.id;
              const enrolled = b.enrolled || 210;
              const capacity = b.capacity || 300;
              const available = capacity - enrolled;

              return (
                <Card
                  key={b.id}
                  onClick={() => setTargetBranchId(b.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#2487B8] bg-[#2487B8]/5 ring-2 ring-[#2487B8]/30 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        {b.code || 'CAMPUS'}
                      </span>
                      <h4 className="text-sm font-bold text-[#16212B] mt-0.5">{b.name}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" /> {b.city || 'Maroc'}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isSelected ? 'bg-[#2487B8] text-white' : 'border border-slate-200'
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Places libres</span>
                      <span className="font-bold text-emerald-600">{available} places</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Effectif total</span>
                      <span className="font-bold text-slate-700">{enrolled}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-[#2487B8]/20">
                      <Button
                        size="sm"
                        disabled={!selected || submitting}
                        onClick={(e) => { e.stopPropagation(); handleExecuteTransfer(); }}
                        className="w-full h-8 text-xs font-bold rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white"
                      >
                        {selected ? 'Transférer ici' : 'Sélectionner un élève'}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* STANDARD VIEW AS BASELINE */}
      {activeTab === 'standard' && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <StudentTransfersClient locale={locale} />
        </div>
      )}
    </div>
  );
}
