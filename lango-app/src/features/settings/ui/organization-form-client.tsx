// organization-form-client.tsx
// CLIENT ISLAND — owns all form state, save mutation, logo/favicon upload
// Server Component (organization-page.tsx) fetches initial data and passes it as props.
'use client';

import {
  AlertCircle,
  Building2,
  CheckCircle,
  ChevronRight,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Languages,
  Palette,
  Save,
  Shield,
  Upload,
  User,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import React, { useRef, useState, useTransition } from 'react';
import { INSTITUTIONAL_CONTACT_ROLES } from '@/features/settings/data/institutional-contacts-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrganisationFormData = {
  establishmentName: string;
  shortName: string;
  city: string;
  address: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  phone: string;
  email: string;
  website: string;
  country: string;
  rc: string;
  ice: string;
  taxId: string;
  legalStatus: string;
  menAuthorizationNumber: string;
  regionalAcademy: string;
  provincialDirection: string;
  officialStampUrl: string;
  directorSignatureUrl: string;
  directorName: string;
  directorEmail: string;
  directorPhone: string;
  financialContactName: string;
  financialContactEmail: string;
  financialContactPhone: string;
  admissionsContactName: string;
  admissionsContactEmail: string;
  admissionsContactPhone: string;
  allowOperations: boolean;
  presenceModes: Record<string, boolean>;
  languages: Record<string, boolean>;
  security: Record<string, boolean>;
  localeTimezone: string;
  dateFormat: string;
  documentHeaderStyle: 'classique' | 'minimal' | 'moderne';
};

type Props = {
  initialData: OrganisationFormData;
  hasLogo: boolean;
  hasFavicon: boolean;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="
      overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white
    "
    >
      <div className="
        flex items-center gap-3 border-b border-[#F3F4F6] px-6 py-4
      "
      >
        <div className="
          flex size-8 items-center justify-center rounded-lg bg-[#F0F4FF]
        "
        >
          <Icon className="size-4 text-[#4B6BFB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, children, hint, error, required }: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="
        flex items-center justify-between text-xs font-medium text-[#374151]
      "
      >
        <span>
          {label}
          {required && <span className="ml-1 font-bold text-red-500">*</span>}
        </span>
      </label>
      {children}
      {error
        ? (
            <p
              role="alert"
              className="
                mt-0.5 flex items-center gap-1.5 text-xs font-medium
                text-red-600 duration-150
              "
            >
              <AlertCircle className="size-3.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </p>
          )
        : hint
          ? (
              <p className="text-xs text-[#9CA3AF]">{hint}</p>
            )
          : null}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled, error, id }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: boolean | string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      className={`
        w-full rounded-lg px-3 py-2 text-sm transition-all
        focus:outline-none
        disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]
        ${
    error
      ? `
        border border-red-400 bg-red-50/40 text-red-900
        placeholder:text-red-300
        focus:border-red-500 focus:ring-2 focus:ring-red-400/20
      `
      : `
        border border-[#E5E7EB] bg-white text-[#111827]
        placeholder:text-[#9CA3AF]
        focus:border-[#4B6BFB] focus:ring-2 focus:ring-[#4B6BFB]/20
      `
    }
      `}
    />
  );
}

function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors
        focus:ring-2 focus:ring-[#4B6BFB]/30 focus:outline-none
        ${checked ? 'bg-[#4B6BFB]' : 'bg-[#D1D5DB]'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block size-4 transform rounded-full
          bg-white shadow-sm transition-transform
          ${checked
      ? 'translate-x-4'
      : `translate-x-0`}
        `}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function LogoUploadZone({
  src,
  label,
  uploadKey,
  onUploaded,
}: {
  src: string | null;
  label: string;
  uploadKey: 'logo' | 'favicon';
  onUploaded: () => void;
}) {
  const t = useTranslations('OrganizationSettings');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError(t('uploadTypeError'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t('uploadSizeError'));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = uploadKey === 'favicon'
        ? '/api/settings/logo?type=favicon'
        : '/api/settings/logo';
      const res = await fetch(url, { method: 'POST', body: fd });
      if (!res.ok) {
        throw new Error('Upload failed');
      }
      onUploaded();
    } catch {
      setError(t('uploadError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="
          flex size-20 cursor-pointer items-center justify-center
          overflow-hidden rounded-xl border-2 border-dashed border-[#E5E7EB]
          bg-[#F9FAFB] transition-colors
          hover:border-[#4B6BFB]/50
        "
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) {
            handleFile(file);
          }
        }}
      >
        {src
          ? (
              <Image
                src={src}
                alt={label}
                width={80}
                height={80}
                className="size-full object-cover"
                unoptimized
              />
            )
          : (
              <ImageIcon className="size-6 text-[#D1D5DB]" />
            )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="
            flex items-center gap-1.5 rounded-lg bg-[#F0F4FF] px-3 py-1.5
            text-xs font-medium text-[#4B6BFB] transition-colors
            hover:bg-[#E0E8FF]
            disabled:opacity-50
          "
        >
          <Upload className="size-3" />
          {uploading ? t('uploading') : t('change', { item: label })}
        </button>
        <span className="text-xs text-[#9CA3AF]">{t('uploadHint')}</span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── DOCUMENT STYLE PICKER ────────────────────────────────────────────────────

// Labels live in OrganizationSettings.docStyles.<key>.
const DOC_STYLES: Array<'classique' | 'minimal' | 'moderne'> = ['classique', 'minimal', 'moderne'];

// ─── MAIN CLIENT FORM ─────────────────────────────────────────────────────────

export function OrganisationFormClient({ initialData, hasLogo, hasFavicon }: Props) {
  const t = useTranslations('OrganizationSettings');
  const locale = useLocale();
  // Stored toggle keys (presence, francais, ...) have labels when known.
  const toggleLabel = (group: 'presenceModes' | 'languages', key: string) => (t.has(`${group}.${key}`) ? t(`${group}.${key}` as 'languages.fr') : key);
  const [form, setForm] = useState<OrganisationFormData>(initialData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [logoTs, setLogoTs] = useState(Date.now());
  const [faviconTs, setFaviconTs] = useState(Date.now());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function field<K extends keyof OrganisationFormData>(key: K) {
    return (value: string) => {
      setForm(prev => ({ ...prev, [key]: value }));
      if (fieldErrors[key as string]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[key as string];
          return next;
        });
      }
    };
  }

  function toggleJsonb(section: 'presenceModes' | 'languages' | 'security', key: string) {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: !prev[section][key] },
    }));
  }

  function validateClient(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.establishmentName.trim()) {
      errs.establishmentName = t('nameRequired');
    }
    const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
    if (form.email.trim() && !emailRegex.test(form.email.trim())) {
      errs.email = t('invalidEmail', { example: 'contact@ecole.ma' });
    }
    if (form.directorEmail.trim() && !emailRegex.test(form.directorEmail.trim())) {
      errs.directorEmail = t('invalidEmail', { example: 'direction@ecole.ma' });
    }
    if (form.financialContactEmail.trim() && !emailRegex.test(form.financialContactEmail.trim())) {
      errs.financialContactEmail = t('invalidEmail', { example: 'finance@ecole.ma' });
    }
    if (form.admissionsContactEmail.trim() && !emailRegex.test(form.admissionsContactEmail.trim())) {
      errs.admissionsContactEmail = t('invalidEmail', { example: 'admissions@ecole.ma' });
    }
    return errs;
  }

  async function handleSave() {
    startTransition(async () => {
      setSaveStatus('idle');
      const clientErrors = validateClient();
      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        setSaveStatus('error');
        const count = Object.keys(clientErrors).length;
        setErrorMsg(t('fieldErrors', { count }));
        return;
      }

      setFieldErrors({});
      setErrorMsg('');

      try {
        const payload = {
          ...form,
          email: form.email.trim() || null,
          directorEmail: form.directorEmail.trim() || null,
          financialContactEmail: form.financialContactEmail.trim() || null,
          admissionsContactEmail: form.admissionsContactEmail.trim() || null,
          startDate: form.startDate.trim() || null,
          endDate: form.endDate.trim() || null,
        };

        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          const extracted: Record<string, string> = {};
          if (data.error?.details?.fieldErrors) {
            Object.assign(extracted, data.error.details.fieldErrors);
          } else if (typeof data.error?.message === 'string') {
            const parts = data.error.message.split(';');
            for (const part of parts) {
              const [fName, ...msgParts] = part.split(':');
              if (fName && msgParts.length > 0) {
                extracted[fName.trim()] = msgParts.join(':').trim();
              }
            }
          }
          if (Object.keys(extracted).length > 0) {
            setFieldErrors(extracted);
            const count = Object.keys(extracted).length;
            throw new Error(t('fieldErrors', { count }));
          }
          throw new Error(data.error?.message ?? t('saveError'));
        }
        setSaveStatus('success');
        setTimeout(setSaveStatus, 3000, 'idle');
      } catch (err) {
        setSaveStatus('error');
        setErrorMsg(err instanceof Error ? err.message : t('unknownError'));
      }
    });
  }

  const logoSrc = hasLogo ? `/api/settings/logo?t=${logoTs}` : null;
  const faviconSrc = hasFavicon ? `/api/settings/logo?type=favicon&t=${faviconTs}` : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-20">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            {t('subtitle')}
          </p>
        </div>
        <button
          id="save-settings-btn"
          onClick={handleSave}
          disabled={isPending}
          className="
            flex items-center gap-2 rounded-xl bg-[#4B6BFB] px-4 py-2 text-sm
            font-medium text-white shadow-sm shadow-[#4B6BFB]/20 transition-all
            hover:bg-[#3B5BDB]
            disabled:opacity-60
          "
        >
          <Save className="size-4" />
          {isPending ? t('saving') : t('save')}
        </button>
      </div>

      {/* ── Save feedback ── */}
      {saveStatus === 'success' && (
        <div className="
          flex items-center gap-2 rounded-xl border border-emerald-200
          bg-emerald-50 px-4 py-3 text-sm text-emerald-700
        "
        >
          <CheckCircle className="size-4 shrink-0" />
          {t('saved')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="
          flex items-center gap-2 rounded-xl border border-red-200 bg-red-50
          px-4 py-3 text-sm text-red-700
        "
        >
          <AlertCircle className="size-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Section 1: Identité Visuelle ── */}
      <SectionCard icon={ImageIcon} title={t('sectionVisual')}>
        <div className="
          grid grid-cols-1 gap-8
          sm:grid-cols-2
        "
        >
          <div>
            <p className="mb-3 text-xs font-medium text-[#374151]">{t('schoolLogo')}</p>
            <LogoUploadZone
              src={logoSrc}
              label={t('theLogo')}
              uploadKey="logo"
              onUploaded={() => setLogoTs(Date.now())}
            />
          </div>
          <div>
            <p className="mb-3 text-xs font-medium text-[#374151]">{t('favicon')}</p>
            <LogoUploadZone
              src={faviconSrc}
              label={t('theFavicon')}
              uploadKey="favicon"
              onUploaded={() => setFaviconTs(Date.now())}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Informations Générales ── */}
      <SectionCard icon={Building2} title={t('sectionGeneral')}>
        <div className="
          grid grid-cols-1 gap-4
          sm:grid-cols-2
        "
        >
          <Field label={t('fullName')} required error={fieldErrors.establishmentName}>
            <Input value={form.establishmentName} onChange={field('establishmentName')} placeholder="ex: SchoolOS English Center" error={!!fieldErrors.establishmentName} />
          </Field>
          <Field label={t('shortName')} hint={t('shortNameHint')} error={fieldErrors.shortName}>
            <Input value={form.shortName} onChange={field('shortName')} placeholder="ex: LEC" error={!!fieldErrors.shortName} />
          </Field>
          <Field label={t('city')} error={fieldErrors.city}>
            <Input value={form.city} onChange={field('city')} placeholder={t('cityPlaceholder')} error={!!fieldErrors.city} />
          </Field>
          <Field label={t('country')} error={fieldErrors.country}>
            <Input value={form.country} onChange={field('country')} placeholder={t('countryPlaceholder')} error={!!fieldErrors.country} />
          </Field>
          <Field label={t('address')} error={fieldErrors.address}>
            <Input value={form.address} onChange={field('address')} placeholder={t('addressPlaceholder')} error={!!fieldErrors.address} />
          </Field>
          <Field label={t('website')} error={fieldErrors.website}>
            <Input value={form.website} onChange={field('website')} type="url" placeholder="https://" error={!!fieldErrors.website} />
          </Field>
          <Field label={t('phone')} error={fieldErrors.phone}>
            <Input value={form.phone} onChange={field('phone')} type="tel" placeholder="+212 5 22 00 00 00" error={!!fieldErrors.phone} />
          </Field>
          <Field label={t('email')} error={fieldErrors.email}>
            <Input value={form.email} onChange={field('email')} type="email" placeholder="contact@schoolos.ma" error={!!fieldErrors.email} />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 3: Année scolaire ── */}
      <SectionCard icon={GraduationCap} title={t('sectionYear')}>
        <div className="
          grid grid-cols-1 gap-4
          sm:grid-cols-3
        "
        >
          <Field label={t('schoolYear')} required hint={t('schoolYearHint')} error={fieldErrors.academicYear}>
            <Input value={form.academicYear} onChange={field('academicYear')} placeholder="2026-2027" error={!!fieldErrors.academicYear} />
          </Field>
          <Field label={t('startDate')} error={fieldErrors.startDate}>
            <Input value={form.startDate} onChange={field('startDate')} type="date" error={!!fieldErrors.startDate} />
          </Field>
          <Field label={t('endDate')} error={fieldErrors.endDate}>
            <Input value={form.endDate} onChange={field('endDate')} type="date" error={!!fieldErrors.endDate} />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 4: Informations Légales ── */}
      <SectionCard icon={FileText} title={t('sectionLegal')}>
        <div className="
          grid grid-cols-1 gap-4
          sm:grid-cols-2
        "
        >
          <Field label={t('legalStatus')} error={fieldErrors.legalStatus}>
            <Input value={form.legalStatus} onChange={field('legalStatus')} placeholder={t('legalStatusPlaceholder')} error={!!fieldErrors.legalStatus} />
          </Field>
          <Field label={t('rc')} error={fieldErrors.rc}>
            <Input value={form.rc} onChange={field('rc')} placeholder="ex: RC 123456" error={!!fieldErrors.rc} />
          </Field>
          <Field label="ICE" hint={t('iceHint')} error={fieldErrors.ice}>
            <Input value={form.ice} onChange={field('ice')} placeholder="ex: 001234567000012" error={!!fieldErrors.ice} />
          </Field>
          <Field label={t('taxId')} error={fieldErrors.taxId}>
            <Input value={form.taxId} onChange={field('taxId')} placeholder="ex: 12345678" error={!!fieldErrors.taxId} />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 4b: Agrément MEN, Cachet & Signature (Maroc) ── */}
      <SectionCard icon={FileText} title={t('sectionMen')}>
        <div className="space-y-4">
          <div className="
            rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs/relaxed
            text-blue-900
          "
          >
            <p className="font-bold">{t('law0600Title')}</p>
            <p className="mt-0.5 text-[11px] text-blue-800/80">
              {t('law0600Body')}
            </p>
          </div>

          <div className="
            grid grid-cols-1 gap-4
            sm:grid-cols-3
          "
          >
            <Field label={t('menNumber')} hint={t('menNumberHint')} error={fieldErrors.menAuthorizationNumber}>
              <Input
                value={form.menAuthorizationNumber}
                onChange={field('menAuthorizationNumber')}
                placeholder="ex: 06/1234/EP"
                error={!!fieldErrors.menAuthorizationNumber}
              />
            </Field>
            <Field label={t('aref')} hint={t('arefHint')} error={fieldErrors.regionalAcademy}>
              <Input
                value={form.regionalAcademy}
                onChange={field('regionalAcademy')}
                placeholder="ex: AREF Casablanca-Settat"
                error={!!fieldErrors.regionalAcademy}
              />
            </Field>
            <Field label={t('provincial')} hint={t('provincialHint')} error={fieldErrors.provincialDirection}>
              <Input
                value={form.provincialDirection}
                onChange={field('provincialDirection')}
                placeholder={t('provincialPlaceholder')}
                error={!!fieldErrors.provincialDirection}
              />
            </Field>
          </div>

          <div className="
            grid grid-cols-1 gap-4 border-t border-slate-100 pt-2
            sm:grid-cols-2
          "
          >
            <Field
              label={t('stampUrl')}
              hint={t('stampUrlHint')}
              error={fieldErrors.officialStampUrl}
            >
              <Input
                value={form.officialStampUrl}
                onChange={field('officialStampUrl')}
                placeholder={t('stampPlaceholder')}
                error={!!fieldErrors.officialStampUrl}
              />
              {form.officialStampUrl && (
                <div className="
                  mt-2 flex items-center gap-3 rounded-lg border
                  border-slate-200 bg-slate-50 p-2
                "
                >
                  <div className="
                    flex size-12 items-center justify-center overflow-hidden
                    rounded-sm border border-slate-200 bg-white
                  "
                  >
                    {/* eslint-disable-next-line next/no-img-element */}
                    <img
                      src={form.officialStampUrl}
                      alt={t('stampAlt')}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <p className="font-bold text-[#16212B]">{t('stampPreview')}</p>
                    <p className="text-[10px]">{t('stampPreviewHint')}</p>
                  </div>
                </div>
              )}
            </Field>

            <Field
              label={t('signatureUrl')}
              hint={t('signatureUrlHint')}
              error={fieldErrors.directorSignatureUrl}
            >
              <Input
                value={form.directorSignatureUrl}
                onChange={field('directorSignatureUrl')}
                placeholder={t('signaturePlaceholder')}
                error={!!fieldErrors.directorSignatureUrl}
              />
              {form.directorSignatureUrl && (
                <div className="
                  mt-2 flex items-center gap-3 rounded-lg border
                  border-slate-200 bg-slate-50 p-2
                "
                >
                  <div className="
                    flex size-12 items-center justify-center overflow-hidden
                    rounded-sm border border-slate-200 bg-white
                  "
                  >
                    {/* eslint-disable-next-line next/no-img-element */}
                    <img
                      src={form.directorSignatureUrl}
                      alt={t('signatureAlt')}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <p className="font-bold text-[#16212B]">{t('signaturePreview')}</p>
                    <p className="text-[10px]">{t('signaturePreviewHint')}</p>
                  </div>
                </div>
              )}
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 4: Contacts Institutionnels ── */}
      <SectionCard icon={User} title={t('sectionContacts')}>
        <div className="flex flex-col gap-6">
          {INSTITUTIONAL_CONTACT_ROLES.map(role => (
            <div key={role.key}>
              <div className="mb-3 flex items-center gap-2">
                <span className="
                  inline-flex items-center rounded-full bg-[#F0F4FF] px-2 py-0.5
                  text-xs font-medium text-[#4B6BFB]
                "
                >
                  {t(`contacts.${role.key}.badge`)}
                </span>
                <span className="text-sm font-medium text-[#374151]">{t(`contacts.${role.key}.label`)}</span>
              </div>
              <div className="
                grid grid-cols-1 gap-3
                sm:grid-cols-3
              "
              >
                <Field label={t('contactName')} error={fieldErrors[role.nameField]}>
                  <Input
                    value={form[role.nameField] as string}
                    onChange={field(role.nameField)}
                    placeholder={t('contactNamePlaceholder')}
                    error={!!fieldErrors[role.nameField]}
                  />
                </Field>
                <Field label={t('email')} error={fieldErrors[role.emailField]}>
                  <Input
                    value={form[role.emailField] as string}
                    onChange={field(role.emailField)}
                    type="email"
                    placeholder="email@..."
                    error={!!fieldErrors[role.emailField]}
                  />
                </Field>
                <Field label={t('phone')} error={fieldErrors[role.phoneField]}>
                  <Input
                    value={form[role.phoneField] as string}
                    onChange={field(role.phoneField)}
                    type="tel"
                    placeholder="+212..."
                    error={!!fieldErrors[role.phoneField]}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 5: Langues & Localisation ── */}
      <SectionCard icon={Languages} title={t('sectionLanguages')}>
        <div className="
          grid grid-cols-1 gap-6
          sm:grid-cols-2
        "
        >
          <div>
            <p className="mb-3 text-xs font-medium text-[#374151]">{t('interfaceLanguages')}</p>
            <div className="flex flex-col gap-2">
              {Object.entries(form.languages).map(([key, enabled]) => (
                <label
                  key={key}
                  className="
                    flex cursor-pointer items-center justify-between rounded-lg
                    px-3 py-2
                    hover:bg-[#F9FAFB]
                  "
                >
                  <span className="text-sm text-[#374151] capitalize">{toggleLabel('languages', key)}</span>
                  <Toggle checked={enabled} onChange={_v => toggleJsonb('languages', key)} label={toggleLabel('languages', key)} />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Field label={t('timezone')}>
              <select
                value={form.localeTimezone}
                onChange={e => setForm(prev => ({ ...prev, localeTimezone: e.target.value }))}
                className="
                  w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2
                  text-sm text-[#111827]
                  focus:border-[#4B6BFB] focus:ring-2 focus:ring-[#4B6BFB]/20
                  focus:outline-none
                "
              >
                <option value="Africa/Casablanca">Africa/Casablanca (GMT+1)</option>
                <option value="Europe/Paris">Europe/Paris (GMT+2)</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
            <Field label={t('dateFormat')}>
              <select
                value={form.dateFormat}
                onChange={e => setForm(prev => ({ ...prev, dateFormat: e.target.value }))}
                className="
                  w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2
                  text-sm text-[#111827]
                  focus:border-[#4B6BFB] focus:ring-2 focus:ring-[#4B6BFB]/20
                  focus:outline-none
                "
              >
                <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                <option value="mm/dd/yyyy">mm/dd/yyyy</option>
                <option value="yyyy-mm-dd">yyyy-mm-dd</option>
              </select>
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 6: Style de Documents ── */}
      <SectionCard icon={Palette} title={t('sectionDocStyle')}>
        <div className="
          grid grid-cols-1 gap-3
          sm:grid-cols-3
        "
        >
          {DOC_STYLES.map(style => (
            <button
              key={style}
              type="button"
              onClick={() => setForm(prev => ({ ...prev, documentHeaderStyle: style }))}
              className={`
                rounded-xl border-2 p-4 text-left transition-all
                ${
            form.documentHeaderStyle === style
              ? 'border-[#4B6BFB] bg-[#F0F4FF]'
              : `
                border-[#E5E7EB]
                hover:border-[#C7D2FE]
              `
            }
              `}
            >
              <p className="text-sm font-semibold text-[#111827]">{t(`docStyles.${style}.label`)}</p>
              <p className="mt-1 text-xs text-[#6B7280]">{t(`docStyles.${style}.desc`)}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 7: Opérations & Présences ── */}
      <SectionCard icon={Shield} title={t('sectionOperations')}>
        <div className="
          grid grid-cols-1 gap-6
          sm:grid-cols-2
        "
        >
          <div>
            <div className="
              flex items-center justify-between rounded-xl bg-[#F9FAFB] px-4
              py-3
            "
            >
              <div>
                <p className="text-sm font-medium text-[#111827]">{t('operationsActive')}</p>
                <p className="mt-0.5 text-xs text-[#6B7280]">{t('operationsActiveHint')}</p>
              </div>
              <Toggle
                checked={form.allowOperations}
                onChange={v => setForm(prev => ({ ...prev, allowOperations: v }))}
                label={t('operationsActive')}
              />
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-medium text-[#374151]">{t('presenceModesTitle')}</p>
            <div className="flex flex-col gap-2">
              {Object.entries(form.presenceModes).map(([key, enabled]) => (
                <label
                  key={key}
                  className="
                    flex cursor-pointer items-center justify-between rounded-lg
                    px-3 py-2
                    hover:bg-[#F9FAFB]
                  "
                >
                  <span className="text-sm text-[#374151]">{toggleLabel('presenceModes', key)}</span>
                  <Toggle checked={enabled} onChange={_v => toggleJsonb('presenceModes', key)} label={toggleLabel('presenceModes', key)} />
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Footer shortcut ── */}
      <div className="
        flex items-center justify-between rounded-xl border border-[#E5E7EB]
        bg-[#F9FAFB] px-4 py-3
      "
      >
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <GraduationCap className="size-4" />
          {t('academicStructure')}
        </div>
        <Link
          href={`/${locale}/dashboard/academics/classes`}
          className="
            flex items-center gap-1 text-sm font-medium text-[#4B6BFB]
            transition-colors
            hover:text-[#3B5BDB]
          "
        >
          {t('goToClasses')}
          <ChevronRight className="size-4" />
        </Link>
      </div>

    </div>
  );
}
