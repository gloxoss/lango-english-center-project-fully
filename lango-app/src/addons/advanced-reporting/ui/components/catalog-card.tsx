'use client';

import Link from 'next/link';
import type { ReportCatalogItem } from '../../types/reporting-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  CalendarCheck,
  Receipt,
  Landmark,
  Award,
  Users,
  Package,
  ArrowRight,
  Lock,
  FileSpreadsheet,
  Star,
} from 'lucide-react';

const DOMAIN_ICONS: Record<string, any> = {
  Student: GraduationCap,
  Attendance: CalendarCheck,
  Fees: Receipt,
  Financial: Landmark,
  Examination: Award,
  HR: Users,
  Inventory: Package,
};

const DOMAIN_LABELS: Record<string, string> = {
  Student: 'Élèves',
  Attendance: 'Présences',
  Fees: 'Frais & Scolarité',
  Financial: 'Comptabilité',
  Examination: 'Examens',
  HR: 'Ressources Humaines',
  Inventory: 'Stocks & Inventaire',
};

const DOMAIN_COLORS: Record<string, string> = {
  Student: 'bg-blue-50 text-[#2487B8] border-blue-200',
  Attendance: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Fees: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  Financial: 'bg-purple-50 text-purple-600 border-purple-200',
  Examination: 'bg-amber-50 text-amber-600 border-amber-200',
  HR: 'bg-teal-50 text-teal-600 border-teal-200',
  Inventory: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function CatalogCard({
  report,
  isFavorite,
  onToggleFavorite,
}: {
  report: ReportCatalogItem;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const isReady = report.readiness.isReady;
  const DomainIcon = DOMAIN_ICONS[report.domain] || FileSpreadsheet;
  const colorClass = DOMAIN_COLORS[report.domain] || 'bg-slate-100 text-slate-700 border-slate-200';
  const domainLabel = DOMAIN_LABELS[report.domain] || report.domain;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-md hover:border-[#2487B8]/50 transition-all duration-200 group">
      {/* Top Stack: Domain Icon + Favorite Star + Status Badge (Row 1) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${colorClass} shadow-2xs`}>
              <DomainIcon className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {domainLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={onToggleFavorite}
                className="p-1 text-slate-300 hover:text-amber-400 transition-colors"
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Star className={`h-4 w-4 ${isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
              </button>
            )}

            {isReady ? (
              <Badge variant="success" className="gap-1 font-bold text-[11px] px-2.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2487B8]" />
                Prêt
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1 font-bold text-[11px] px-2.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Non activé
              </Badge>
            )}
          </div>
        </div>

        {/* Title Block (Row 2 - Full Width, No Truncation) */}
        <div>
          <h3 className="text-base font-extrabold text-[#16212B] tracking-tight leading-snug group-hover:text-[#2487B8] transition-colors">
            {report.title}
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 min-h-[36px]">
            {report.description}
          </p>
        </div>
      </div>

      {/* Bottom Stack: Supported Formats & Action Button (Row 3) */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {report.supportedFormats.map((fmt) => (
            <span
              key={fmt}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-200/60"
            >
              {fmt}
            </span>
          ))}
        </div>

        {isReady ? (
          <Button asChild size="sm" variant="default" className="rounded-xl shadow-2xs font-bold gap-1.5 px-4 h-9">
            <Link href={`/dashboard/reports/${report.key}`}>
              <span>Ouvrir</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled className="gap-1.5 text-slate-400 font-medium h-9 rounded-xl">
            <Lock className="h-3.5 w-3.5" />
            <span>Indisponible</span>
          </Button>
        )}
      </div>
    </div>
  );
}
