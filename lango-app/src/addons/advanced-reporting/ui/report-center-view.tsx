'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { ReportCatalogItem } from '../types/reporting-types';
import { CatalogCard } from './components/catalog-card';
import { ReportingNav } from './components/reporting-nav';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/empty-state';
import { Search, Filter, Sparkles, Star } from 'lucide-react';

export function ReportCenterView({ initialCatalog }: { initialCatalog: ReportCatalogItem[] }) {
  const t = useTranslations('Reports');
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());

  const domainLabels: Record<string, string> = {
    all: t('domainAll'),
    favorites: t('domainFavorites'),
    Student: t('domainStudent'),
    Attendance: t('domainAttendance'),
    Fees: t('domainFees'),
    Financial: t('domainFinancial'),
    Examination: t('domainExamination'),
    HR: t('domainHR'),
    Inventory: t('domainInventory'),
  };

  // Fetch favorites on load
  useEffect(() => {
    fetch('/api/addons/reporting/favorites')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setFavoriteKeys(new Set(json.data.map((f: any) => f.reportKey)));
        }
      })
      .catch(console.error);
  }, []);

  const toggleFavorite = async (key: string) => {
    const isFav = favoriteKeys.has(key);
    const newFavs = new Set(favoriteKeys);
    if (isFav) {
      newFavs.delete(key);
    } else {
      newFavs.add(key);
    }
    setFavoriteKeys(newFavs);

    try {
      await fetch('/api/addons/reporting/favorites', {
        method: isFav ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportKey: key }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const domains = useMemo(() => {
    const list = Array.from(new Set(initialCatalog.map((r) => r.domain)));
    return ['all', 'favorites', ...list];
  }, [initialCatalog]);

  const filteredCatalog = useMemo(() => {
    return initialCatalog.filter((report) => {
      const repKey = `rep_${report.key.replace(/\./g, '_')}`;
      let locTitle = '';
      let locDesc = '';
      try {
        locTitle = t(`${repKey}_title` as any) || '';
        locDesc = t(`${repKey}_desc` as any) || '';
      } catch {}
      const matchesSearch =
        report.title.toLowerCase().includes(search.toLowerCase()) ||
        report.description.toLowerCase().includes(search.toLowerCase()) ||
        locTitle.toLowerCase().includes(search.toLowerCase()) ||
        locDesc.toLowerCase().includes(search.toLowerCase());

      let matchesDomain = true;
      if (selectedDomain === 'favorites') {
        matchesDomain = favoriteKeys.has(report.key);
      } else if (selectedDomain !== 'all') {
        matchesDomain = report.domain.toLowerCase() === selectedDomain.toLowerCase();
      }

      return matchesSearch && matchesDomain;
    });
  }, [initialCatalog, search, selectedDomain, favoriteKeys]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <ReportingNav />

      {/* Hero Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-[#C3DAFB] bg-[#E4EDFD]/60 p-4 text-[#16212B] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2487B8] text-white shadow-2xs shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#16212B]">
              {t('bannerTitle')}
            </h2>
            <p className="text-xs text-slate-600">
              {t('bannerDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Domain Filter Toolbar */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white h-10 font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
          {domains.map((dom) => (
            <button
              key={dom}
              onClick={() => setSelectedDomain(dom)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedDomain.toLowerCase() === dom.toLowerCase()
                  ? 'bg-[#2487B8] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {dom === 'favorites' && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
              <span>{domainLabels[dom] || dom}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredCatalog.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCatalog.map((report) => (
            <CatalogCard
              key={report.key}
              report={report}
              isFavorite={favoriteKeys.has(report.key)}
              onToggleFavorite={() => toggleFavorite(report.key)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-2xs">
          <EmptyState
            title="Aucun rapport trouvé"
            description="Aucun rapport ne correspond à vos critères de recherche ou de filtre."
          />
        </div>
      )}
    </div>
  );
}
