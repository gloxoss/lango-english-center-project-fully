// organization-form-client.tsx
// CLIENT ISLAND — owns all form state, save mutation, logo/favicon upload
// Server Component (organization-page.tsx) fetches initial data and passes it as props.
'use client';

import React, { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Building2, Globe, Phone, Mail, MapPin, FileText, Shield, Upload,
  Save, CheckCircle, AlertCircle, Languages, Palette, Image as ImageIcon,
  User, Briefcase, GraduationCap, ChevronRight,
} from 'lucide-react';
import { INSTITUTIONAL_CONTACT_ROLES } from '@/features/settings/data/institutional-contacts-config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrganisationFormData = {
  establishmentName: string;
  shortName: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  country: string;
  rc: string;
  ice: string;
  taxId: string;
  legalStatus: string;
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
    <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#F3F4F6]">
        <div className="w-8 h-8 rounded-lg bg-[#F0F4FF] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#4B6BFB]" />
        </div>
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, children, hint }: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#374151]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#9CA3AF]">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#111827]
        placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#4B6BFB]/20
        focus:border-[#4B6BFB] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] transition-all"
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
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent
        transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4B6BFB]/30
        ${checked ? 'bg-[#4B6BFB]' : 'bg-[#D1D5DB]'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
          transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('PNG ou JPG uniquement');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Max 2 Mo');
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
      if (!res.ok) throw new Error('Upload failed');
      onUploaded();
    } catch {
      setError('Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E5E7EB] bg-[#F9FAFB]
          flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#4B6BFB]/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {src ? (
          <Image src={src} alt={label} width={80} height={80} className="object-cover w-full h-full" unoptimized />
        ) : (
          <ImageIcon className="w-6 h-6 text-[#D1D5DB]" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#4B6BFB]
            bg-[#F0F4FF] rounded-lg hover:bg-[#E0E8FF] disabled:opacity-50 transition-colors"
        >
          <Upload className="w-3 h-3" />
          {uploading ? 'Envoi...' : `Changer ${label}`}
        </button>
        <span className="text-xs text-[#9CA3AF]">PNG / JPG · 2 Mo max</span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── DOCUMENT STYLE PICKER ────────────────────────────────────────────────────

const DOC_STYLES: Array<{ key: 'classique' | 'minimal' | 'moderne'; label: string; desc: string }> = [
  { key: 'classique', label: 'Classique', desc: 'En-tête complet avec logo et coordonnées' },
  { key: 'minimal', label: 'Minimal', desc: 'En-tête épuré, nom de l\'établissement uniquement' },
  { key: 'moderne', label: 'Moderne', desc: 'Bandeau coloré avec logo en relief' },
];

// ─── MAIN CLIENT FORM ─────────────────────────────────────────────────────────

export function OrganisationFormClient({ initialData, hasLogo, hasFavicon }: Props) {
  const [form, setForm] = useState<OrganisationFormData>(initialData);
  const [logoTs, setLogoTs] = useState(Date.now());
  const [faviconTs, setFaviconTs] = useState(Date.now());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function field<K extends keyof OrganisationFormData>(key: K) {
    return (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleJsonb(section: 'presenceModes' | 'languages' | 'security', key: string) {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: !prev[section][key] },
    }));
  }

  async function handleSave() {
    startTransition(async () => {
      setSaveStatus('idle');
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message ?? 'Erreur inconnue');
        }
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        setSaveStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    });
  }

  const logoSrc = hasLogo ? `/api/settings/logo?t=${logoTs}` : null;
  const faviconSrc = hasFavicon ? `/api/settings/logo?type=favicon&t=${faviconTs}` : null;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-20">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Organisation &amp; Identité</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Paramètres de l'établissement, contacts institutionnels et préférences de localisation.
          </p>
        </div>
        <button
          id="save-settings-btn"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
            bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] disabled:opacity-60
            transition-all shadow-sm shadow-[#4B6BFB]/20"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* ── Save feedback ── */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Paramètres enregistrés avec succès.
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* ── Section 1: Identité Visuelle ── */}
      <SectionCard icon={ImageIcon} title="Identité Visuelle">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-medium text-[#374151] mb-3">Logo de l'établissement</p>
            <LogoUploadZone
              src={logoSrc}
              label="le logo"
              uploadKey="logo"
              onUploaded={() => setLogoTs(Date.now())}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[#374151] mb-3">Favicon</p>
            <LogoUploadZone
              src={faviconSrc}
              label="le favicon"
              uploadKey="favicon"
              onUploaded={() => setFaviconTs(Date.now())}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Informations Générales ── */}
      <SectionCard icon={Building2} title="Informations Générales">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nom complet de l'établissement *">
            <Input value={form.establishmentName} onChange={field('establishmentName')} placeholder="ex: Lango English Center" />
          </Field>
          <Field label="Nom abrégé" hint="Utilisé dans les documents compacts">
            <Input value={form.shortName} onChange={field('shortName')} placeholder="ex: LEC" />
          </Field>
          <Field label="Ville">
            <Input value={form.city} onChange={field('city')} placeholder="ex: Casablanca" />
          </Field>
          <Field label="Pays">
            <Input value={form.country} onChange={field('country')} placeholder="ex: Maroc" />
          </Field>
          <Field label="Adresse complète">
            <Input value={form.address} onChange={field('address')} placeholder="ex: 12, rue Allal Ben Abdellah" />
          </Field>
          <Field label="Site web">
            <Input value={form.website} onChange={field('website')} type="url" placeholder="https://" />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={field('phone')} type="tel" placeholder="+212 5 22 00 00 00" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={field('email')} type="email" placeholder="contact@lango.ma" />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 3: Informations Légales ── */}
      <SectionCard icon={FileText} title="Informations Légales">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Forme juridique">
            <Input value={form.legalStatus} onChange={field('legalStatus')} placeholder="ex: SARL, SA, Association" />
          </Field>
          <Field label="Registre de Commerce (RC)">
            <Input value={form.rc} onChange={field('rc')} placeholder="ex: RC 123456" />
          </Field>
          <Field label="ICE" hint="Identifiant Commun de l'Entreprise">
            <Input value={form.ice} onChange={field('ice')} placeholder="ex: 001234567000012" />
          </Field>
          <Field label="Identifiant Fiscal (IF)">
            <Input value={form.taxId} onChange={field('taxId')} placeholder="ex: 12345678" />
          </Field>
        </div>
      </SectionCard>

      {/* ── Section 4: Contacts Institutionnels ── */}
      <SectionCard icon={User} title="Contacts Institutionnels">
        <div className="flex flex-col gap-6">
          {INSTITUTIONAL_CONTACT_ROLES.map(role => (
            <div key={role.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  bg-[#F0F4FF] text-[#4B6BFB]">
                  {role.badge}
                </span>
                <span className="text-sm font-medium text-[#374151]">{role.label}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Nom complet">
                  <Input value={form[role.nameField] as string} onChange={v => setForm(prev => ({ ...prev, [role.nameField]: v }))} placeholder="Nom Prénom" />
                </Field>
                <Field label="Email">
                  <Input value={form[role.emailField] as string} onChange={v => setForm(prev => ({ ...prev, [role.emailField]: v }))} type="email" placeholder="email@..." />
                </Field>
                <Field label="Téléphone">
                  <Input value={form[role.phoneField] as string} onChange={v => setForm(prev => ({ ...prev, [role.phoneField]: v }))} type="tel" placeholder="+212..." />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 5: Langues & Localisation ── */}
      <SectionCard icon={Languages} title="Langues &amp; Localisation">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-[#374151] mb-3">Langues de l'interface</p>
            <div className="flex flex-col gap-2">
              {Object.entries(form.languages).map(([key, enabled]) => (
                <label key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
                  <span className="text-sm text-[#374151] capitalize">{key}</span>
                  <Toggle checked={enabled} onChange={v => toggleJsonb('languages', key)} label={key} />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Fuseau horaire">
              <select
                value={form.localeTimezone}
                onChange={e => setForm(prev => ({ ...prev, localeTimezone: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg
                  text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4B6BFB]/20 focus:border-[#4B6BFB]"
              >
                <option value="Africa/Casablanca">Africa/Casablanca (GMT+1)</option>
                <option value="Europe/Paris">Europe/Paris (GMT+2)</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
            <Field label="Format de date">
              <select
                value={form.dateFormat}
                onChange={e => setForm(prev => ({ ...prev, dateFormat: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg
                  text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4B6BFB]/20 focus:border-[#4B6BFB]"
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
      <SectionCard icon={Palette} title="Style de Documents">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DOC_STYLES.map(style => (
            <button
              key={style.key}
              type="button"
              onClick={() => setForm(prev => ({ ...prev, documentHeaderStyle: style.key }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.documentHeaderStyle === style.key
                  ? 'border-[#4B6BFB] bg-[#F0F4FF]'
                  : 'border-[#E5E7EB] hover:border-[#C7D2FE]'
              }`}
            >
              <p className="text-sm font-semibold text-[#111827]">{style.label}</p>
              <p className="text-xs text-[#6B7280] mt-1">{style.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 7: Opérations & Présences ── */}
      <SectionCard icon={Shield} title="Opérations &amp; Modes de Présence">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between py-3 px-4 bg-[#F9FAFB] rounded-xl">
              <div>
                <p className="text-sm font-medium text-[#111827]">Opérations actives</p>
                <p className="text-xs text-[#6B7280] mt-0.5">Autorise les opérations académiques et financières</p>
              </div>
              <Toggle
                checked={form.allowOperations}
                onChange={v => setForm(prev => ({ ...prev, allowOperations: v }))}
                label="Opérations actives"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[#374151] mb-3">Modes de présence</p>
            <div className="flex flex-col gap-2">
              {Object.entries(form.presenceModes).map(([key, enabled]) => (
                <label key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
                  <span className="text-sm text-[#374151]">{key}</span>
                  <Toggle checked={enabled} onChange={v => toggleJsonb('presenceModes', key)} label={key} />
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Footer shortcut ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <GraduationCap className="w-4 h-4" />
          Structure académique (cycles, classes)
        </div>
        <Link
          href="/fr/dashboard/academics/classes"
          className="flex items-center gap-1 text-sm font-medium text-[#4B6BFB] hover:text-[#3B5BDB] transition-colors"
        >
          Aller à la gestion des classes
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
