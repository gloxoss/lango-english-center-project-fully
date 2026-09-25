'use client';

import { Archive, Lock, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type AttachmentType = {
  id: string;
  name: string;
  code: string;
  allowedMimeFamilies: string[];
  maxSizeBytes: number;
  studentVisible: boolean;
  downloadable: boolean;
  isSystem: boolean;
  isActive: boolean;
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AttachmentTypesPage() {
  const t = useTranslations('AttachmentTypes');
  const [types, setTypes] = useState<AttachmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [mimeFamilies, setMimeFamilies] = useState('image,pdf,document');
  const [maxSizeMb, setMaxSizeMb] = useState('25');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/content/attachment-types?includeArchived=true');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error('Failed to load attachment types');
      }
      setTypes(result.data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleTypes = types.filter(t => (archivedOnly ? !t.isActive : t.isActive));

  const handleRestore = async (id: string) => {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(`/api/content/attachment-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error('Failed to restore attachment type');
      }
      setNotice(t('restored'));
      await load();
    } catch {
      setNotice(t('restoreError'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) {
      setError(t('required'));
      return;
    }
    const size = Number(maxSizeMb);
    if (!Number.isFinite(size) || size <= 0 || !Number.isSafeInteger(Math.round(size * 1024 * 1024))) {
      setError(t('invalidSize'));
      return;
    }
    const families = mimeFamilies.split(',').map(s => s.trim()).filter(Boolean);
    if (families.length === 0) {
      setError(t('requiredMime'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/content/attachment-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          allowedMimeFamilies: families,
          maxSizeBytes: Math.round(size * 1024 * 1024),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(t('createError'));
        return;
      }
      setName('');
      setCode('');
      setCodeTouched(false);
      setMimeFamilies('image,pdf,document');
      setMaxSizeMb('25');
      setCreateOpen(false);
      setNotice(t('created'));
      await load();
    } catch {
      setError(t('createError'));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (id: string) => {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(`/api/content/attachment-types/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error('Failed to archive attachment type');
      }
      setNotice(t('archived'));
      await load();
    } catch {
      setNotice(t('archiveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
      <div className="
        flex flex-col justify-between gap-4 rounded-2xl border
        border-slate-200/80 bg-white p-6 shadow-2xs
        lg:flex-row lg:items-center
      "
      >
        <div className="flex items-center gap-4">
          <div className="
            flex size-12 shrink-0 items-center justify-center rounded-2xl
            bg-linear-to-br from-[#0066FF] to-[#1B6C93] text-white shadow-2xs
          "
          >
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h1 className="
              text-2xl font-extrabold tracking-tight text-[#16212B]
            "
            >
              {t('title')}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{t('subtitle')}</p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="
            cursor-pointer gap-1.5 rounded-xl bg-[#0066FF] px-4 text-xs
            font-bold text-white
            hover:bg-[#0052CC]
          "
        >
          <Plus className="size-4" />
          {' '}
          {t('newType')}
        </Button>
      </div>

      {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
      {loadError && (
        <div
          role="alert"
          className="flex items-center gap-3 text-sm text-red-700"
        >
          <span>{t('loadError')}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>{t('retry')}</Button>
        </div>
      )}

      <Card className="
        space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs
      "
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          {([
            { value: false, label: t('activeTypes') },
            { value: true, label: t('archivedTypes') },
          ] as const).map(tab => (
            <button
              key={String(tab.value)}
              onClick={() => setArchivedOnly(tab.value)}
              className={`
                rounded-xl px-4 py-2 text-xs font-bold transition-colors
                ${archivedOnly === tab.value
              ? `bg-[#0066FF] text-white`
              : `
                bg-slate-100 text-slate-600
                hover:bg-slate-200/70
              `}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading
          ? (
              <p className="py-8 text-center text-xs text-slate-400">{t('loading')}</p>
            )
          : loadError && types.length === 0
            ? (
                <p className="py-8 text-center text-xs text-red-600">{t('loadError')}</p>
              )
            : visibleTypes.length === 0
              ? (
                  <p className="py-8 text-center text-xs text-slate-400">{t(archivedOnly ? 'noArchivedTypes' : 'noActiveTypes')}</p>
                )
              : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="
                        border-b border-slate-100 text-left text-[11px]
                        font-bold tracking-wider text-slate-400 uppercase
                      "
                      >
                        <th className="py-2 pr-4">{t('name')}</th>
                        <th className="py-2 pr-4">{t('code')}</th>
                        <th className="py-2 pr-4">{t('formats')}</th>
                        <th className="py-2 pr-4">{t('maxSize')}</th>
                        <th className="py-2 pr-4">{t('studentVisible')}</th>
                        <th className="py-2 pr-4">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTypes.map(item => (
                        <tr key={item.id} className="border-b border-slate-50">
                          <td className="
                            flex items-center gap-1.5 py-3 pr-4 font-semibold
                            text-[#16212B]
                          "
                          >
                            {item.name}
                            {item.isSystem && (
                              <span title={t('systemLocked')}>
                                <Lock className="size-3 text-slate-400" />
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-slate-500">{item.code}</td>
                          <td className="py-3 pr-4 text-slate-500">{item.allowedMimeFamilies.join(', ')}</td>
                          <td className="py-3 pr-4 text-slate-500">
                            {Math.round(item.maxSizeBytes / (1024 * 1024))}
                            {' '}
                            {t('mb')}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={item.studentVisible ? 'success' : 'neutral'}
                              className="text-[10px]"
                            >
                              {t(item.studentVisible ? 'yes' : 'no')}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            {!item.isActive
                              ? (
                                  <button
                                    onClick={() => void handleRestore(item.id)}
                                    disabled={busy || item.isSystem}
                                    title={t('restore')}
                                    aria-label={t('restoreLabel', { name: item.name })}
                                    className="
                                      cursor-pointer text-slate-500
                                      hover:text-emerald-600
                                    "
                                  >
                                    <RotateCcw className="size-4" />
                                  </button>
                                )
                              : (
                                  <button
                                    onClick={() => void handleArchive(item.id)}
                                    disabled={busy || item.isSystem}
                                    title={item.isSystem ? t('systemLocked') : t('archive')}
                                    aria-label={t('archiveLabel', { name: item.name })}
                                    className={`
                                      cursor-pointer
                                      ${item.isSystem
                                    ? 'cursor-not-allowed text-slate-300'
                                    : `
                                      text-slate-500
                                      hover:text-red-600
                                    `}
                                    `}
                                  >
                                    <Archive className="size-4" />
                                  </button>
                                )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('newTypeTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="attachment-type-name"
                className="text-xs font-bold text-slate-700"
              >
                {t('name')}
              </label>
              <Input
                id="attachment-type-name"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (!codeTouched) {
                    setCode(slugify(v));
                  }
                }}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="attachment-type-code"
                className="text-xs font-bold text-slate-700"
              >
                {t('code')}
              </label>
              <Input
                id="attachment-type-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeTouched(true);
                }}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="attachment-type-mime"
                className="text-xs font-bold text-slate-700"
              >
                {t('mimeFamilies')}
              </label>
              <Input
                id="attachment-type-mime"
                value={mimeFamilies}
                onChange={e => setMimeFamilies(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="attachment-type-size"
                className="text-xs font-bold text-slate-700"
              >
                {t('maxSizeMb')}
              </label>
              <Input
                id="attachment-type-size"
                type="number"
                min="0.01"
                step="0.01"
                value={maxSizeMb}
                onChange={e => setMaxSizeMb(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              onClick={() => void handleCreate()}
              disabled={busy}
              className="
                cursor-pointer rounded-xl bg-[#0066FF] text-xs font-bold
                text-white
                hover:bg-[#0052CC]
              "
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
