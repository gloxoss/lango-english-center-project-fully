'use client';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';

// ponytail: matches applicantCreateSchema/applicantPatchSchema in
// src/app/api/students/admissions/route.ts exactly (schemas are declared
// inline in that route file, not in validation.ts).
type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  motherTongue: string;
  city: string;
  bloodGroup: string;
  academicYearId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianOccupation: string;
  guardianAddress: string;
  guardianEmailOptIn: boolean;
  guardianSmsOptIn: boolean;
  guardianPreferredLanguage: string;
};

type StringField = { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState];

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  nationality: '',
  motherTongue: '',
  city: '',
  bloodGroup: '',
  academicYearId: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianOccupation: '',
  guardianAddress: '',
  guardianEmailOptIn: true,
  guardianSmsOptIn: true,
  guardianPreferredLanguage: '',
};

const STEPS = [
  { num: 1, label: 'Informations élève', sub: 'Identité & parcours' },
  { num: 2, label: 'Tuteur & contacts', sub: 'Responsables légaux' },
  { num: 3, label: 'Documents & consentements', sub: 'Pièces justificatives' },
  { num: 4, label: 'Validation & envoi', sub: 'Récapitulatif' },
] as const;

const DOCUMENTS = [
  { type: 'photo', name: 'Photo d\'identité de l\'élève', format: 'JPG/PNG • max 5 Mo', required: true },
  { type: 'birth_certificate', name: 'Acte de naissance', format: 'PDF • max 5 Mo', required: true },
  { type: 'school_certificate', name: 'Certificat de scolarité précédent', format: 'PDF • max 5 Mo', required: true },
  { type: 'guardian_cni', name: 'Copie CNI du tuteur', format: 'PDF • max 5 Mo', required: true },
  { type: 'bulletin', name: 'Bulletins scolaires (2 dernières années)', format: 'PDF • max 5 Mo', required: false },
] as const;

const MOTHER_TONGUE_OPTIONS = [
  { value: 'arabic', label: 'Arabe' },
  { value: 'french', label: 'Français' },
  { value: 'tamazight', label: 'Tamazight' },
  { value: 'english', label: 'Anglais' },
  { value: 'other', label: 'Autre' },
];

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

type AcademicYear = { id: string; name: string };
type GuardianResult = { id: string; name: string; phone: string; email: string; relation: string };

function isStep1Valid(f: FormState) {
  return f.firstName.trim().length > 0 && f.lastName.trim().length > 0 && f.email.trim().length > 0 && f.phone.trim().length > 0;
}

export function StudentAdmissionView({ locale }: { locale: string }) {
  const router = useRouter();
  const { role, loaded } = usePermissions();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Applicant is created as soon as Step 1 validates, not at final submit -
  // Step 3's document uploads need a real applicantId to attach to.
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [creatingApplicant, setCreatingApplicant] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  // Real pipeline counts for the four KPI cards, derived from the tenant's
  // existing admission requests (GET /api/students/admissions).
  const [kpi, setKpi] = useState({ inProgress: 0, complete: 0, missingDocs: 0, approved: 0 });

  // Step 2: guardian search-first.
  const [guardianSearch, setGuardianSearch] = useState('');
  const [guardianResults, setGuardianResults] = useState<GuardianResult[]>([]);
  const [guardianSearching, setGuardianSearching] = useState(false);
  const [guardianSearchAttempted, setGuardianSearchAttempted] = useState(false);
  const [guardianSearchError, setGuardianSearchError] = useState<string | null>(null);
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianResult | null>(null);
  const [showCreateGuardianForm, setShowCreateGuardianForm] = useState(false);

  // Step 3: real document uploads.
  const [uploadedDocTypes, setUploadedDocTypes] = useState<Set<string>>(new Set());
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [docUploadErrors, setDocUploadErrors] = useState<Record<string, string>>({});

  const set = (field: StringField) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const canGoNext = step !== 1 || isStep1Valid(form);

  useEffect(() => {
    fetch('/api/academics/academic-years')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setAcademicYears(json.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/students/admissions')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.success || !Array.isArray(json.data)) return;
        const rows = json.data as Array<{ status: string; checklistDocumentsReceived: boolean; checklistFileComplete: boolean }>;
        setKpi({
          inProgress: rows.filter(r => r.status === 'applied' || r.status === 'in_review').length,
          complete: rows.filter(r => r.checklistFileComplete).length,
          missingDocs: rows.filter(r => !r.checklistDocumentsReceived).length,
          approved: rows.filter(r => r.status === 'approved').length,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const query = guardianSearch.trim();
    if (query.length < 2) {
      setGuardianResults([]);
      return;
    }
    const handle = setTimeout(() => {
      setGuardianSearching(true);
      setGuardianSearchError(null);
      fetch(`/api/students/parents?search=${encodeURIComponent(query)}`)
        .then(res => (res.ok ? res.json() : Promise.reject(new Error('search failed'))))
        .then((json) => {
          if (json?.success) {
            setGuardianResults(json.data.map((g: any) => ({ id: g.id, name: g.name, phone: g.phone, email: g.email, relation: g.relation })));
          }
          setGuardianSearchAttempted(true);
        })
        .catch(() => setGuardianSearchError('Impossible de rechercher les tuteurs. Réessayez.'))
        .finally(() => setGuardianSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [guardianSearch]);

  async function handleGoToStep2() {
    if (applicantId) {
      setStep(2);
      return;
    }
    setCreatingApplicant(true);
    setStep1Error(null);
    try {
      const res = await fetch('/api/students/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          nationality: form.nationality || undefined,
          motherTongue: form.motherTongue || undefined,
          city: form.city || undefined,
          bloodGroup: form.bloodGroup || undefined,
          academicYearId: form.academicYearId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Échec de la création de la demande.');
      }
      setApplicantId(json.data.id);
      setStep(2);
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setCreatingApplicant(false);
    }
  }

  async function handleUploadDoc(docType: string, file: File) {
    if (!applicantId) {
      return;
    }
    setUploadingDocType(docType);
    setDocUploadErrors(prev => ({ ...prev, [docType]: '' }));
    try {
      const formData = new FormData();
      formData.append('applicantId', applicantId);
      formData.append('documentType', docType);
      formData.append('file', file);
      const res = await fetch('/api/students/admissions/documents', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Échec du téléversement.');
      }
      setUploadedDocTypes(prev => new Set(prev).add(docType));
    } catch (err) {
      setDocUploadErrors(prev => ({ ...prev, [docType]: err instanceof Error ? err.message : 'Échec du téléversement.' }));
    } finally {
      setUploadingDocType(null);
    }
  }

  async function handleSubmit() {
    if (!applicantId) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/students/admissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selectedGuardian
            ? { id: applicantId, guardianId: selectedGuardian.id }
            : {
                id: applicantId,
                guardianName: form.guardianName || undefined,
                guardianPhone: form.guardianPhone || undefined,
                guardianEmail: form.guardianEmail || undefined,
                occupation: form.guardianOccupation || undefined,
                address: form.guardianAddress || undefined,
                emailOptIn: form.guardianEmailOptIn,
                smsOptIn: form.guardianSmsOptIn,
                preferredLanguage: form.guardianPreferredLanguage || undefined,
              },
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Échec de la mise à jour de la demande.');
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setForm(EMPTY_FORM);
    setStep(1);
    setSubmitted(false);
    setApplicantId(null);
    setSelectedGuardian(null);
    setShowCreateGuardianForm(false);
    setGuardianSearch('');
    setGuardianResults([]);
    setGuardianSearchAttempted(false);
    setUploadedDocTypes(new Set());
  }

  // POST /api/students/admissions is school_admin-only server-side - show
  // that upfront instead of letting the user fill 4 steps then hit a 403.
  if (loaded && role !== 'school_admin') {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle className="size-8" />
        </div>
        <h1 className="text-xl font-extrabold text-[#16212B]">Accès non autorisé</h1>
        <p className="text-sm text-slate-500">
          Vous ne disposez pas des autorisations nécessaires pour créer une demande d&apos;admission.
        </p>
        <Button variant="outline" onClick={() => router.push(`/${locale}/dashboard/students`)} className="rounded-full">
          Retour au répertoire des élèves
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-16 text-center">
        <div className="
          mx-auto flex size-16 items-center justify-center rounded-full
          bg-[#D1F5E8] text-[#17A673]
        "
        >
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-xl font-extrabold text-[#16212B]">Demande d&apos;admission créée</h1>
        <p className="text-sm text-slate-500">
          Le dossier de
          {' '}
          {form.firstName}
          {' '}
          {form.lastName}
          {' '}
          a été enregistré. Il apparaît maintenant dans la liste des demandes en attente.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" onClick={resetWizard} className="rounded-full">
            Nouvelle demande
          </Button>
          <Button
            variant="primary"
            onClick={() => router.push(`/${locale}/dashboard/students/admissions`)}
            className="rounded-full bg-[#0066FF]"
          >
            Voir les demandes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Admission d&apos;un élève</h1>
          <p className="mt-1 text-xs text-slate-500">Création d&apos;un dossier d&apos;inscription en quatre étapes</p>
        </div>

        {/* Steps */}
        <div className="
          flex items-center gap-0 rounded-2xl border border-slate-200/80
          bg-white p-4 shadow-2xs
        "
        >
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex flex-1 items-center">
              <div className="flex items-center gap-3">
                <div className={`
                  flex size-8 items-center justify-center rounded-full text-xs
                  font-bold
                  ${s.num < step
              ? `bg-[#17A673] text-white`
              : s.num === step
                ? `bg-[#2487B8] text-white`
                : `bg-slate-200 text-slate-500`}
                `}
                >
                  {s.num < step ? <Check className="size-4" /> : s.num}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#16212B]">{s.label}</p>
                  <p className={`
                    text-[10px]
                    ${s.num === step
              ? 'font-bold text-[#2487B8]'
              : `text-slate-400`}
                  `}
                  >
                    {s.sub}
                  </p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`
                  mx-4 h-0.5 flex-1
                  ${s.num < step
                  ? `bg-[#17A673]`
                  : `bg-slate-200`}
                `}
                />
              )}
            </div>
          ))}
        </div>

        {/* KPIs - contextual counts, not tied to this specific submission */}
        <div className="
          grid grid-cols-1 gap-4
          sm:grid-cols-2
          lg:grid-cols-4
        "
        >
          {[
            { label: 'Dossiers en cours', value: kpi.inProgress, icon: FolderOpen, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
            { label: 'Dossiers complets', value: kpi.complete, icon: CheckCircle2, iconBg: 'bg-[#D1F5E8]', iconColor: 'text-[#17A673]' },
            { label: 'Documents manquants', value: kpi.missingDocs, icon: AlertTriangle, iconBg: 'bg-[#FCF0DC]', iconColor: 'text-[#E8A33D]' },
            { label: 'Frais d\'inscription', value: kpi.approved, icon: Wallet, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
          ].map((kpi, i) => (
            <Card
              key={i}
              className="
                flex items-center justify-between rounded-2xl border
                border-slate-200/80 bg-white p-5 shadow-2xs
              "
            >
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-[#16212B]">{kpi.value}</p>
              </div>
              <div className={`
                size-10 rounded-full
                ${kpi.iconBg}
                ${kpi.iconColor}
                flex items-center justify-center
              `}
              >
                <kpi.icon className="size-5" />
              </div>
            </Card>
          ))}
        </div>

        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs
        "
        >
          {step === 1 && (
            <div>
              <h2 className="mb-1 text-sm font-extrabold text-[#16212B]">Informations de l&apos;élève</h2>
              <p className="mb-4 text-[10px] text-slate-500">Champs marqués * requis pour créer la demande.</p>
              <div className="mb-3 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admission-first-name" className="text-[10px] font-bold text-slate-500">Prénom *</label>
                  <Input id="admission-first-name" value={form.firstName} onChange={set('firstName')} className="mt-1 h-10 rounded-xl text-xs" />
                </div>
                <div>
                  <label htmlFor="admission-last-name" className="text-[10px] font-bold text-slate-500">Nom *</label>
                  <Input id="admission-last-name" value={form.lastName} onChange={set('lastName')} className="mt-1 h-10 rounded-xl text-xs" />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admission-email" className="text-[10px] font-bold text-slate-500">Email *</label>
                  <Input id="admission-email" type="email" value={form.email} onChange={set('email')} className="mt-1 h-10 rounded-xl text-xs" />
                </div>
                <div>
                  <label htmlFor="admission-phone" className="text-[10px] font-bold text-slate-500">Téléphone *</label>
                  <Input id="admission-phone" value={form.phone} onChange={set('phone')} placeholder="+212 6 00 00 00 00" className="mt-1 h-10 rounded-xl text-xs" />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="admission-dob" className="text-[10px] font-bold text-slate-500">Date de naissance</label>
                  <Input id="admission-dob" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className="mt-1 h-10 rounded-xl text-xs" />
                </div>
                <div>
                  <label htmlFor="admission-gender" className="text-[10px] font-bold text-slate-500">Genre</label>
                  <select id="admission-gender" value={form.gender} onChange={set('gender')} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs">
                    <option value="">Sélectionner...</option>
                    <option value="female">Femme</option>
                    <option value="male">Homme</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="admission-year" className="text-[10px] font-bold text-slate-500">Année scolaire</label>
                  <select id="admission-year" value={form.academicYearId} onChange={set('academicYearId')} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs">
                    <option value="">Sélectionner...</option>
                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="admission-nationality" className="text-[10px] font-bold text-slate-500">Nationalité</label>
                  <Input id="admission-nationality" value={form.nationality} onChange={set('nationality')} className="mt-1 h-10 rounded-xl text-xs" />
                </div>
                <div>
                  <label htmlFor="admission-mother-tongue" className="text-[10px] font-bold text-slate-500">Langue maternelle</label>
                  <select id="admission-mother-tongue" value={form.motherTongue} onChange={set('motherTongue')} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs">
                    <option value="">Sélectionner...</option>
                    {MOTHER_TONGUE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="admission-city" className="text-[10px] font-bold text-slate-500">Ville</label>
                  <Input id="admission-city" value={form.city} onChange={set('city')} className="mt-1 h-10 rounded-xl text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="admission-blood-group" className="text-[10px] font-bold text-slate-500">Groupe sanguin (optionnel)</label>
                  <select id="admission-blood-group" value={form.bloodGroup} onChange={set('bloodGroup')} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs">
                    <option value="">Non renseigné</option>
                    {BLOOD_GROUP_OPTIONS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>
              {step1Error && (
                <div className="mt-4 rounded-xl bg-[#FCE4E2] p-3 text-xs font-semibold text-[#E5544B]">
                  {step1Error}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-1 text-sm font-extrabold text-[#16212B]">Tuteur & contacts</h2>
              <p className="mb-4 text-[10px] text-slate-500">Recherchez un tuteur déjà enregistré avant d&apos;en créer un nouveau - évite les doublons pour les fratries.</p>

              {!selectedGuardian && (
                <div className="mb-4">
                  <label htmlFor="admission-guardian-search" className="text-[10px] font-bold text-slate-500">Rechercher un tuteur (nom ou téléphone)</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="admission-guardian-search"
                      value={guardianSearch}
                      onChange={e => setGuardianSearch(e.target.value)}
                      placeholder="Ex. Karim Bennani ou 06..."
                      className="h-10 rounded-xl pl-9 text-xs"
                    />
                  </div>
                  {guardianSearching && <p className="mt-2 text-[10px] text-slate-400">Recherche...</p>}
                  {guardianSearchError && <p className="mt-2 text-[10px] font-semibold text-rose-600">{guardianSearchError}</p>}
                  {!guardianSearching && !guardianSearchError && guardianResults.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {guardianResults.map(g => (
                        <button
                          type="button"
                          key={g.id}
                          onClick={() => { setSelectedGuardian(g); setShowCreateGuardianForm(false); }}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:bg-[#DCEBF4]/40"
                        >
                          <div>
                            <p className="text-xs font-bold text-[#16212B]">{g.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {g.phone || '—'}
                              {' '}
                              •
                              {' '}
                              {g.relation || 'Tuteur'}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-[#2487B8]">Sélectionner</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!guardianSearching && guardianSearchAttempted && guardianResults.length === 0 && guardianSearch.trim().length >= 2 && (
                    <p className="mt-2 text-[10px] text-slate-400">Aucun tuteur trouvé.</p>
                  )}
                  {guardianSearchAttempted && (
                    <button
                      type="button"
                      onClick={() => setShowCreateGuardianForm(true)}
                      className="mt-3 text-[11px] font-bold text-[#2487B8] hover:underline"
                    >
                      Aucun tuteur trouvé ? Créer un nouveau tuteur
                    </button>
                  )}
                </div>
              )}

              {selectedGuardian && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-[#DCEBF4] bg-[#DCEBF4]/30 p-3">
                  <div>
                    <p className="text-xs font-bold text-[#16212B]">{selectedGuardian.name}</p>
                    <p className="text-[10px] text-slate-500">{selectedGuardian.phone || '—'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGuardian(null)}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-rose-600"
                  >
                    <X className="size-3" />
                    Changer
                  </button>
                </div>
              )}

              {!selectedGuardian && showCreateGuardianForm && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-bold text-[#16212B]">Nouveau tuteur</p>
                  <div className="mb-3 grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="admission-guardian-name" className="text-[10px] font-bold text-slate-500">Nom du tuteur</label>
                      <Input id="admission-guardian-name" value={form.guardianName} onChange={set('guardianName')} className="mt-1 h-10 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label htmlFor="admission-guardian-phone" className="text-[10px] font-bold text-slate-500">Téléphone du tuteur</label>
                      <Input id="admission-guardian-phone" value={form.guardianPhone} onChange={set('guardianPhone')} className="mt-1 h-10 rounded-xl text-xs" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="admission-guardian-email" className="text-[10px] font-bold text-slate-500">Email du tuteur</label>
                    <Input id="admission-guardian-email" type="email" value={form.guardianEmail} onChange={set('guardianEmail')} className="mt-1 h-10 rounded-xl text-xs" />
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="admission-guardian-occupation" className="text-[10px] font-bold text-slate-500">Profession</label>
                      <Input id="admission-guardian-occupation" value={form.guardianOccupation} onChange={set('guardianOccupation')} className="mt-1 h-10 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label htmlFor="admission-guardian-pref-lang" className="text-[10px] font-bold text-slate-500">Langue de communication</label>
                      <select id="admission-guardian-pref-lang" value={form.guardianPreferredLanguage} onChange={set('guardianPreferredLanguage')} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs">
                        <option value="">Par défaut</option>
                        <option value="fr">Français</option>
                        <option value="ar">Arabe</option>
                        <option value="en">Anglais</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="admission-guardian-address" className="text-[10px] font-bold text-slate-500">Adresse</label>
                    <Input id="admission-guardian-address" value={form.guardianAddress} onChange={set('guardianAddress')} className="mt-1 h-10 rounded-xl text-xs" />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <input type="checkbox" checked={form.guardianEmailOptIn} onChange={e => setForm(prev => ({ ...prev, guardianEmailOptIn: e.target.checked }))} className="rounded border-slate-300" />
                      Email
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <input type="checkbox" checked={form.guardianSmsOptIn} onChange={e => setForm(prev => ({ ...prev, guardianSmsOptIn: e.target.checked }))} className="rounded border-slate-300" />
                      SMS
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-1 text-sm font-extrabold text-[#16212B]">Documents & consentements</h2>
              <p className="mb-4 text-[10px] text-slate-500">Cliquez sur un document pour le téléverser. Enregistré immédiatement.</p>
              <div className="mb-6 grid grid-cols-2 gap-3">
                {DOCUMENTS.map((doc) => {
                  const uploaded = uploadedDocTypes.has(doc.type);
                  const uploading = uploadingDocType === doc.type;
                  const error = docUploadErrors[doc.type];
                  return (
                    <div key={doc.type} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className={`flex size-9 items-center justify-center rounded-lg ${uploaded ? 'bg-[#D1F5E8]' : 'bg-slate-100'}`}>
                        {uploaded ? <CheckCircle2 className="size-4 text-[#17A673]" /> : <FileText className="size-4 text-slate-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`admission-doc-${doc.type}`} className="block truncate text-[11px] font-bold text-[#16212B]">
                          {doc.name}
                          {' '}
                          {doc.required && <span className="text-[#E5544B]">*</span>}
                        </label>
                        <p className="text-[9px] text-slate-400">{error ? <span className="text-rose-600">{error}</span> : doc.format}</p>
                      </div>
                      <input
                        id={`admission-doc-${doc.type}`}
                        type="file"
                        accept={doc.type === 'photo' ? 'image/jpeg,image/png' : 'image/jpeg,image/png,application/pdf'}
                        className="hidden"
                        disabled={!applicantId || uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadDoc(doc.type, file);
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!applicantId || uploading}
                        onClick={() => document.getElementById(`admission-doc-${doc.type}`)?.click()}
                        className="h-7 gap-1 rounded-lg px-2.5 text-[10px]"
                      >
                        {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                        {' '}
                        {uploaded ? 'Remplacer' : 'Téléverser'}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div>
                <h3 className="mb-3 text-xs font-bold text-[#16212B]">Consentements & autorisations</h3>
                {[
                  'J\'accepte que les informations fournies soient exactes et complètes.',
                  'J\'autorise l\'établissement à utiliser les données personnelles de l\'élève conformément à la loi 09-08 (CNDP).',
                ].map((c, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <input
                      id={`admission-consent-${i}`}
                      type="checkbox"
                      defaultChecked
                      className="mt-0.5 rounded-sm text-[#2487B8]"
                    />
                    <label htmlFor={`admission-consent-${i}`} className="text-[11px] text-slate-600">
                      {c}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mb-1 text-sm font-extrabold text-[#16212B]">Validation & envoi</h2>
              <p className="mb-4 text-[10px] text-slate-500">Vérifiez les informations avant de finaliser la demande.</p>
              <div className="space-y-2 rounded-xl bg-[#F6F9FC] p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Élève</span>
                  <span className="font-bold text-[#16212B]">
                    {form.firstName}
                    {' '}
                    {form.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-bold text-[#16212B]">{form.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Téléphone</span>
                  <span className="font-bold text-[#16212B]">{form.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tuteur</span>
                  <span className="font-bold text-[#16212B]">{selectedGuardian?.name || form.guardianName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Documents téléversés</span>
                  <span className="font-bold text-[#16212B]">
                    {uploadedDocTypes.size}
                    {' '}
                    /
                    {' '}
                    {DOCUMENTS.length}
                  </span>
                </div>
              </div>
              {submitError && (
                <div className="mt-4 rounded-xl bg-[#FCE4E2] p-3 text-xs font-semibold text-[#E5544B]">
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={step === 1}
              onClick={() => setStep(s => Math.max(1, s - 1))}
              className="h-10 gap-2 rounded-full px-5 text-xs"
            >
              <ChevronLeft className="size-4" />
              {' '}
              Précédent
            </Button>
            <div className="flex gap-2">
              {step === 1 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canGoNext || creatingApplicant}
                  onClick={handleGoToStep2}
                  className="h-10 gap-2 rounded-full bg-[#0066FF] px-5 text-xs"
                >
                  {creatingApplicant ? <Loader2 className="size-4 animate-spin" /> : null}
                  {creatingApplicant ? 'Création...' : 'Suivant'}
                  {!creatingApplicant && <ChevronRight className="size-4" />}
                </Button>
              )}
              {step > 1 && step < 4 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setStep(s => Math.min(4, s + 1))}
                  className="h-10 gap-2 rounded-full bg-[#0066FF] px-5 text-xs"
                >
                  Suivant
                  {' '}
                  <ChevronRight className="size-4" />
                </Button>
              )}
              {step === 4 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="h-10 gap-2 rounded-full bg-[#0066FF] px-5 text-xs"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {submitting ? 'Envoi...' : 'Finaliser la demande'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Right Inspector - reflects real entered data */}
      <div className="
        hidden w-[320px] shrink-0 space-y-4
        xl:block
      "
      >
        <Card className="
          rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
        "
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#16212B]">Résumé du dossier</h3>
            <Badge className="bg-[#FCF0DC] text-[9px] text-[#E8A33D]">Dossier en cours</Badge>
          </div>
          <h4 className="mb-2 text-xs font-bold text-[#16212B]">Élève</h4>
          <div className="mb-4 flex items-center gap-3">
            <div className="
              flex size-12 items-center justify-center rounded-full bg-slate-200
              text-sm font-bold text-slate-600
            "
            >
              {(form.firstName[0] || '') + (form.lastName[0] || '') || '—'}
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#16212B]">{form.firstName || form.lastName ? `${form.firstName} ${form.lastName}` : 'Non renseigné'}</p>
              <p className="text-[10px] text-slate-400">{form.dateOfBirth || 'Date de naissance non renseignée'}</p>
            </div>
          </div>

          <h4 className="mb-2 text-xs font-bold text-[#16212B]">Tuteur</h4>
          {(selectedGuardian || form.guardianName)
            ? (
                <div className="flex items-center gap-2 py-1.5">
                  <div className="
                    flex size-8 items-center justify-center rounded-full
                    bg-slate-200 text-[10px] font-bold text-slate-600
                  "
                  >
                    {(selectedGuardian?.name || form.guardianName).split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#16212B]">{selectedGuardian?.name || form.guardianName}</p>
                    <p className="text-[9px] text-slate-400">
                      {selectedGuardian?.phone || form.guardianPhone || '—'}
                    </p>
                  </div>
                </div>
              )
            : <p className="text-[11px] text-slate-400">Non renseigné</p>}
        </Card>
      </div>
    </div>
  );
}
