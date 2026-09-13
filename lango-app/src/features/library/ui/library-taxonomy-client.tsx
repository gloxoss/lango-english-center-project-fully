'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderTree, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Item = { id: string; name: string; primaryRole?: string | null; city?: string | null; parentId?: string | null };

const BASE: Record<string, string> = { categories: 'categories', contributors: 'contributors', publishers: 'publishers', subjects: 'subjects' };

export function LibraryTaxonomyClient() {
  const t = useTranslations('Library');
  const [tab, setTab] = useState<string>('categories');
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tabs = [
    ['categories', t('tabCategories')],
    ['contributors', t('tabContributors')],
    ['publishers', t('tabPublishers')],
    ['subjects', t('tabSubjects')],
  ] as const;

  const load = useCallback(async () => {
    setMessage(null);
    const r = await fetch(`/api/addons/library/catalog/${BASE[tab]}`, { cache: 'no-store' });
    const j = await r.json();
    if (j.success) setItems(j.data ?? []);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, method: string, body: object, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? t('operationFailed'));
      if (j.success) {
        setName('');
        setExtra('');
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function create() {
    const base = {
      categories: { name, parentId: extra || null },
      contributors: { name, primaryRole: extra || null },
      publishers: { name, city: extra || null },
      subjects: { name },
    } as Record<string, Record<string, unknown>>;
    void post(`/api/addons/library/catalog/${BASE[tab]}`, 'POST', base[tab]!, t('itemAddedMsg'));
  }

  function remove(item: Item) {
    if (window.confirm(t('deleteItemConfirm', { name: item.name }))) {
      void post(`/api/addons/library/catalog/${BASE[tab]}/${item.id}`, 'DELETE', {}, t('itemDeletedMsg'));
    }
  }

  const typeLabel =
    tab === 'contributors'
      ? t('typeContributor')
      : tab === 'publishers'
      ? t('typePublisher')
      : tab === 'subjects'
      ? t('typeSubject')
      : t('typeCategory');

  const extraPlaceholder =
    tab === 'categories'
      ? t('parentCategoryPlaceholder')
      : tab === 'contributors'
      ? t('primaryRolePlaceholder')
      : tab === 'publishers'
      ? t('cityPlaceholder')
      : '';

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('taxonomyTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('taxonomySubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-[#2487B8] bg-blue-50 text-[#1B6C93]' : 'bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p role="status" className="text-sm">{message}</p>}

      <Card className="flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-xs font-bold text-slate-700">{t('fieldName')}</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('nameOfItemPlaceholder', { type: typeLabel })}
          />
        </div>
        {extraPlaceholder && (
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-xs font-bold text-slate-700">{t('fieldOption')}</label>
            <Input value={extra} onChange={e => setExtra(e.target.value)} placeholder={extraPlaceholder} />
          </div>
        )}
        <Button disabled={busy || !name.trim()} onClick={create}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('btnAdd')}
        </Button>
      </Card>

      <Card className="p-4">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <FolderTree className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium">{t('noItems')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-3">{t('fieldName')}</th>
                  {tab !== 'subjects' && <th className="p-3">{t('thDetail')}</th>}
                  <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3 font-semibold">{item.name}</td>
                    {tab !== 'subjects' && (
                      <td className="p-3 text-xs text-slate-500">
                        {item.primaryRole ?? item.city ?? (item.parentId ? `Parent ${item.parentId.slice(0, 8)}` : '—')}
                      </td>
                    )}
                    <td className="p-3 text-right rtl:text-left">
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(item)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
