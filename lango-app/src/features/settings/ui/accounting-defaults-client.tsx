// accounting-defaults-client.tsx
// CLIENT ISLAND — owns accounting settings form state, PCG mappings table, live trial balance preview, and save handler.
'use client';

import {
  BookOpen,
  CheckCircle2,
  DollarSign,
  FileText,
  History,
  Layers,
  RefreshCw,
  Save,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  DEFAULT_ACCOUNTING_SETTINGS,
  DEFAULT_JOURNALS,
  PCG_MAPPINGS,
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
  const t = useTranslations('AccountingSettings');
  const tCommon = useTranslations('Common');
  // Mapping and journal labels follow the UI language; the official PCG account
  // names (pcgLabel) stay in French, their legal wording.
  const mappingText = (id: string, field: 'label' | 'description', fallback: string) => (t.has(`mappings.${id}.${field}`) ? t(`mappings.${id}.${field}` as 'mappings.banque.label') : fallback);
  const categoryText = (category: string) => (t.has(`categories.${category}`) ? t(`categories.${category}` as 'categories.Tiers') : category);
  const journalText = (code: string, fallback: string) => (t.has(`journals.${code}`) ? t(`journals.${code}` as 'journals.VE') : fallback);
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
        // The response used to be ignored, so a rejected value still showed "saved".
        const res = await fetch('/api/settings/values/accounting.defaults', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: settings }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.success === false) {
          toast.error(json?.error?.message || json?.message || tCommon('error'));
          return;
        }
        setSavedSuccess(true);
        setTimeout(setSavedSuccess, 3000, false);
      } catch (err) {
        console.error('Failed to save accounting settings:', err);
        toast.error(tCommon('networkError'));
      }
    });
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
            onClick={handleReset}
            disabled={isPending}
            className="
              flex items-center gap-2 rounded-xl border border-[#E5E7EB]
              bg-white px-3.5 py-2 text-xs font-semibold text-[#374151]
              transition-colors
              hover:bg-[#F9FAFB]
              disabled:opacity-60
            "
          >
            <RefreshCw className="size-4" />
            {t('reset')}
          </button>
          <button
            onClick={handleSave}
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
            {isPending ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="
          flex items-center gap-2 rounded-xl border border-emerald-200
          bg-emerald-50 p-4 text-xs font-semibold text-emerald-900
        "
        >
          <CheckCircle2 className="size-4 text-emerald-600" />
          {t('saved')}
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
            <p className="text-xs font-medium text-[#6B7280]">{t('statMapped')}</p>
            <p className="text-2xl font-bold text-[#111827]">
              {mappedCount}
              {' '}
              /
              {' '}
              {totalCount}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600">
              {mappedCount > 0
                ? t('pcgCompliant', { percent: Math.round((mappedCount / totalCount) * 100) })
                : t('noneMapped')}
            </p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-emerald-50
            text-emerald-600
          "
          >
            <ShieldCheck className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statJournals')}</p>
            <p className="text-2xl font-bold text-[#111827]">{DEFAULT_JOURNALS.length}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">{t('statJournalsHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#F0F4FF]
            text-[#4B6BFB]
          "
          >
            <BookOpen className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statVat')}</p>
            <p className="text-2xl font-bold text-[#111827]">
              {settings.tauxTva}
              %
            </p>
            <p className="text-[11px] font-semibold text-[#6B7280]">{t('roundedTo', { amount: settings.arrondi })}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-purple-50
            text-purple-600
          "
          >
            <DollarSign className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statOpenPeriod')}</p>
            <p className="text-sm font-bold text-[#111827]">{settings.periodeOuverte}</p>
            <p className="text-[11px] font-semibold text-emerald-600">{t('statOpenPeriodHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-emerald-50
            text-emerald-600
          "
          >
            <Scale className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Validation Banner ── */}
      <div className="
        flex items-center justify-between rounded-2xl border border-[#C7D2FE]
        bg-[#F0F4FF] p-4
      "
      >
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-[#4B6BFB]" />
          <div>
            <p className="text-xs font-bold text-[#1E3A8A]">{t('validationTitle')}</p>
            <p className="mt-0.5 text-xs text-[#3B82F6]">
              {t('validationBody')}
            </p>
          </div>
        </div>
        <span className="
          shrink-0 rounded-lg border border-[#C7D2FE] bg-white px-3 py-1 text-xs
          font-bold text-[#4B6BFB]
        "
        >
          {mappedCount}
          {' '}
          /
          {totalCount}
          {' '}
          {totalCount > 0 && mappedCount === totalCount ? t('valid') : t('toComplete')}
        </span>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="
        grid grid-cols-1 gap-6
        lg:grid-cols-3
      "
      >

        {/* ── Left Area (2 Cols): Mapping Table & Journal Configuration ── */}
        <div className="
          flex flex-col gap-6
          lg:col-span-2
        "
        >

          {/* Mapping des Objets Financiers Table */}
          <div className="
            overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white
            shadow-2xs
          "
          >
            <div className="
              flex items-center justify-between border-b border-[#F3F4F6] px-6
              py-4
            "
            >
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-[#4B6BFB]" />
                <h2 className="text-sm font-semibold text-[#111827]">{t('mappingTitle')}</h2>
              </div>
              <span className="text-xs text-[#6B7280]">{t('mappingHint')}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="
                  border-b border-[#E5E7EB] bg-[#F9FAFB] font-semibold
                  text-[#6B7280]
                "
                >
                  <tr>
                    <th className="px-4 py-3">{t('colOperation')}</th>
                    <th className="px-4 py-3">{t('colCategory')}</th>
                    <th className="px-4 py-3">{t('colPcgCode')}</th>
                    <th className="px-4 py-3">{t('colPcgLabel')}</th>
                    <th className="px-4 py-3 text-center">{t('colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="
                  divide-y divide-[#F3F4F6] font-medium text-[#374151]
                "
                >
                  {mappings.map(m => (
                    <tr key={m.id} className="hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-[#111827]">{mappingText(m.id, 'label', m.label)}</p>
                        <p className="text-[11px] text-[#6B7280]">{mappingText(m.id, 'description', m.description)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="
                          rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px]
                          font-semibold text-[#374151]
                        "
                        >
                          {categoryText(m.category)}
                        </span>
                      </td>
                      <td className="
                        px-4 py-3.5 font-mono font-bold text-[#4B6BFB]
                      "
                      >
                        {m.pcgCode}
                      </td>
                      <td className="px-4 py-3.5 text-[#374151]">{m.pcgLabel}</td>
                      <td className="px-4 py-3.5 text-center">
                        {m.status === 'mapped'
                          ? (
                              <span className="
                                inline-flex items-center gap-1 rounded-full
                                bg-emerald-50 px-2.5 py-0.5 text-[10px]
                                font-bold text-emerald-700
                              "
                              >
                                <span className="
                                  size-1.5 rounded-full bg-emerald-500
                                "
                                />
                                {t('mapped')}
                              </span>
                            )
                          : (
                              <span className="
                                inline-flex items-center gap-1 rounded-full
                                bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold
                                text-amber-700
                              "
                              >
                                <span className="
                                  size-1.5 rounded-full bg-amber-500
                                "
                                />
                                {t('toMap')}
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
          <div className="
            space-y-5 rounded-2xl border border-[#E5E7EB] bg-white p-6
            shadow-2xs
          "
          >
            <div className="
              flex items-center gap-2 border-b border-[#F3F4F6] pb-3
            "
            >
              <BookOpen className="size-4 text-[#4B6BFB]" />
              <h3 className="text-sm font-semibold text-[#111827]">{t('journalsTitle')}</h3>
            </div>

            <div className="
              grid grid-cols-1 gap-4
              sm:grid-cols-2
            "
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">{t('salesJournal')}</label>
                <select
                  value={settings.journalVentes}
                  onChange={e => setSettings(s => ({ ...s, journalVentes: e.target.value }))}
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    text-xs text-[#111827] outline-none
                  "
                >
                  {DEFAULT_JOURNALS.map(j => (
                    <option key={j.code} value={j.code}>{journalText(j.code, j.name)}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">{t('cashJournal')}</label>
                <select
                  value={settings.journalCaisse}
                  onChange={e => setSettings(s => ({ ...s, journalCaisse: e.target.value }))}
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    text-xs text-[#111827] outline-none
                  "
                >
                  {DEFAULT_JOURNALS.map(j => (
                    <option key={j.code} value={j.code}>{journalText(j.code, j.name)}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">{t('costCentre')}</label>
                <input
                  type="text"
                  value={settings.centreCout}
                  onChange={e => setSettings(s => ({ ...s, centreCout: e.target.value }))}
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    text-xs font-medium text-[#111827] outline-none
                  "
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">{t('invoicePrefix')}</label>
                <input
                  type="text"
                  value={settings.prefixFacture}
                  onChange={e => setSettings(s => ({ ...s, prefixFacture: e.target.value }))}
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    font-mono text-xs font-bold text-[#111827] outline-none
                  "
                />
              </div>
            </div>

            {/* TVA & Rounding Grid */}
            <div className="
              grid grid-cols-1 gap-4 border-t border-[#F3F4F6] pt-3
              sm:grid-cols-3
            "
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">{t('vatRate')}</label>
                <input
                  type="number"
                  value={settings.tauxTva}
                  onChange={e => setSettings(s => ({ ...s, tauxTva: Number(e.target.value) }))}
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    font-mono text-xs font-bold text-[#111827] outline-none
                  "
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">{t('rounding')}</label>
                <select
                  value={settings.arrondi}
                  onChange={e => setSettings(s => ({ ...s, arrondi: e.target.value }))}
                  className="
                    rounded-xl border border-[#E5E7EB] bg-white px-3 py-2
                    text-xs text-[#111827] outline-none
                  "
                >
                  <option value="0.01">{t('round001')}</option>
                  <option value="0.10">{t('round010')}</option>
                  <option value="1.00">{t('round100')}</option>
                </select>
              </div>

              <div className="flex flex-col justify-center gap-1.5 pt-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.exonerationInscription}
                    onChange={e => setSettings(s => ({ ...s, exonerationInscription: e.target.checked }))}
                    className="
                      size-4 rounded-sm border-[#E5E7EB] text-[#4B6BFB]
                    "
                  />
                  <span className="text-xs font-medium text-[#374151]">{t('vatExemptEnrolment')}</span>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right Area (1 Col): Live Balanced Trial Balance & Audit History ── */}
        <div className="flex flex-col gap-6">

          {/* Live Balanced Trial Balance Preview */}
          <div className="
            space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6
            shadow-2xs
          "
          >
            <div className="
              flex items-center justify-between border-b border-[#F3F4F6] pb-3
            "
            >
              <div className="flex items-center gap-2">
                <Scale className="size-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">{t('previewTitle')}</h3>
              </div>
              <span className="
                rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold
                text-emerald-700
              "
              >
                {t('balanced')}
              </span>
            </div>

            <p className="text-xs text-[#6B7280]">
              {t('previewHint')}
            </p>

            {/* Sample Amount Input */}
            <div className="
              flex items-center justify-between rounded-xl border
              border-[#E5E7EB] bg-[#F9FAFB] p-3
            "
            >
              <span className="text-xs font-semibold text-[#374151]">{t('paymentAmount')}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={sampleAmount}
                  onChange={e => setSampleAmount(Number(e.target.value) || 0)}
                  className="
                    w-24 rounded-lg border border-[#E5E7EB] bg-white px-2 py-1
                    text-right font-mono text-xs font-bold
                  "
                />
                <span className="text-xs font-bold text-[#111827]">MAD</span>
              </div>
            </div>

            {/* Trial Balance Table */}
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-left font-mono text-xs">
                <thead className="
                  border-b border-[#E5E7EB] bg-[#F9FAFB] font-sans font-semibold
                  text-[#6B7280]
                "
                >
                  <tr>
                    <th className="px-3 py-2.5">{t('colAccount')}</th>
                    <th className="px-3 py-2.5 text-right">{t('colDebit')}</th>
                    <th className="px-3 py-2.5 text-right">{t('colCredit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-[#374151]">
                  <tr>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-[#111827]">514100</p>
                      <p className="font-sans text-[10px] text-[#6B7280]">{t('sampleBank')}</p>
                    </td>
                    <td className="
                      px-3 py-2.5 text-right font-bold text-emerald-600
                    "
                    >
                      {sampleAmount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#9CA3AF]">0.00</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-[#111827]">342100</p>
                      <p className="font-sans text-[10px] text-[#6B7280]">{t('sampleClients')}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#9CA3AF]">0.00</td>
                    <td className="
                      px-3 py-2.5 text-right font-bold text-[#111827]
                    "
                    >
                      {sampleHt.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-[#111827]">445500</p>
                      <p className="font-sans text-[10px] text-[#6B7280]">{t('sampleVat', { rate: sampleTvaRate })}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#9CA3AF]">0.00</td>
                    <td className="
                      px-3 py-2.5 text-right font-bold text-[#111827]
                    "
                    >
                      {sampleTva.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="
                  border-t border-[#E5E7EB] bg-[#F9FAFB] font-bold
                "
                >
                  <tr>
                    <td className="px-3 py-2.5 font-sans text-[#111827]">{t('entryTotal')}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{sampleAmount.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-[#111827]">{(sampleHt + sampleTva).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Audit History Stream */}
          <div className="
            space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5
            shadow-2xs
          "
          >
            <div className="
              flex items-center gap-2 border-b border-[#F3F4F6] pb-3
            "
            >
              <History className="size-4 text-[#4B6BFB]" />
              <h3 className="text-sm font-semibold text-[#111827]">{t('historyTitle')}</h3>
            </div>

            <div className="space-y-3">
              {initialAuditFeed.length === 0
                ? (
                    <div className="p-4 text-center">
                      <p className="text-xs font-semibold text-[#111827]">{t('historyEmpty')}</p>
                      <p className="mt-1 text-[11px] text-[#6B7280]">{t('historyEmptyHint')}</p>
                    </div>
                  )
                : (
                    initialAuditFeed.map(aud => (
                      <div
                        key={aud.id}
                        className="
                          space-y-1 rounded-xl border border-[#E5E7EB]
                          bg-[#F9FAFB] p-3
                        "
                      >
                        <p className="text-xs font-semibold text-[#111827]">{aud.action}</p>
                        <div className="
                          flex items-center justify-between text-[11px]
                          text-[#6B7280]
                        "
                        >
                          <span>{t('by', { user: aud.user })}</span>
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
      <div className="
        overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs
      "
      >
        <div className="
          flex items-center justify-between border-b border-[#F3F4F6] px-6 py-4
        "
        >
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#4B6BFB]" />
            <h2 className="text-sm font-semibold text-[#111827]">{t('trialTitle')}</h2>
          </div>
          <span className="text-xs text-[#6B7280]">
            {initialTrialBalance.length > 0 ? t('accountsMoved', { count: initialTrialBalance.length }) : t('noEntries')}
          </span>
        </div>

        {initialTrialBalance.length === 0
          ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-[#111827]">{t('trialEmpty')}</p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {t('trialEmptyHint')}
                </p>
              </div>
            )
          : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="
                    border-b border-[#E5E7EB] bg-[#F9FAFB] font-semibold
                    text-[#6B7280]
                  "
                  >
                    <tr>
                      <th className="px-4 py-3">{t('colAccount')}</th>
                      <th className="px-4 py-3">{t('colLabel')}</th>
                      <th className="px-4 py-3 text-right">{t('colDebit')}</th>
                      <th className="px-4 py-3 text-right">{t('colCredit')}</th>
                    </tr>
                  </thead>
                  <tbody className="
                    divide-y divide-[#F3F4F6] font-medium text-[#374151]
                  "
                  >
                    {initialTrialBalance.map(row => (
                      <tr key={row.code} className="hover:bg-[#F9FAFB]">
                        <td className="
                          px-4 py-3 font-mono font-bold text-[#4B6BFB]
                        "
                        >
                          {row.code}
                        </td>
                        <td className="px-4 py-3">{row.label}</td>
                        <td className="
                          px-4 py-3 text-right font-mono font-bold
                          text-emerald-600
                        "
                        >
                          {row.debit.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{row.credit.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="
                    border-t border-[#E5E7EB] bg-[#F9FAFB] font-bold
                  "
                  >
                    <tr>
                      <td className="px-4 py-3 text-[#111827]" colSpan={2}>{t('total')}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {initialTrialBalance.reduce((sum, r) => sum + r.debit, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
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
