// translations-custom-fields-client.tsx
// CLIENT ISLAND — owns i18n search/filtering, custom fields table, inline dictionary editing, and creation modal.
'use client';

import React, { useState, useTransition } from 'react';
import {
  Languages, Plus, Trash2, Edit, Save, Search, RefreshCw, CheckCircle2,
  AlertTriangle, Filter, Globe, Sliders, Layers, Eye, FileText, X, ChevronRight
} from 'lucide-react';

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
  const [keys, setKeys] = useState<I1nKeyItem[]>(initialKeys);
  const [fields, setFields] = useState<CustomFieldItem[]>(initialFields);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'fr' | 'ar' | 'en'>('all');
  const [addFieldModalOpen, setAddFieldModalOpen] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Filter i18n keys
  const filteredKeys = keys.filter(k => {
    const matchesSearch =
      k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.fr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.ar.includes(searchQuery) ||
      k.en.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  function handlePublish() {
    startTransition(async () => {
      try {
        await fetch('/api/settings/values/i18n.translations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: { keys, fields } }),
        });
        setPublishedSuccess(true);
        setTimeout(() => setPublishedSuccess(false), 3000);
      } catch (err) {
        console.error('Failed to publish translations:', err);
      }
    });
  }

  function handleKeyChange(id: string, lang: 'fr' | 'ar' | 'en', val: string) {
    setKeys(prev => prev.map(k => {
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
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Traductions &amp; Champs Personnalisés</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Localisation i18n multilingue (FR, AR, EN) et gestion des attributs dynamiques d'établissement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddFieldModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#374151]
              bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
          >
            <Plus className="w-4 h-4 text-[#4B6BFB]" />
            Ajouter un champ
          </button>
          <button
            onClick={handlePublish}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white
              bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] disabled:opacity-60 transition-all shadow-sm shadow-[#4B6BFB]/20"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Publication...' : 'Publier les changements'}
          </button>
        </div>
      </div>

      {publishedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Les surcharges de traduction et champs personnalisés ont été publiés et sont actifs dans l'application.
        </div>
      )}

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Langues activées</p>
            <p className="text-2xl font-bold text-[#111827]">{enabledLanguageCount}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">{enabledLanguageLabel || 'Aucune langue activée'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Clés traduites (i18n)</p>
            <p className="text-2xl font-bold text-[#111827]">{totalKeysCount}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Dictionnaire système à jour</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Languages className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Champs personnalisés</p>
            <p className="text-2xl font-bold text-[#111827]">{fields.length}</p>
            <p className="text-[11px] font-semibold text-purple-600">Attributs Élève/Parent/Staff</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">À revoir / À valider</p>
            <p className="text-2xl font-bold text-[#111827]">{reviewPendingCount}</p>
            <p className="text-[11px] font-semibold text-amber-600">
              {reviewPendingCount > 0 ? 'Clés en attente de relecture' : 'Toutes les clés sont à jour'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Language Coverage Progress Card ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#4B6BFB]" />
            <h3 className="text-sm font-semibold text-[#111827]">Couverture Linguistique des Libellés</h3>
          </div>
          <span className="text-xs text-[#6B7280]">Dictionnaire multilingue complet</span>
        </div>

        {initialCoverage.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-[#111827]">Aucune clé de traduction enregistrée</p>
            <p className="text-xs text-[#6B7280] mt-1">
              La couverture linguistique apparaîtra dès que le dictionnaire contient des clés.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {initialCoverage.map(lang => (
              <div key={lang.code} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-[#111827]">
                    <span className="text-base">{lang.flag}</span>
                    {lang.name}
                  </span>
                  <span className="text-[#4B6BFB]">{lang.coverage}%</span>
                </div>
                <div className="w-full bg-[#E5E7EB] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#4B6BFB] h-full rounded-full transition-all duration-500"
                    style={{ width: `${lang.coverage}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#6B7280] font-medium text-right">
                  {lang.count} / {lang.total} clés traduites
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main Two-Section Layout ── */}
      <div className="flex flex-col gap-6">

        {/* ── Section 1: i18n Key Dictionary & Inline Editor ── */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#4B6BFB]" />
              <h2 className="text-sm font-semibold text-[#111827]">Dictionnaire des Libellés Système (Surcharges i18n)</h2>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher une clé ou un libellé..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
              />
            </div>
          </div>

          {/* i18n Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                <tr>
                  <th className="py-3 px-4">Clé i18n / Module</th>
                  <th className="py-3 px-4">Français 🇫🇷</th>
                  <th className="py-3 px-4">Arabe 🇲🇦 (RTL)</th>
                  <th className="py-3 px-4">Anglais 🇬🇧</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                {filteredKeys.map(k => (
                  <tr key={k.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3.5 px-4">
                      <p className="font-mono text-[11px] font-bold text-[#4B6BFB]">{k.key}</p>
                      <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded font-semibold">
                        {k.module}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={k.fr}
                        onChange={e => handleKeyChange(k.id, 'fr', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#111827]"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        dir="rtl"
                        value={k.ar}
                        onChange={e => handleKeyChange(k.id, 'ar', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#111827] text-right font-serif"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={k.en}
                        onChange={e => handleKeyChange(k.id, 'en', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-[#E5E7EB] rounded-lg text-xs text-[#374151]"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        k.status === 'translated'
                          ? 'bg-emerald-50 text-emerald-700'
                          : k.status === 'overridden'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {k.status === 'translated' ? 'Traduit' : k.status === 'overridden' ? 'Surchargé' : 'À revoir'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 2: 8-Column Dynamic Custom Fields Table ── */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#4B6BFB]" />
              <h2 className="text-sm font-semibold text-[#111827]">Attributs &amp; Champs Personnalisés (Custom Fields)</h2>
            </div>
            <span className="text-xs text-[#6B7280]">{fields.length} champs définis</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                <tr>
                  <th className="py-3 px-4">Nom du champ</th>
                  <th className="py-3 px-4">Module / Entité</th>
                  <th className="py-3 px-4">Type de donnée</th>
                  <th className="py-3 px-4">Visibilité</th>
                  <th className="py-3 px-4 text-center">Requis</th>
                  <th className="py-3 px-4">Valeur par défaut</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                {fields.map(f => (
                  <tr key={f.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3.5 px-4 font-bold text-[#111827]">{f.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[#F3F4F6] text-[#374151]">
                        {f.module}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7280] font-mono text-[11px]">{f.type}</td>
                    <td className="py-3.5 px-4 text-[#374151]">{f.visibility}</td>
                    <td className="py-3.5 px-4 text-center">
                      {f.required ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                          Requis
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                          Optionnel
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#6B7280]">{f.defaultValue}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Actif
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteField(f.id)}
                          className="p-1 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                          title="Supprimer le champ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111827]">Créer un nouveau champ personnalisé</h3>
              <button onClick={() => setAddFieldModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const newF: CustomFieldItem = {
                  id: `cf-${Date.now()}`,
                  name: String(fd.get('name') || 'Nouveau Champ'),
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
                <label className="font-semibold text-[#374151]">Nom du champ *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="ex: Identifiant CIIE"
                  className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#374151]">Module / Entité *</label>
                  <select name="module" className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none">
                    <option value="Élève">Élève</option>
                    <option value="Parent">Parent / Responsable</option>
                    <option value="Employé">Employé / Staff</option>
                    <option value="Inscription">Inscription</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#374151]">Type de donnée *</label>
                  <select name="type" className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none">
                    <option value="Texte">Texte court</option>
                    <option value="Sélecteur">Sélecteur (Liste)</option>
                    <option value="Nombre">Nombre</option>
                    <option value="Date">Date</option>
                    <option value="Fichier">Fichier PDF / Img</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[#374151]">Visibilité *</label>
                <select name="visibility" className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none">
                  <option value="Formulaire public">Formulaire public d'inscription</option>
                  <option value="Profil médical">Profil médical (Confidentiel)</option>
                  <option value="Interne admin">Interne administration uniquement</option>
                  <option value="Dossier académique">Dossier académique</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" name="required" id="req-cb" className="w-4 h-4 text-[#4B6BFB] rounded border-[#E5E7EB]" />
                <label htmlFor="req-cb" className="font-semibold text-[#374151] cursor-pointer">Champ obligatoire</label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddFieldModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#6B7280] hover:bg-[#F9FAFB] rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl shadow-xs"
                >
                  Enregistrer le champ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
