// translations-custom-fields-client.tsx
// CLIENT ISLAND — owns i18n search/filtering, custom fields table, inline dictionary editing, and creation modal.
'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Languages,
  Plus,
  Save,
  Search,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';

export type LanguageCoverageItem = {
  code: string;
  name: string;
  flag: string;
  coverage: number;
  count: number;
  total: number;
  isRtl: boolean;
};

export type I1nKeyItem = {
  id: string;
  key: string;
  module: string;
  fr: string;
  ar: string;
  en: string;
  status: 'translated' | 'review_pending' | 'overridden';
};

export type CustomFieldItem = {
  id: string;
  name: string;
  module: string;
  type: string;
  visibility: string;
  required: boolean;
  defaultValue: string;
  status: 'active' | 'hidden';
};

// Custom-field attributes are stored as these values (kept for existing data);
// the labels come from TranslationsSettings.* so they follow the UI language.
const MODULE_KEYS: Record<string, string> = { Élève: 'student', Parent: 'parent', Employé: 'staff', Inscription: 'admission' };
const TYPE_KEYS: Record<string, string> = { Texte: 'text', Sélecteur: 'select', Nombre: 'number', Date: 'date', Fichier: 'file' };
const VISIBILITY_KEYS: Record<string, string> = { 'Formulaire public': 'publicForm', 'Profil public': 'publicForm', 'Profil médical': 'medical', 'Interne admin': 'internal', 'Dossier académique': 'academic' };

type Props = {
  initialKeys: I1nKeyItem[];
  initialFields: CustomFieldItem[];
  initialCoverage: LanguageCoverageItem[];
  totalKeysCount: number;
  reviewPendingCount: number;
  enabledLanguageCount: number;
  enabledLanguageLabel: string;
};

export function TranslationsCustomFieldsClient({
  initialKeys,
  initialFields,
  initialCoverage,
  totalKeysCount,
  reviewPendingCount,
  enabledLanguageCount,
  enabledLanguageLabel,
}: Props) {
  const t = useTranslations('TranslationsSettings');
  const tCommon = useTranslations('Common');
  const labelOf = (group: 'modules' | 'types' | 'visibility', map: Record<string, string>, value: string) => {
    const key = map[value];
    return key ? t(`${group}.${key}` as 'modules.student') : value;
  };
  const [keys, setKeys] = useState<I1nKeyItem[]>(initialKeys);
  const [fields, setFields] = useState<CustomFieldItem[]>(initialFields);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'fr' | 'ar' | 'en'>('all');
  const [addFieldModalOpen, setAddFieldModalOpen] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Filter i18n keys
  const filteredKeys = keys.filter((k) => {
    const matchesSearch
      = k.key.toLowerCase().includes(searchQuery.toLowerCase())
        || k.fr.toLowerCase().includes(searchQuery.toLowerCase())
        || k.ar.includes(searchQuery)
        || k.en.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  function handlePublish() {
    startTransition(async () => {
      try {
        // The response used to be ignored, so a rejected publish still showed success.
        const res = await fetch('/api/settings/values/i18n.translations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: { keys, fields } }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.success === false) {
          toast.error(json?.error?.message || json?.message || tCommon('error'));
          return;
        }
        setPublishedSuccess(true);
        setTimeout(setPublishedSuccess, 3000, false);
      } catch (err) {
        console.error('Failed to publish translations:', err);
        toast.error(tCommon('networkError'));
      }
    });
  }

  function handleKeyChange(id: string, lang: 'fr' | 'ar' | 'en', val: string) {
    setKeys(prev => prev.map((k) => {
      if (k.id === id) {
        return { ...k, [lang]: val, status: 'overridden' };
      }
      return k;
    }));
  }

  function handleDeleteField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-20">

      {/* ── Top Header ── */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-xl font-bold text-[#111827]">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddFieldModalOpen(true)}
            className="
              flex items-center gap-2 rounded-xl border border-[#E5E7EB]
              bg-white px-3.5 py-2 text-xs font-semibold text-[#374151]
              transition-colors
              hover:bg-[#F9FAFB]
            "
          >
            <Plus className="size-4 text-[#4B6BFB]" />
            {t('addField')}
          </button>
          <button
            onClick={handlePublish}
            disabled={isPending}
            className="
              flex items-center gap-2 rounded-xl bg-[#4B6BFB] px-4 py-2 text-xs
              font-semibold text-white shadow-sm shadow-[#4B6BFB]/20
              transition-all
              hover:bg-[#3B5BDB]
              disabled:opacity-60
            "
          >
            <Save className="size-4" />
            {isPending ? t('publishing') : t('publish')}
          </button>
        </div>
      </div>

      {publishedSuccess && (
        <div className="
          flex items-center gap-2 rounded-xl border border-emerald-200
          bg-emerald-50 p-4 text-xs font-semibold text-emerald-900
        "
        >
          <CheckCircle2 className="size-4 text-emerald-600" />
          {t('published')}
        </div>
      )}

      {/* ── 4 Stat Cards Band ── */}
      <div className="
        grid grid-cols-1 gap-4
        sm:grid-cols-2
        lg:grid-cols-4
      "
      >
        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statLanguages')}</p>
            <p className="text-2xl font-bold text-[#111827]">{enabledLanguageCount}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">{enabledLanguageLabel || t('noLanguage')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#F0F4FF]
            text-[#4B6BFB]
          "
          >
            <Globe className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statKeys')}</p>
            <p className="text-2xl font-bold text-[#111827]">{totalKeysCount}</p>
            <p className="text-[11px] font-semibold text-emerald-600">{t('statKeysHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-emerald-50
            text-emerald-600
          "
          >
            <Languages className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statFields')}</p>
            <p className="text-2xl font-bold text-[#111827]">{fields.length}</p>
            <p className="text-[11px] font-semibold text-purple-600">{t('statFieldsHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-purple-50
            text-purple-600
          "
          >
            <Sliders className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statReview')}</p>
            <p className="text-2xl font-bold text-[#111827]">{reviewPendingCount}</p>
            <p className="text-[11px] font-semibold text-amber-600">
              {reviewPendingCount > 0 ? t('reviewPending') : t('reviewNone')}
            </p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-amber-50
            text-amber-600
          "
          >
            <AlertTriangle className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Language Coverage Progress Card ── */}
      <div className="
        space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xs
      "
      >
        <div className="
          flex items-center justify-between border-b border-[#F3F4F6] pb-3
        "
        >
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[#4B6BFB]" />
            <h3 className="text-sm font-semibold text-[#111827]">{t('coverageTitle')}</h3>
          </div>
          <span className="text-xs text-[#6B7280]">{t('coverageHint')}</span>
        </div>

        {initialCoverage.length === 0
          ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-[#111827]">{t('coverageEmpty')}</p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {t('coverageEmptyHint')}
                </p>
              </div>
            )
          : (
              <div className="
                grid grid-cols-1 gap-6
                sm:grid-cols-3
              "
              >
                {initialCoverage.map(lang => (
                  <div
                    key={lang.code}
                    className="
                      space-y-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]
                      p-4
                    "
                  >
                    <div className="
                      flex items-center justify-between text-xs font-bold
                    "
                    >
                      <span className="flex items-center gap-2 text-[#111827]">
                        <span className="text-base">{lang.flag}</span>
                        {lang.name}
                      </span>
                      <span className="text-[#4B6BFB]">
                        {lang.coverage}
                        %
                      </span>
                    </div>
                    <div className="
                      h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]
                    "
                    >
                      <div
                        className="
                          h-full rounded-full bg-[#4B6BFB] transition-all
                          duration-500
                        "
                        style={{ width: `${lang.coverage}%` }}
                      />
                    </div>
                    <p className="
                      text-right text-[11px] font-medium text-[#6B7280]
                    "
                    >
                      {t('keysTranslated', { count: lang.count, total: lang.total })}
                    </p>
                  </div>
                ))}
              </div>
            )}
      </div>

      {/* ── Main Two-Section Layout ── */}
      <div className="flex flex-col gap-6">

        {/* ── Section 1: i18n Key Dictionary & Inline Editor ── */}
        <div className="
          space-y-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white
          p-6 shadow-2xs
        "
        >
          <div className="
            flex flex-col justify-between gap-4 border-b border-[#F3F4F6] pb-4
            sm:flex-row sm:items-center
          "
          >
            <div className="flex items-center gap-2">
              <Languages className="size-4 text-[#4B6BFB]" />
              <h2 className="text-sm font-semibold text-[#111827]">{t('dictionaryTitle')}</h2>
            </div>

            {/* Search Input */}
            <div className="
              relative w-full
              sm:w-72
            "
            >
              <Search className="absolute top-2.5 left-3 size-4 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchKey')}
                className="
                  w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-1.5
                  pr-3 pl-9 text-xs text-[#111827] outline-none
                "
              />
            </div>
          </div>

          {/* i18n Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="
                border-b border-[#E5E7EB] bg-[#F9FAFB] font-semibold
                text-[#6B7280]
              "
              >
                <tr>
                  <th className="px-4 py-3">{t('colKey')}</th>
                  <th className="px-4 py-3">{t('colFr')}</th>
                  <th className="px-4 py-3">{t('colAr')}</th>
                  <th className="px-4 py-3">{t('colEn')}</th>
                  <th className="px-4 py-3 text-center">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody className="
                divide-y divide-[#F3F4F6] font-medium text-[#374151]
              "
              >
                {filteredKeys.map(k => (
                  <tr key={k.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3.5">
                      <p className="
                        font-mono text-[11px] font-bold text-[#4B6BFB]
                      "
                      >
                        {k.key}
                      </p>
                      <span className="
                        rounded-sm bg-[#F3F4F6] px-1.5 py-0.5 text-[10px]
                        font-semibold text-[#6B7280]
                      "
                      >
                        {k.module}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="text"
                        value={k.fr}
                        onChange={e => handleKeyChange(k.id, 'fr', e.target.value)}
                        className="
                          w-full rounded-lg border border-[#E5E7EB] bg-white
                          px-2 py-1 text-xs font-semibold text-[#111827]
                        "
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="text"
                        dir="rtl"
                        value={k.ar}
                        onChange={e => handleKeyChange(k.id, 'ar', e.target.value)}
                        className="
                          w-full rounded-lg border border-[#E5E7EB] bg-white
                          px-2 py-1 text-right font-serif text-xs font-semibold
                          text-[#111827]
                        "
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="text"
                        value={k.en}
                        onChange={e => handleKeyChange(k.id, 'en', e.target.value)}
                        className="
                          w-full rounded-lg border border-[#E5E7EB] bg-white
                          px-2 py-1 text-xs text-[#374151]
                        "
                      />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`
                        rounded-full px-2 py-0.5 text-[10px] font-bold
                        ${
                  k.status === 'translated'
                    ? 'bg-emerald-50 text-emerald-700'
                    : k.status === 'overridden'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                  }
                      `}
                      >
                        {k.status === 'translated' ? t('statusTranslated') : k.status === 'overridden' ? t('statusOverridden') : t('statusReview')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 2: 8-Column Dynamic Custom Fields Table ── */}
        <div className="
          space-y-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white
          p-6 shadow-2xs
        "
        >
          <div className="
            flex items-center justify-between border-b border-[#F3F4F6] pb-4
          "
          >
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-[#4B6BFB]" />
              <h2 className="text-sm font-semibold text-[#111827]">{t('fieldsTitle')}</h2>
            </div>
            <span className="text-xs text-[#6B7280]">{t('fieldsCount', { count: fields.length })}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="
                border-b border-[#E5E7EB] bg-[#F9FAFB] font-semibold
                text-[#6B7280]
              "
              >
                <tr>
                  <th className="px-4 py-3">{t('colFieldName')}</th>
                  <th className="px-4 py-3">{t('colModule')}</th>
                  <th className="px-4 py-3">{t('colType')}</th>
                  <th className="px-4 py-3">{t('colVisibility')}</th>
                  <th className="px-4 py-3 text-center">{t('colRequired')}</th>
                  <th className="px-4 py-3">{t('colDefault')}</th>
                  <th className="px-4 py-3">{t('colStatus')}</th>
                  <th className="px-4 py-3 text-right">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="
                divide-y divide-[#F3F4F6] font-medium text-[#374151]
              "
              >
                {fields.map(f => (
                  <tr key={f.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3.5 font-bold text-[#111827]">{f.name}</td>
                    <td className="px-4 py-3.5">
                      <span className="
                        rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px]
                        font-semibold text-[#374151]
                      "
                      >
                        {labelOf('modules', MODULE_KEYS, f.module)}
                      </span>
                    </td>
                    <td className="
                      px-4 py-3.5 font-mono text-[11px] text-[#6B7280]
                    "
                    >
                      {labelOf('types', TYPE_KEYS, f.type)}
                    </td>
                    <td className="px-4 py-3.5 text-[#374151]">{labelOf('visibility', VISIBILITY_KEYS, f.visibility)}</td>
                    <td className="px-4 py-3.5 text-center">
                      {f.required
                        ? (
                            <span className="
                              rounded-sm bg-amber-50 px-2 py-0.5 text-[10px]
                              font-bold text-amber-700
                            "
                            >
                              {t('required')}
                            </span>
                          )
                        : (
                            <span className="
                              rounded-sm bg-slate-100 px-2 py-0.5 text-[10px]
                              font-medium text-slate-500
                            "
                            >
                              {t('optional')}
                            </span>
                          )}
                    </td>
                    <td className="
                      px-4 py-3.5 font-mono text-[11px] text-[#6B7280]
                    "
                    >
                      {f.defaultValue}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="
                        inline-flex items-center gap-1 rounded-full
                        bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold
                        text-emerald-700
                      "
                      >
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {t('active')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteField(f.id)}
                          className="
                            rounded-lg p-1 text-red-600 transition-colors
                            hover:bg-red-50
                          "
                          title={t('deleteField')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Modal: Ajouter un Champ Personnalisé ── */}
      {addFieldModalOpen && (
        <div className="
          fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4
          backdrop-blur-xs
        "
        >
          <div className="
            w-full max-w-md space-y-4 rounded-2xl border border-[#E5E7EB]
            bg-white p-6 shadow-xl
          "
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111827]">{t('createFieldTitle')}</h3>
              <button
                onClick={() => setAddFieldModalOpen(false)}
                className="
                  text-[#9CA3AF]
                  hover:text-[#111827]
                "
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const newF: CustomFieldItem = {
                  id: `cf-${Date.now()}`,
                  name: String(fd.get('name') || t('newField')),
                  module: String(fd.get('module') || 'Élève'),
                  type: String(fd.get('type') || 'Texte'),
                  visibility: String(fd.get('visibility') || 'Profil public'),
                  required: Boolean(fd.get('required')),
                  defaultValue: String(fd.get('defaultValue') || '—'),
                  status: 'active',
                };
                setFields(prev => [...prev, newF]);
                setAddFieldModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[#374151]">{t('fieldNameRequired')}</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder={t('fieldNamePlaceholder')}
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    text-[#111827] outline-none
                  "
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#374151]">{t('moduleRequired')}</label>
                  <select
                    name="module"
                    className="
                      rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                      text-[#111827] outline-none
                    "
                  >
                    {Object.entries(MODULE_KEYS).map(([value, key]) => (
                      <option key={value} value={value}>{t(`modules.${key}` as 'modules.student')}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#374151]">{t('typeRequired')}</label>
                  <select
                    name="type"
                    className="
                      rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                      text-[#111827] outline-none
                    "
                  >
                    {Object.entries(TYPE_KEYS).map(([value, key]) => (
                      <option key={value} value={value}>{t(`types.${key}` as 'types.text')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[#374151]">{t('visibilityRequired')}</label>
                <select
                  name="visibility"
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    text-[#111827] outline-none
                  "
                >
                  {(['Formulaire public', 'Profil médical', 'Interne admin', 'Dossier académique'] as const).map(value => (
                    <option key={value} value={value}>{t(`visibility.${VISIBILITY_KEYS[value]}` as 'visibility.internal')}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  name="required"
                  id="req-cb"
                  className="size-4 rounded-sm border-[#E5E7EB] text-[#4B6BFB]"
                />
                <label
                  htmlFor="req-cb"
                  className="cursor-pointer font-semibold text-[#374151]"
                >
                  {t('requiredField')}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddFieldModalOpen(false)}
                  className="
                    rounded-xl px-4 py-2 font-semibold text-[#6B7280]
                    hover:bg-[#F9FAFB]
                  "
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="
                    rounded-xl bg-[#4B6BFB] px-4 py-2 font-semibold text-white
                    shadow-xs
                    hover:bg-[#3B5BDB]
                  "
                >
                  {t('saveField')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
