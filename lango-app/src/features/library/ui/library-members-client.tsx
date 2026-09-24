'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { casablancaTodayIso } from '@/libs/finance/today';

type Member = { id: string; memberNumber: string; state: string; blockReason: string | null; blockUntil: string | null; name: string; email: string | null; role: string; branchId: string | null };

export function LibraryMembersClient() {
  const t = useTranslations('Library');
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const stateLabels: Record<string, { label: string; cls: string }> = {
    active: { label: t('active'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
    blocked: { label: t('stateBlocked'), cls: 'bg-rose-50 text-rose-600' },
    suspended: { label: t('stateSuspended'), cls: 'bg-amber-50 text-amber-700' },
    closed: { label: t('stateClosed'), cls: 'bg-slate-100 text-slate-500' },
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/addons/library/members?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.success) setMembers(j.data);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('membersTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('membersSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      <Card className="p-4">
        <form className="mb-4 flex gap-2" onSubmit={e => { e.preventDefault(); void load(); }}>
          <div className="relative flex-1">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="ltr:pl-9 rtl:pr-9"
              placeholder={t('searchMembersPlaceholder')}
            />
          </div>
          <Button type="submit">{t('search')}</Button>
        </form>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">{t('loading')}</div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium">{t('noMembersFound')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-3">{t('thMember')}</th>
                  <th className="p-3">{t('thNumber')}</th>
                  <th className="p-3">{t('thRole')}</th>
                  <th className="p-3">{t('status')}</th>
                  <th className="p-3">{t('thBlock')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map(member => {
                  const s = stateLabels[member.state] ?? { label: member.state, cls: 'bg-slate-100 text-slate-500' };
                  const today = casablancaTodayIso();
                  const blockedUntil = member.blockUntil && member.blockUntil >= today;
                  return (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="p-3">
                        <Link href={`/dashboard/portals/librarian/members/${member.id}`} className="font-semibold text-[#16212B] hover:text-[#2487B8]">
                          {member.name}
                        </Link>
                        {member.email && <div className="text-xs text-slate-500">{member.email}</div>}
                      </td>
                      <td className="p-3 font-mono text-xs">{member.memberNumber}</td>
                      <td className="p-3 capitalize">{member.role}</td>
                      <td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td>
                      <td className="p-3 text-xs">{blockedUntil ? t('blockedUntil', { date: member.blockUntil ?? '' }) : member.blockReason ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
