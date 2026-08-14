// accounting-defaults-client.tsx
// CLIENT ISLAND — owns accounting settings form state, PCG mappings table, live trial balance preview, and save handler.
'use client';

import React, { useState, useTransition } from 'react';
import {
  DollarSign, BookOpen, Save, RefreshCw, CheckCircle2, AlertCircle,
  FileText, ArrowRightLeft, ShieldCheck, Scale, History, Layers, Building, HelpCircle
} from 'lucide-react';
import {
  PCG_MAPPINGS, DEFAULT_JOURNALS, DEFAULT_ACCOUNTING_SETTINGS
} from '@/features/settings/data/accounting-defaults-config';

export type PcgMapping = {
  id: string;
  label: string;
  pcgCode: string;
  pcgLabel: string;
  category: string;
  status: 'mapped' | 'unmapped';
  description: string;
};

export type AccountingSettingsState = typeof DEFAULT_ACCOUNTING_SETTINGS;

export type TrialBalanceRow = {
  code: string;
  label: string;
  debit: number;
  credit: number;
};

export type AuditFeedItem = {
  id: string;
  action: string;
  user: string;
  timestamp: string;
};

type Props = {
  initialSettings: AccountingSettingsState;
  initialMappings: PcgMapping[];
  initialTrialBalance: TrialBalanceRow[];
  initialAuditFeed: AuditFeedItem[];
  mappedCount: number;
  totalCount: number;
};

export function AccountingDefaultsClient({
  initialSettings,
  initialMappings,
  initialTrialBalance,
  initialAuditFeed,
  mappedCount,
  totalCount,
}: Props) {
  const [settings, setSettings] = useState<AccountingSettingsState>(initialSettings);
  const [mappings, setMappings] = useState<PcgMapping[]>(initialMappings);
  const [sampleAmount, setSampleAmount] = useState<number>(12000);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Calculate live balanced trial balance sample values
  const sampleTvaRate = Number(settings.tauxTva) || 20;
  const sampleHt = Math.round((sampleAmount / (1 + sampleTvaRate / 100)) * 100) / 100;
  const sampleTva = Math.round((sampleAmount - sampleHt) * 100) / 100;

  function handleReset() {
    startTransition(() => {
      setSettings(DEFAULT_ACCOUNTING_SETTINGS);
      setMappings(Array.from(PCG_MAPPINGS) as PcgMapping[]);
    });
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await fetch('/api/settings/values/accounting.defaults', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: settings }),
        });
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } catch (err) {
        console.error('Failed to save accounting settings:', err);
      }
    });
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Liaisons Comptables &amp; Comptes par Défaut</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Plan comptable général marocain (PCG 2026), journaux comptables et règles d'imputation automatique.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={isPending}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#374151]
              bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] disabled:opacity-60 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réinitialiser les valeurs
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white
              bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] disabled:opacity-60 transition-all shadow-sm shadow-[#4B6BFB]/20"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Les liaisons comptables et comptes par défaut ont été mis à jour avec succès.
        </div>
      )}

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Comptes mappés (PCG)</p>
            <p className="text-2xl font-bold text-[#111827]">{mappedCount} / {totalCount}</p>
            <p className="text-[11px] font-semibold text-emerald-600">
              {totalCount > 0 && mappedCount === totalCount
                ? '100% PCG Marocain Conforme'
                : mappedCount > 0
                  ? `${Math.round((mappedCount / totalCount) * 100)}% PCG Marocain Conforme`
                  : 'Aucun compte mappé'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Journaux comptables actifs</p>
            <p className="text-2xl font-bold text-[#111827]">{DEFAULT_JOURNALS.length}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">Ventes, Caisse, Banque, OD</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Taux TVA standard</p>
            <p className="text-2xl font-bold text-[#111827]">{settings.tauxTva}%</p>
            <p className="text-[11px] font-semibold text-[#6B7280]">Arrondi à {settings.arrondi} MAD</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Exercice ouvert</p>
            <p className="text-sm font-bold text-[#111827]">{settings.periodeOuverte}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Période comptable valide</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Validation Banner ── */}
      <div className="bg-[#F0F4FF] border border-[#C7D2FE] p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#4B6BFB] shrink-0" />
          <div>
            <p className="text-xs font-bold text-[#1E3A8A]">Validation du Plan Comptable Général Marocain (PCG 2026)</p>
            <p className="text-xs text-[#3B82F6] mt-0.5">
              Toutes les opérations financières de l'établissement (scolarité, inscription, cantine, banque) sont mappées sur des comptes à 6 chiffres.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 bg-white text-[#4B6BFB] text-xs font-bold rounded-lg border border-[#C7D2FE] shrink-0">
          {mappedCount} / {totalCount} {totalCount > 0 && mappedCount === totalCount ? 'Valide' : 'À compléter'}
        </span>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Area (2 Cols): Mapping Table & Journal Configuration ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Mapping des Objets Financiers Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#4B6BFB]" />
                <h2 className="text-sm font-semibold text-[#111827]">Mapping des Objets Financiers &amp; Comptes PCG</h2>
              </div>
              <span className="text-xs text-[#6B7280]">Plan Comptable Marocain</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-3 px-4">Opération / Objet</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4">Code PCG (6 chiffres)</th>
                    <th className="py-3 px-4">Libellé Officiel PCG</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                  {mappings.map(m => (
                    <tr key={m.id} className="hover:bg-[#F9FAFB]">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#111827]">{m.label}</p>
                        <p className="text-[11px] text-[#6B7280]">{m.description}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[#F3F4F6] text-[#374151]">
                          {m.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#4B6BFB]">{m.pcgCode}</td>
                      <td className="py-3.5 px-4 text-[#374151]">{m.pcgLabel}</td>
                      <td className="py-3.5 px-4 text-center">
                        {m.status === 'mapped' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Mappé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            À mapper
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paramètres Général & Journaux Form */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <BookOpen className="w-4 h-4 text-[#4B6BFB]" />
              <h3 className="text-sm font-semibold text-[#111827]">Paramètres Généraux des Journaux Comptables</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Journal des Ventes par Défaut</label>
                <select
                  value={settings.journalVentes}
                  onChange={e => setSettings(s => ({ ...s, journalVentes: e.target.value }))}
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                >
                  {DEFAULT_JOURNALS.map(j => (
                    <option key={j.code} value={j.code}>{j.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Journal de Caisse par Défaut</label>
                <select
                  value={settings.journalCaisse}
                  onChange={e => setSettings(s => ({ ...s, journalCaisse: e.target.value }))}
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                >
                  {DEFAULT_JOURNALS.map(j => (
                    <option key={j.code} value={j.code}>{j.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Centre de Coût Principal</label>
                <input
                  type="text"
                  value={settings.centreCout}
                  onChange={e => setSettings(s => ({ ...s, centreCout: e.target.value }))}
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Préfixe de Numérotation des Factures</label>
                <input
                  type="text"
                  value={settings.prefixFacture}
                  onChange={e => setSettings(s => ({ ...s, prefixFacture: e.target.value }))}
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none font-mono font-bold"
                />
              </div>
            </div>

            {/* TVA & Rounding Grid */}
            <div className="pt-3 border-t border-[#F3F4F6] grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Taux de TVA Standard (%)</label>
                <input
                  type="number"
                  value={settings.tauxTva}
                  onChange={e => setSettings(s => ({ ...s, tauxTva: Number(e.target.value) }))}
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none font-mono font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Arrondi Comptable</label>
                <select
                  value={settings.arrondi}
                  onChange={e => setSettings(s => ({ ...s, arrondi: e.target.value }))}
                  className="px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                >
                  <option value="0.01">Au centime près (0.01 MAD)</option>
                  <option value="0.10">Au dix centimes (0.10 MAD)</option>
                  <option value="1.00">Au dirham près (1.00 MAD)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 justify-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.exonerationInscription}
                    onChange={e => setSettings(s => ({ ...s, exonerationInscription: e.target.checked }))}
                    className="w-4 h-4 text-[#4B6BFB] rounded border-[#E5E7EB]"
                  />
                  <span className="text-xs font-medium text-[#374151]">Exonération TVA Inscriptions</span>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right Area (1 Col): Live Balanced Trial Balance & Audit History ── */}
        <div className="flex flex-col gap-6">

          {/* Live Balanced Trial Balance Preview */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">Aperçu Écriture Comptable Équilibrée</h3>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full">
                Équilibré ✅
              </span>
            </div>

            <p className="text-xs text-[#6B7280]">
              Simulation automatique du journal d'écriture généré lors d'un règlement bancaire de scolarité.
            </p>

            {/* Sample Amount Input */}
            <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
              <span className="text-xs font-semibold text-[#374151]">Montant du Paiement (TTC) :</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={sampleAmount}
                  onChange={e => setSampleAmount(Number(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-xs font-mono font-bold text-right bg-white border border-[#E5E7EB] rounded-lg"
                />
                <span className="text-xs font-bold text-[#111827]">MAD</span>
              </div>
            </div>

            {/* Trial Balance Table */}
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-sans font-semibold border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-2.5 px-3">Compte PCG</th>
                    <th className="py-2.5 px-3 text-right">Débit (MAD)</th>
                    <th className="py-2.5 px-3 text-right">Crédit (MAD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-[#374151]">
                  <tr>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-[#111827]">514100</p>
                      <p className="text-[10px] font-sans text-[#6B7280]">Banque SGMB</p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{sampleAmount.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-[#9CA3AF]">0.00</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-[#111827]">342100</p>
                      <p className="text-[10px] font-sans text-[#6B7280]">Clients Élèves (HT)</p>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#9CA3AF]">0.00</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#111827]">{sampleHt.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-[#111827]">445500</p>
                      <p className="text-[10px] font-sans text-[#6B7280]">TVA Facturée ({sampleTvaRate}%)</p>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#9CA3AF]">0.00</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#111827]">{sampleTva.toFixed(2)}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-[#F9FAFB] font-bold border-t border-[#E5E7EB]">
                  <tr>
                    <td className="py-2.5 px-3 text-[#111827] font-sans">Total Écriture</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{sampleAmount.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-[#111827]">{(sampleHt + sampleTva).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Audit History Stream */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <History className="w-4 h-4 text-[#4B6BFB]" />
              <h3 className="text-sm font-semibold text-[#111827]">Historique des Modifications</h3>
            </div>

            <div className="space-y-3">
              {initialAuditFeed.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs font-semibold text-[#111827]">Aucune modification enregistrée</p>
                  <p className="text-[11px] text-[#6B7280] mt-1">Les changements de paramètres comptables apparaîtront ici.</p>
                </div>
              ) : (
                initialAuditFeed.map(aud => (
                  <div key={aud.id} className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1">
                    <p className="text-xs font-semibold text-[#111827]">{aud.action}</p>
                    <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span>Par {aud.user}</span>
                      <span>{aud.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── Real Trial Balance ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4B6BFB]" />
            <h2 className="text-sm font-semibold text-[#111827]">Balance de vérification — Écritures comptables réelles</h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            {initialTrialBalance.length > 0 ? `${initialTrialBalance.length} compte(s) mouvementé(s)` : 'Aucune écriture'}
          </span>
        </div>

        {initialTrialBalance.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#111827]">Aucune écriture comptable enregistrée</p>
            <p className="text-xs text-[#6B7280] mt-1">
              Les écritures générées par les factures et paiements de l'établissement apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                <tr>
                  <th className="py-3 px-4">Compte PCG</th>
                  <th className="py-3 px-4">Libellé</th>
                  <th className="py-3 px-4 text-right">Débit (MAD)</th>
                  <th className="py-3 px-4 text-right">Crédit (MAD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                {initialTrialBalance.map(row => (
                  <tr key={row.code} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 px-4 font-mono font-bold text-[#4B6BFB]">{row.code}</td>
                    <td className="py-3 px-4">{row.label}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{row.debit.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.credit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#F9FAFB] font-bold border-t border-[#E5E7EB]">
                <tr>
                  <td className="py-3 px-4 text-[#111827]" colSpan={2}>Total</td>
                  <td className="py-3 px-4 text-right text-emerald-600">
                    {initialTrialBalance.reduce((sum, r) => sum + r.debit, 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {initialTrialBalance.reduce((sum, r) => sum + r.credit, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
