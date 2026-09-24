// settings-hub-client.tsx
// CLIENT ISLAND — owns settings search filter, category tabs, module cards grid, and audit feed.
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cndpStatusOf } from '@/features/settings/cndp-status';
import {
  Building2, Users, ShieldCheck, Globe, FileText, Languages, Clock, ArrowRightLeft,
  Sliders, Layers, MapPin, Shield, FileCheck2, Hash, Tags, CalendarClock, Search, ArrowRight, CheckCircle2, History,
  Sparkles, ExternalLink, Activity, Server, ChevronRight, LogIn
} from 'lucide-react';
import {
  SETTINGS_MODULES, HUB_CATEGORIES
} from '@/features/settings/data/settings-hub-config';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Users, ShieldCheck, Globe, FileText, Languages, Clock, ArrowRightLeft,
  Sliders, Layers, MapPin, Shield, FileCheck2, Hash, Tags, CalendarClock, LogIn
};

export type AuditItem = {
  id: string;
  userName: string;
  userInitials: string;
  action: string;
  timestamp: string;
};

type Props = {
  initialAudits: AuditItem[];
  initialTenant: { name: string; city: string; ice: string };
  initialModulesStatus: Record<string, boolean>;
  configuredCount: number;
  totalModules: number;
  conformityPercent: number;
  conformityCode?: string;
  conformityLabel?: string;
  lastModification: AuditItem | null;
  locale?: string;
};

export function SettingsHubClient({
  initialAudits,
  initialTenant,
  initialModulesStatus,
  configuredCount,
  totalModules,
  conformityPercent,
  conformityCode,
  conformityLabel,
  lastModification,
  locale = 'fr',
}: Props) {
  const t = useTranslations('Settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const safeT = (key: string, fallback: string) => {
    try {
      const res = t(key as any);
      return res || fallback;
    } catch {
      return fallback;
    }
  };

  // Unknown conformity must not read as conforming. The old default here was
  // "PCG 2026 & CNDP conformes", so a missing label claimed compliance the
  // tenant may not have.
  const resolvedConformity = conformityCode
    ? safeT(`compliance_${conformityCode}`, conformityLabel || '')
    : (conformityLabel || cndpStatusOf(null, true).label);

  const filteredModules = SETTINGS_MODULES.filter(m => {
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    const key = `mod_${m.id.replace(/-/g, '_')}`;
    const mTitle = safeT(`${key}_title`, m.title);
    const mDesc = safeT(`${key}_desc`, m.desc);

    const matchesSearch = searchQuery === '' ||
      mTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── Top Header & Global Search ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">{t('hubPageTitle')}</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {t('hubPageSubtitle')}
          </p>
        </div>

        {/* Global Module Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('hubSearchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111827] outline-none focus:border-[#4B6BFB] transition-colors"
          />
        </div>
      </div>

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('configModules')}</p>
            <p className="text-2xl font-bold text-[#111827]">{configuredCount} / {totalModules}</p>
            <p className="text-[11px] font-semibold text-emerald-600">
              {configuredCount === totalModules
                ? t('allConfigured')
                : t('modulesToConfigure', { count: totalModules - configuredCount })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('complianceStatus')}</p>
            <p className="text-2xl font-bold text-[#111827]">{conformityPercent}%</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">{resolvedConformity}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('lastModification')}</p>
            <p className="text-2xl font-bold text-[#111827]">{lastModification?.timestamp ?? '—'}</p>
            <p className="text-[11px] font-semibold text-[#6B7280]">
              {lastModification ? t('byUser', { name: lastModification.userName }) : t('noModifications')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('activeSchool')}</p>
            <p className="text-base font-bold text-[#111827] truncate max-w-[180px]">
              {initialTenant.name || t('notConfigured')}
            </p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">
              {[initialTenant.city, initialTenant.ice ? `ICE ${initialTenant.ice}` : ''].filter(Boolean).join(' · ')
                || t('infoIncomplete')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Category Filter Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {HUB_CATEGORIES.map(cat => {
          const catLabel = safeT(`cat_${cat.id}`, cat.label);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#4B6BFB] text-white shadow-xs'
                  : 'bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
              }`}
            >
              {catLabel}
            </button>
          );
        })}
      </div>

      {/* ── 17 Bento Settings Module Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModules.map(mod => {
          const IconComp = ICON_MAP[mod.iconName] || Building2;
          const isConfigured = Boolean(initialModulesStatus[mod.id]);
          const key = `mod_${mod.id.replace(/-/g, '_')}`;
          const modTitle = safeT(`${key}_title`, mod.title);
          const modDesc = safeT(`${key}_desc`, mod.desc);
          const targetHref = mod.href.startsWith(`/${locale}`) ? mod.href : `/${locale}${mod.href}`;

          return (
            <Link
              key={mod.id}
              href={targetHref}
              className="group bg-white p-6 rounded-2xl border border-[#E5E7EB] hover:border-[#4B6BFB]/50
                shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] group-hover:bg-[#4B6BFB] group-hover:text-white transition-colors flex items-center justify-center">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {isConfigured ? t('configuredBadge') : t('toConfigureBadge')}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#111827] group-hover:text-[#4B6BFB] transition-colors flex items-center gap-1.5">
                    <span>{modTitle}</span>
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">
                    {modDesc}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex items-center justify-between text-xs font-semibold text-[#4B6BFB]">
                <span>{t('accessModule')}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform rtl:group-hover:-translate-x-1 rtl:rotate-180" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Recent Operational Audit Feed ── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs mt-2">
        <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#4B6BFB]" />
            <h3 className="text-sm font-semibold text-[#111827]">{t('recentModifications')}</h3>
          </div>
          <Link href={`/${locale}/dashboard/settings/jobs`} className="text-xs font-semibold text-[#4B6BFB] hover:underline flex items-center gap-1">
            <span>{t('viewFullLog')}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
        </div>

        <div className="space-y-3">
          {initialAudits.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-[#E5E7EB] rounded-xl">
              <p className="text-xs font-semibold text-[#6B7280]">{t('noRecentModifications')}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                {t('auditFeedSubtitle')}
              </p>
            </div>
          ) : (
            initialAudits.map(aud => (
              <div key={aud.id} className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#4B6BFB] text-white flex items-center justify-center font-bold text-xs">
                    {aud.userInitials}
                  </div>
                  <div>
                    <p className="font-bold text-[#111827]">
                      {aud.userName} <span className="font-normal text-[#374151]">{t.has(`auditActions.${aud.action}`) ? t(`auditActions.${aud.action}`) : aud.action}</span>
                    </p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{aud.timestamp}</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0F4FF] text-[#4B6BFB]">
                  {t('auditedBadge')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
