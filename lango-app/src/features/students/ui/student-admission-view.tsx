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
  MoreVertical,
  Upload,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// ponytail: matches applicantCreateSchema in src/libs/api/validation.ts (well,
// declared inline in the admissions route - see the route file) exactly.
// firstName/lastName/email/phone are required there; the rest optional.
type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
};

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
};

const STEPS = [
  { num: 1, label: 'Informations élève', sub: 'Identité & parcours' },
  { num: 2, label: 'Tuteur & contacts', sub: 'Responsables légaux' },
  { num: 3, label: 'Documents & consentements', sub: 'Pièces justificatives' },
  { num: 4, label: 'Validation & envoi', sub: 'Récapitulatif' },
] as const;

const DOCUMENTS = [
  { name: 'Photo d\'identité de l\'élève', format: 'JPG • max 5 Mo', required: true },
  { name: 'Acte de naissance', format: 'PDF • max 5 Mo', required: true },
  { name: 'Certificat de scolarité précédent', format: 'PDF • max 5 Mo', required: true },
  { name: 'Copie CNI du tuteur 1', format: 'PDF • max 5 Mo', required: true },
  { name: 'Copie CNI du tuteur 2 (si applicable)', format: 'PDF • max 5 Mo', required: false },
  { name: 'Bulletins scolaires (2 dernières années)', format: 'PDF • max 5 Mo', required: false },
];

function isStep1Valid(f: FormState) {
  return f.firstName.trim().length > 0 && f.lastName.trim().length > 0 && f.email.trim().length > 0 && f.phone.trim().length > 0;
}

export function StudentAdmissionView({ locale }: { locale: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const canGoNext = step !== 1 || isStep1Valid(form);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
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
          guardianName: form.guardianName || undefined,
          guardianPhone: form.guardianPhone || undefined,
          guardianEmail: form.guardianEmail || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Échec de la création de la demande.');
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setSubmitting(false);
    }
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
          <Button
            variant="outline"
            onClick={() => {
              setForm(EMPTY_FORM);
              setStep(1);
              setSubmitted(false);
            }}
            className="rounded-full"
          >
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
            { label: 'Dossiers en cours', value: '—', icon: FolderOpen, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
            { label: 'Dossiers complets', value: '—', icon: CheckCircle2, iconBg: 'bg-[#D1F5E8]', iconColor: 'text-[#17A673]' },
            { label: 'Documents manquants', value: '—', icon: AlertTriangle, iconBg: 'bg-[#FCF0DC]', iconColor: 'text-[#E8A33D]' },
            { label: 'Frais d\'inscription', value: '—', icon: Wallet, iconBg: 'bg-[#DCEBF4]', iconColor: 'text-[#1B6C93]' },
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
                  <label className="text-[10px] font-bold text-slate-500">Prénom *</label>
                  <Input
                    value={form.firstName}
                    onChange={set('firstName')}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Nom *</label>
                  <Input
                    value={form.lastName}
                    onChange={set('lastName')}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Email *</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Téléphone *</label>
                  <Input
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="+212 6 00 00 00 00"
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Date de naissance</label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={set('dateOfBirth')}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-1 text-sm font-extrabold text-[#16212B]">Tuteur & contacts</h2>
              <p className="mb-4 text-[10px] text-slate-500">Optionnel à cette étape - peut être complété plus tard depuis la fiche élève.</p>
              <div className="mb-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Nom du tuteur</label>
                  <Input
                    value={form.guardianName}
                    onChange={set('guardianName')}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Téléphone du tuteur</label>
                  <Input
                    value={form.guardianPhone}
                    onChange={set('guardianPhone')}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Email du tuteur</label>
                  <Input
                    type="email"
                    value={form.guardianEmail}
                    onChange={set('guardianEmail')}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-1 text-sm font-extrabold text-[#16212B]">Documents & consentements</h2>
              {/* ponytail: no upload endpoint exists yet - this step is intentionally
                  non-blocking display only, not wired to real file storage. */}
              <p className="mb-4 text-[10px] text-slate-500">Le téléversement de documents sera activé prochainement. Cette demande peut être créée sans pièces jointes.</p>
              <div className="mb-6 grid grid-cols-2 gap-3">
                {DOCUMENTS.map((doc, i) => (
                  <div
                    key={i}
                    className="
                      flex items-center gap-3 rounded-xl border border-slate-100
                      bg-slate-50 p-3
                    "
                  >
                    <div className="
                      flex size-9 items-center justify-center rounded-lg
                      bg-slate-100
                    "
                    >
                      <FileText className="size-4 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="
                        truncate text-[11px] font-bold text-[#16212B]
                      "
                      >
                        {doc.name}
                        {' '}
                        {doc.required && <span className="text-[#E5544B]">*</span>}
                      </p>
                      <p className="text-[9px] text-slate-400">{doc.format}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="h-7 gap-1 rounded-lg px-2.5 text-[10px]"
                    >
                      <Upload className="size-3" />
                      {' '}
                      Bientôt
                    </Button>
                    <button type="button" className="text-slate-400">
                      <MoreVertical className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="mb-3 text-xs font-bold text-[#16212B]">Consentements & autorisations</h3>
                {[
                  'J\'accepte que les informations fournies soient exactes et complètes.',
                  'J\'autorise l\'établissement à utiliser les données personnelles de l\'élève conformément à la loi 09-08 (CNDP).',
                ].map((c, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="mt-0.5 rounded-sm text-[#2487B8]"
                    />
                    <span className="text-[11px] text-slate-600">
                      {c}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mb-1 text-sm font-extrabold text-[#16212B]">Validation & envoi</h2>
              <p className="mb-4 text-[10px] text-slate-500">Vérifiez les informations avant de créer la demande.</p>
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
                  <span className="font-bold text-[#16212B]">
                    {form.email || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Téléphone</span>
                  <span className="font-bold text-[#16212B]">
                    {form.phone || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date de naissance</span>
                  <span className="font-bold text-[#16212B]">
                    {form.dateOfBirth || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tuteur</span>
                  <span className="font-bold text-[#16212B]">
                    {form.guardianName || '—'}
                  </span>
                </div>
              </div>
              {submitError && (
                <div className="
                  mt-4 rounded-xl bg-[#FCE4E2] p-3 text-xs font-semibold
                  text-[#E5544B]
                "
                >
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
              {step < 4 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canGoNext}
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
                  disabled={submitting || !isStep1Valid(form)}
                  onClick={handleSubmit}
                  className="h-10 gap-2 rounded-full bg-[#0066FF] px-5 text-xs"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {submitting ? 'Envoi...' : 'Créer la demande'}
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
          {form.guardianName
            ? (
                <div className="flex items-center gap-2 py-1.5">
                  <div className="
                    flex size-8 items-center justify-center rounded-full
                    bg-slate-200 text-[10px] font-bold text-slate-600
                  "
                  >
                    {form.guardianName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#16212B]">{form.guardianName}</p>
                    <p className="text-[9px] text-slate-400">
                      {form.guardianPhone || '—'}
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
