'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ArrowLeftRight,
  CheckCircle2,
  Building2,
  GraduationCap,
  AlertCircle,
  ArrowRight,
  Calendar,
  ShieldCheck,
  FileText,
  Check,
  MapPin,
  Users,
  Loader2,
  History,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';

type StudentResult = {
  id: string;
  fullName: string;
  matricule: string | null;
  className: string | null;
  classSectionId?: string | null;
  branchId?: string | null;
  phone?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
};

type BranchOption = {
  id: string;
  name: string;
  city: string | null;
  code?: string | null;
  capacity?: number;
  enrolled?: number;
};

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
  branchId?: string | null;
  capacity?: number;
  enrolled?: number;
};

type RecentTransfer = {
  id: string;
  createdAt: string;
  studentId: string;
  studentName: string;
  studentMatricule: string | null;
  fromBranchId: string | null;
  toBranchId: string | null;
  toBranchName: string | null;
  reason: string;
  effectiveDate: string;
};

type TransferStats = {
  transfersThisMonth: number;
  byBranch: { branchId: string; name: string; studentCount: number }[];
  recentTransfers?: RecentTransfer[];
};

const MOTIF_PRESETS = [
  'Déménagement familial',
  'Rapprochement de fratrie',
  'Orientation pédagogique',
  'Demande des parents',
  'Régularisation administrative',
];

export function StudentTransfersClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();

  // Data state
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [stats, setStats] = useState<TransferStats | null>(null);

  // Search state
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentResult | null>(null);

  // Stepper state: 1: Student, 2: Destination & Capacity, 3: Synthesis & Confirm
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Transfer form state
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetClassSectionId, setTargetClassSectionId] = useState('');
  const [transferReason, setTransferReason] = useState('Déménagement familial');
  const [customReason, setCustomReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [generateCertificate, setGenerateCertificate] = useState(true);
  const [notifyGuardian, setNotifyGuardian] = useState(true);

  // Execution state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStats = () => {
    fetch('/api/students/transfer-stats')
      .then(r => (r.ok ? r.json() : null))
      .then(j => j?.success && setStats(j.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/settings/branches')
      .then(r => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setBranches(j.data);
        }
      })
      .catch(() => {});

    fetch('/api/academics/class-sections?pageSize=200')
      .then(r => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setClassSections(j.data);
        }
      })
      .catch(() => {});

    loadStats();
  }, []);

  // Debounced student search
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      fetch(`/api/students?search=${encodeURIComponent(query)}&pageSize=10`)
        .then(r => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.success && Array.isArray(j.data)) {
            setResults(j.data);
          } else {
            setResults([]);
          }
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(handle);
  }, [search]);

  // Branch metadata enriched with enrollment stats
  const enrichedBranches = useMemo(() => {
    return branches.map((b) => {
      const branchStat = stats?.byBranch?.find(s => s.branchId === b.id);
      const enrolled = branchStat?.studentCount ?? 0;
      const capacity = b.capacity || 350;
      return {
        ...b,
        enrolled,
        capacity,
      };
    });
  }, [branches, stats]);

  const selectedTargetBranch = useMemo(() => {
    return enrichedBranches.find(b => b.id === targetBranchId);
  }, [enrichedBranches, targetBranchId]);

  const selectedTargetClass = useMemo(() => {
    return classSections.find(c => c.id === targetClassSectionId);
  }, [classSections, targetClassSectionId]);

  // Resolve student origin branch name
  const studentOriginBranch = useMemo(() => {
    if (!selected) return null;
    if (selected.branchId) {
      const match = branches.find(b => b.id === selected.branchId);
      if (match) return match.name;
    }
    return 'Campus Principal';
  }, [selected, branches]);

  const totalEnrolledAcrossNetwork = useMemo(() => {
    if (!stats?.byBranch) return 0;
    return stats.byBranch.reduce((acc, curr) => acc + (curr.studentCount || 0), 0);
  }, [stats]);

  const handleExecuteTransfer = async () => {
    if (!selected || !targetBranchId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const resolvedReason = customReason.trim() || transferReason;

    try {
      const res = await fetch(`/api/students/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: targetBranchId,
          classSectionId: targetClassSectionId || undefined,
          reason: resolvedReason,
          effectiveDate,
          notifyGuardian,
          generateCertificate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || t('errTransferFailed');
        setError(msg);
        toast.error(msg);
        return;
      }

      const successMsg = `Mutation de ${selected.fullName} vers « ${selectedTargetBranch?.name} » validée avec succès.`;
      setSuccess(successMsg);
      toast.success(successMsg);

      // Reset selection and step
      setSelected(null);
      setSearch('');
      setTargetBranchId('');
      setTargetClassSectionId('');
      setCustomReason('');
      setWizardStep(1);
      loadStats();
    } catch {
      const netErr = 'Erreur réseau ou communication impossible avec le serveur.';
      setError(netErr);
      toast.error(netErr);
    } finally {
      setSubmitting(false);
    }
  };

  const canTransfer = can('students.update');
  if (!canTransfer) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3 shadow-xs">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-[#16212B]">{t('unauthorizedTransfers')}</h2>
        <p className="text-xs text-slate-500">
          Votre compte utilisateur ne dispose pas des droits nécessaires pour ordonnancer des mutations d&apos;élèves.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCEBF4] text-[#1B6C93] border border-[#2487B8]/30">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Registre Scolaire
            </span>
            <span className="text-xs font-semibold text-slate-400">Mutations Inter-Campus</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#16212B] mt-1 tracking-tight">
            Transferts d&apos;Élèves & Mutations Inter-Campus
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestion administrative des mutations d&apos;élèves entre campus et sections avec contrôle des capacités en temps réel.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mutations ce mois-ci</p>
            <History className="w-4 h-4 text-[#2487B8]" />
          </div>
          <p className="text-2xl font-extrabold text-[#16212B] mt-1.5">{stats?.transfersThisMonth ?? 0}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mouvements validés dans l&apos;audit</p>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campus du Réseau</p>
            <Building2 className="w-4 h-4 text-[#17A673]" />
          </div>
          <p className="text-2xl font-extrabold text-[#16212B] mt-1.5">{branches.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Établissements & succursales configurés</p>
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Élèves dans le réseau</p>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-[#16212B] mt-1.5">{totalEnrolledAcrossNetwork}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Effectifs scolarisés actifs</p>
        </Card>
      </div>

      {/* Success Alert */}
      {success && (
        <div className="p-4 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl flex items-center justify-between text-[#17A673] text-xs font-semibold shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#17A673]" />
            <div>
              <p className="font-bold text-sm">Opération enregistrée</p>
              <p className="text-slate-600 text-xs mt-0.5">{success}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSuccess(null)}
            className="h-7 text-xs border-[#17A673]/40 text-[#17A673] bg-white hover:bg-[#DDF5EC] cursor-pointer"
          >
            {tCommon('close')}
          </Button>
        </div>
      )}

      {/* Stepper Timeline Header */}
      <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Step 1 Pill */}
          <div
            onClick={() => setWizardStep(1)}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
              wizardStep === 1
                ? 'bg-[#DCEBF4]/50 border border-[#2487B8]/40 ring-1 ring-[#2487B8]/30 shadow-2xs'
                : wizardStep > 1
                  ? 'bg-emerald-50/70 border border-emerald-200/60'
                  : 'bg-slate-50/60 border border-slate-100'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                wizardStep === 1
                  ? 'bg-[#2487B8] text-white shadow-2xs'
                  : wizardStep > 1
                    ? 'bg-[#17A673] text-white shadow-2xs'
                    : 'bg-slate-200 text-slate-600'
              }`}
            >
              {wizardStep > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#16212B] truncate">1. Sélection Élève</p>
              <p className="text-[10px] text-slate-500 truncate">
                {selected ? selected.fullName : 'Rechercher le dossier'}
              </p>
            </div>
          </div>

          {/* Step 2 Pill */}
          <div
            onClick={() => selected && setWizardStep(2)}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              !selected
                ? 'opacity-50 cursor-not-allowed bg-slate-50/50'
                : 'cursor-pointer'
            } ${
              wizardStep === 2
                ? 'bg-[#DCEBF4]/50 border border-[#2487B8]/40 ring-1 ring-[#2487B8]/30 shadow-2xs'
                : wizardStep > 2
                  ? 'bg-emerald-50/70 border border-emerald-200/60'
                  : 'bg-slate-50/60 border border-slate-100'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                wizardStep === 2
                  ? 'bg-[#2487B8] text-white shadow-2xs'
                  : wizardStep > 2
                    ? 'bg-[#17A673] text-white shadow-2xs'
                    : 'bg-slate-200 text-slate-600'
              }`}
            >
              {wizardStep > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#16212B] truncate">2. Destination & Capacité</p>
              <p className="text-[10px] text-slate-500 truncate">
                {selectedTargetBranch ? selectedTargetBranch.name : 'Choisir le campus'}
              </p>
            </div>
          </div>

          {/* Step 3 Pill */}
          <div
            onClick={() => selected && targetBranchId && setWizardStep(3)}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              !selected || !targetBranchId
                ? 'opacity-50 cursor-not-allowed bg-slate-50/50'
                : 'cursor-pointer'
            } ${
              wizardStep === 3
                ? 'bg-[#DCEBF4]/50 border border-[#2487B8]/40 ring-1 ring-[#2487B8]/30 shadow-2xs'
                : 'bg-slate-50/60 border border-slate-100'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                wizardStep === 3
                  ? 'bg-[#2487B8] text-white shadow-2xs'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#16212B] truncate">3. Synthèse & Validation</p>
              <p className="text-[10px] text-slate-500 truncate">Confirmation réglementaire</p>
            </div>
          </div>
        </div>
      </Card>

      {/* STEP 1: Student Search & Selection */}
      {wizardStep === 1 && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#16212B]">Étape 1 : Sélectionner l&apos;élève à muter</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Recherchez le dossier scolaire par nom, prénom ou numéro de matricule national.
            </p>
          </div>

          {!selected ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, prénom ou matricule (ex: ATL-2526-0001)..."
                  className="h-11 ps-10 rounded-xl text-xs bg-slate-50/50 border-slate-200 focus:border-[#2487B8] text-start"
                />
              </div>

              {searching && (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2487B8]" />
                  <span>Recherche dans la base de données...</span>
                </div>
              )}

              {!searching && search.trim().length >= 2 && results.length === 0 && (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-600">Aucun élève trouvé pour « {search} »</p>
                  <p className="text-[11px] text-slate-400 mt-1">Vérifiez l&apos;orthographe ou tentez avec le matricule.</p>
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50/50 max-h-72 overflow-y-auto">
                  {results.map((r) => {
                    const branchLabel = r.branchId
                      ? branches.find(b => b.id === r.branchId)?.name || 'Campus affecté'
                      : 'Campus Principal';
                    const initials = r.fullName.slice(0, 2).toUpperCase();

                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelected(r);
                          setResults([]);
                          setSearch('');
                          // If student has a branch, pre-set or leave open
                          if (r.branchId && r.branchId === targetBranchId) {
                            setTargetBranchId('');
                          }
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white hover:bg-[#DCEBF4]/30 border border-slate-200/70 hover:border-[#2487B8]/40 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center text-xs font-black shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#16212B] group-hover:text-[#2487B8] transition-colors">
                              {r.fullName}
                            </p>
                            <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                              {r.matricule && (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-semibold">
                                  {r.matricule}
                                </span>
                              )}
                              <span>·</span>
                              <span>{r.className || 'Classe non assignée'}</span>
                              <span>·</span>
                              <span className="text-[#2487B8] font-medium">{branchLabel}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs font-bold text-[#2487B8] gap-1 group-hover:bg-[#2487B8] group-hover:text-white"
                        >
                          Sélectionner <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {search.trim().length < 2 && (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Recherchez un élève pour commencer</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Saisissez au moins 2 caractères du nom ou du matricule.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Selected Student Dossier Card */
            <div className="p-5 rounded-2xl border border-[#2487B8]/30 bg-[#DCEBF4]/20 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#2487B8] text-white flex items-center justify-center text-sm font-black shadow-2xs">
                    {selected.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-[#16212B]">{selected.fullName}</h3>
                      <Badge className="bg-[#DDF5EC] text-[#17A673] border-[#17A673]/30 text-[10px] font-bold">
                        Inscrit actif
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-slate-700 font-bold">{selected.matricule || 'Sans matricule'}</span>
                      <span>·</span>
                      <span className="text-[#1B6C93] font-semibold">{selected.className || 'Classe non assignée'}</span>
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelected(null);
                    setTargetBranchId('');
                  }}
                  className="h-8 text-xs font-bold text-slate-600 hover:text-rose-600 border-slate-200 cursor-pointer"
                >
                  Changer d&apos;élève
                </Button>
              </div>

              <div className="pt-3 border-t border-[#2487B8]/20 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white/70 rounded-xl border border-[#2487B8]/20">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Campus Actuel (Source)</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{studentOriginBranch}</span>
                </div>
                <div className="p-3 bg-white/70 rounded-xl border border-[#2487B8]/20">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Frais de Scolarité</span>
                  <span className="font-bold text-[#17A673] text-xs mt-0.5 block">Dossier régularisé</span>
                </div>
                <div className="p-3 bg-white/70 rounded-xl border border-[#2487B8]/20">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Statut Administratif</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">Autorisé aux mutations</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setWizardStep(2)}
                  className="h-10 px-5 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2 cursor-pointer shadow-2xs"
                >
                  <span>Continuer vers le choix du campus</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* STEP 2: Destination Branch & Class Selection */}
      {wizardStep === 2 && selected && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#16212B]">Étape 2 : Campus & Section de Destination</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sélectionnez l&apos;établissement d&apos;accueil pour l&apos;élève <strong className="text-slate-700">{selected.fullName}</strong>.
            </p>
          </div>

          {/* Campus Cards Grid */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#2487B8]" />
              <span>1. Choisir le campus de destination</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {enrichedBranches.map((b) => {
                const isCurrentBranch = selected.branchId === b.id;
                const isSelected = targetBranchId === b.id;
                const enrolled = b.enrolled || 0;
                const capacity = b.capacity || 350;
                const percent = Math.min(100, Math.round((enrolled / capacity) * 100));

                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (!isCurrentBranch) {
                        setTargetBranchId(b.id);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all relative ${
                      isCurrentBranch
                        ? 'border-slate-200 bg-slate-50/70 cursor-not-allowed opacity-75'
                        : isSelected
                          ? 'border-[#2487B8] bg-[#DCEBF4]/30 ring-2 ring-[#2487B8]/40 shadow-xs cursor-pointer'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-[#16212B] truncate">{b.name}</h4>
                          {isCurrentBranch && (
                            <Badge variant="neutral" className="text-[9px] bg-slate-200 text-slate-700 font-bold">
                              Campus actuel
                            </Badge>
                          )}
                        </div>
                        {b.city && (
                          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-1">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" /> {b.city}
                          </span>
                        )}
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs ${
                          isSelected
                            ? 'bg-[#2487B8] text-white'
                            : 'border border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs">
                      <div className="flex justify-between text-[10px] font-semibold mb-1">
                        <span className="text-slate-400">Effectif actuel</span>
                        <span className="text-slate-700 font-bold">{enrolled} élèves</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percent > 90 ? 'bg-amber-500' : 'bg-[#2487B8]'
                          }`}
                          style={{ width: `${Math.max(8, percent)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Class Section Selection */}
          {targetBranchId && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#2487B8]" />
                <span>2. Nouvelle section / classe (optionnel)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setTargetClassSectionId('')}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    targetClassSectionId === ''
                      ? 'border-[#2487B8] bg-[#DCEBF4]/30 ring-1 ring-[#2487B8] font-bold text-[#1B6C93]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold">Non assigné pour l&apos;instant</p>
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">Affectation ultérieure par la direction</p>
                </div>

                {classSections.slice(0, 5).map((cs) => {
                  const isSelected = targetClassSectionId === cs.id;
                  return (
                    <div
                      key={cs.id}
                      onClick={() => setTargetClassSectionId(cs.id)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#2487B8] bg-[#DCEBF4]/30 ring-1 ring-[#2487B8]'
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
                        Classe disponible sur le campus
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
              className="text-xs border-slate-200 cursor-pointer"
            >
              Retour à l&apos;étape 1
            </Button>
            <Button
              disabled={!targetBranchId}
              onClick={() => setWizardStep(3)}
              className="h-10 px-5 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-2 cursor-pointer shadow-2xs"
            >
              <span>Continuer vers la synthèse</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Transfer Synthesis & Final Execution */}
      {wizardStep === 3 && selected && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-extrabold text-[#16212B]">Étape 3 : Synthèse & Validation Légale</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Vérifiez les paramètres avant l&apos;exécution définitive du transfert dans le registre d&apos;établissement.
            </p>
          </div>

          {/* Comparison Side-by-Side Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            {/* Source */}
            <div className="space-y-2 p-3.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provenance Actuelle</span>
                <Badge variant="neutral" className="text-[10px] text-slate-600 bg-slate-100 font-bold">Source</Badge>
              </div>
              <p className="text-sm font-extrabold text-[#16212B]">{selected.fullName}</p>
              <p className="text-xs text-slate-500 font-mono">{selected.matricule || 'Sans matricule'}</p>
              <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                <p className="text-slate-500">
                  Campus : <strong className="text-slate-700">{studentOriginBranch}</strong>
                </p>
                <p className="text-slate-500">
                  Classe : <strong className="text-slate-700">{selected.className || 'Non assigné'}</strong>
                </p>
              </div>
            </div>

            {/* Target */}
            <div className="space-y-2 p-3.5 bg-[#DCEBF4]/30 rounded-xl border border-[#2487B8]/30 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#1B6C93] uppercase tracking-wider">Nouvelle Affectation</span>
                <Badge className="bg-[#2487B8] text-white text-[10px] font-bold">Cible</Badge>
              </div>
              <p className="text-sm font-extrabold text-[#16212B]">{selectedTargetBranch?.name}</p>
              <p className="text-xs text-[#1B6C93] font-semibold">{selectedTargetBranch?.city || 'Maroc'}</p>
              <div className="pt-2 border-t border-[#2487B8]/20 text-xs space-y-1">
                <p className="text-slate-500">
                  Nouvelle Classe :{' '}
                  <strong className="text-[#16212B]">
                    {selectedTargetClass ? `${selectedTargetClass.className} (${selectedTargetClass.sectionName})` : 'Non assigné (à ventiler)'}
                  </strong>
                </p>
                <p className="text-slate-500">
                  Statut : <strong className="text-[#17A673]">Mutation prête</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Form Options: Reason, Effective Date, Checkboxes */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Motif réglementaire de la mutation *
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MOTIF_PRESETS.map((motif) => (
                  <button
                    key={motif}
                    type="button"
                    onClick={() => {
                      setTransferReason(motif);
                      setCustomReason('');
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      transferReason === motif && !customReason
                        ? 'bg-[#2487B8] text-white border-[#2487B8] font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {motif}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Préciser le motif ou saisir un complément..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="h-9 rounded-xl text-xs bg-white border-slate-200 text-start"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Date d&apos;effet administrative *
                </label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  className="h-9 rounded-xl text-xs bg-white border-slate-200"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateCertificate}
                    onChange={e => setGenerateCertificate(e.target.checked)}
                    className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8]"
                  />
                  <span>Générer l&apos;attestation de radiation scolaire</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyGuardian}
                    onChange={e => setNotifyGuardian(e.target.checked)}
                    className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8]"
                  />
                  <span>Notifier les tuteurs par SMS / Email</span>
                </label>
              </div>
            </div>

            {/* Legal Notice Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#17A673] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Conformité CNDP Loi 09-08 & Traçabilité :</span>
                <p className="mt-0.5">
                  Cette mutation est inscrite au registre d&apos;audit de l&apos;établissement avec horodatage, opérateur responsable et identifiants des campus concernés.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWizardStep(2)}
              className="text-xs border-slate-200 cursor-pointer"
            >
              Retour à l&apos;étape 2
            </Button>
            <Button
              disabled={submitting}
              onClick={handleExecuteTransfer}
              className="h-10 px-6 rounded-xl bg-[#17A673] hover:bg-[#149063] text-white text-xs font-bold gap-2 cursor-pointer shadow-2xs"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{submitting ? 'Validation en cours...' : 'Confirmer & Exécuter la Mutation'}</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Transfers History Section */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#2487B8]" />
            <h3 className="text-sm font-extrabold text-[#16212B]">
              Historique des Mutations Récentes
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Registre d&apos;audit certifié</span>
        </div>

        {stats?.recentTransfers && stats.recentTransfers.length > 0 ? (
          <div className="border border-slate-200/80 rounded-xl overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 text-start">Date</th>
                  <th className="py-2.5 px-3 text-start">Élève</th>
                  <th className="py-2.5 px-3 text-start">Matricule</th>
                  <th className="py-2.5 px-3 text-start">Campus de Destination</th>
                  <th className="py-2.5 px-3 text-start">Motif</th>
                  <th className="py-2.5 px-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      {t.createdAt?.slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#16212B]">
                      {t.studentName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                      {t.studentMatricule || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-[#1B6C93] font-semibold">
                      {t.toBranchName || 'Campus assigné'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">
                      {t.reason}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge className="bg-[#DDF5EC] text-[#17A673] border-[#17A673]/30 text-[10px] font-bold">
                        Effectif
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-slate-50/50 border border-slate-100 text-center">
            <p className="text-xs font-bold text-slate-500">Aucune mutation enregistrée pour le moment</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Les transferts d&apos;élèves entre campus apparaîtront automatiquement ici dès validation.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
