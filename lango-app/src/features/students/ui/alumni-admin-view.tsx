'use client';

import { GraduationCap, Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type AlumniRow = { id: string; name: string; email: string | null; alumniTransitionedAt: string | null; cohortName: string | null; directoryOptIn: boolean };

// Real staff-side alumni admin overview (future-implementation/alumni-portal),
// replacing the removed fake mock-data portals/alumni page.
export function AlumniAdminView({ locale }: { locale?: string } = {}) {
  const t = useTranslations('Students');
  const tCommon = useTranslations('Common');
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/students/alumni?pageSize=100&search=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then(j => j?.success && setRows(j.data))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('alumniTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {rows.length}
            {' '}
            {t('alumniSubtitle')}
          </p>
        </div>
        <Button asChild
            size="sm"
            className="
              h-9 gap-1.5 rounded-xl bg-[#2487B8] text-xs text-white
              hover:bg-[#1B6C93]
            "
          >
          <Link href={`/${locale || 'fr'}/dashboard/students/alumni-transition`}>
            <GraduationCap className="size-3.5" />
            {t('massTransition')}
          </Link>
        </Button>
      </div>

      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs
      "
      >
        <div className="
          relative w-full
          sm:w-80
        "
        >
          <Search className="
            absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-slate-400
          "
          />
          <Input
            placeholder={t('searchAlumniPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="
              h-9 rounded-xl border-none bg-slate-50 ps-9 text-start text-xs
            "
          />
        </div>
      </Card>

      <Card className="
        overflow-hidden rounded-2xl border border-slate-200/80 bg-white
        shadow-2xs
      "
      >
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="
              border-b border-slate-200/80 bg-[#F6F9FC] font-extrabold
              text-[#16212B]
            "
            >
              <tr>
                <th className="px-4 py-3.5 text-start">{t('studentNameCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('cohortCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('transitionDateCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('directoryCol')}</th>
                <th className="px-4 py-3.5 text-end" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Users className="mx-auto mb-2 size-8 text-slate-200" />
                    <p className="text-slate-400">{t('noAlumniFound')}</p>
                  </td>
                </tr>
              )}
              {rows.map(r => (
                <tr
                  key={r.id}
                  className="
                    font-medium transition
                    hover:bg-slate-50/80
                  "
                >
                  <td className="px-4 py-3 text-start font-bold text-[#16212B]">{r.name}</td>
                  <td className="px-4 py-3 text-start text-slate-600">{r.cohortName ?? '—'}</td>
                  <td className="px-4 py-3 text-start text-slate-400">{r.alumniTransitionedAt?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 text-start">
                    <Badge className={r.directoryOptIn
                      ? `border-none bg-[#DDF5EC] text-[10px] text-[#17A673]`
                      : `border-none bg-slate-100 text-[10px] text-slate-500`}
                    >
                      {r.directoryOptIn ? t('optInBadge') : t('privateBadge')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-end whitespace-nowrap">
                    <Link
                      href={`/${locale || 'fr'}/dashboard/students/${r.id}`}
                      className="
                        font-bold text-[#2487B8]
                        hover:underline
                      "
                    >
                      {tCommon('view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
