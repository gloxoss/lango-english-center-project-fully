'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Plug, RefreshCw, Plus, Trash2, Play, CircleCheck, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getProviderProfiles, createProviderProfile, updateProviderProfile, deleteProviderProfile,
  testProviderProfile, errorMessage,
} from '../data/api';

const PROVIDER_KEY_MAP: Record<string, string> = {
  dev: 'providerDev',
  bigbluebutton: 'providerBBB',
  external_link: 'providerExternal',
};

const FIELD = 'w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20 text-start';
const LABEL = 'text-[10px] font-bold text-slate-500 block mb-1 text-start';

type Profile = Awaited<ReturnType<typeof getProviderProfiles>>[number];
type TestResult = Awaited<ReturnType<typeof testProviderProfile>>;

const emptyForm = { name: '', providerType: 'dev' as string, baseUrl: '', accountId: '', enabled: true };

export function ProvidersSettingsClient() {
  const t = useTranslations('LiveClassrooms');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await getProviderProfiles());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        providerType: form.providerType,
        baseUrl: form.baseUrl.trim() || null,
        accountId: form.accountId.trim() || null,
        enabled: form.enabled,
      };
      if (editingId) {
        await updateProviderProfile(editingId, body);
        setNotice(t('profileUpdatedNotice'));
      } else {
        await createProviderProfile(body);
        setNotice(t('profileCreatedNotice'));
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleTest = async (id: string) => {
    setBusy(`test-${id}`);
    setError(null);
    try {
      const result = await testProviderProfile(id);
      setTests(prev => ({ ...prev, [id]: result }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setForm({ name: p.name, providerType: p.providerType, baseUrl: p.baseUrl ?? '', accountId: p.accountId ?? '', enabled: p.enabled });
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2">
          <Plug className="w-6 h-6 text-[#2487B8]" /> {t('providersTitle')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {t('providersSubtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {t('providersNotice')}
        </span>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 flex items-center gap-2">
          <CircleCheck className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-4 space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">{editingId ? t('editProfileHeading') : t('newProfileHeading')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={LABEL}>{t('nameLabel')}</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required maxLength={120} placeholder={t('namePlaceholder')} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{t('typeLabel')}</label>
            <select value={form.providerType} onChange={e => setForm({ ...form, providerType: e.target.value })} className={FIELD}>
              {Object.entries(PROVIDER_KEY_MAP).map(([v, k]) => <option key={v} value={v}>{(t as any)(k)}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>{t('baseUrlLabel')}</label>
            <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} maxLength={500} placeholder="https://bbb.exemple.ma" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{t('accountIdLabel')}</label>
            <input value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} maxLength={120} className={FIELD} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="accent-[#2487B8] w-4 h-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2" />
            <span className="text-[11px] font-bold text-slate-600">{t('activeProfileLabel')}</span>
          </label>
          <div className="flex items-center gap-2">
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                {t('actionCancel')}
              </button>
            )}
            <button type="submit" disabled={busy !== null}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-4 text-xs font-bold text-white hover:bg-[#1B6C93] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
              <Plus className="h-3.5 w-3.5" /> {editingId ? t('saveProfileBtn') : t('addProfileBtn')}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">{t('configuredProfilesHeading', { count: profiles.length })}</h2>
          <button onClick={() => run('refresh', load, t('listRefreshedNotice'))} disabled={busy !== null}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
            <RefreshCw className={`h-3 w-3 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> {t('refreshBtn')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                <th className="py-2.5 px-4 text-start">{t('colProfile')}</th>
                <th className="py-2.5 px-3 text-start">{t('colType')}</th>
                <th className="py-2.5 px-3 text-start">{t('colUrl')}</th>
                <th className="py-2.5 px-3 text-center">{t('colActive')}</th>
                <th className="py-2.5 px-3 text-start">{t('colTest')}</th>
                <th className="py-2.5 px-3 text-end">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-xs font-semibold text-slate-400">{t('loadingText')}</td></tr>
              ) : profiles.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-xs font-semibold text-slate-400">{t('noProfilesNotice')}</td></tr>
              ) : (
                profiles.map(p => {
                  const tResult = tests[p.id];
                  const pKey = PROVIDER_KEY_MAP[p.providerType];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-bold text-[#16212B] text-[11px] text-start">{p.name}</td>
                      <td className="py-2.5 px-3 text-start">
                        <Badge variant={p.providerType === 'dev' ? 'neutral' : 'info'}>{pKey ? (t as any)(pKey) : p.providerType}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-start">{p.baseUrl ?? '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={p.enabled ? 'success' : 'danger'}>{p.enabled ? t('yes') : t('no')}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-start">
                        {tResult ? (
                          <div className="text-[10px] font-bold">
                            <span className={tResult.ok ? 'text-emerald-700' : 'text-rose-700'}>
                              {tResult.ok ? t('testOk') : t('testFailed')}
                            </span>
                            {tResult.mode === 'deterministic' && <span className="text-slate-400"> · {t('testSimulated')}</span>}
                            {tResult.latencyMs != null && <span className="text-slate-400"> · {tResult.latencyMs} ms</span>}
                            {tResult.error && <span className="block text-rose-600 font-semibold">{tResult.error}</span>}
                          </div>
                        ) : (
                          <button onClick={() => handleTest(p.id)} disabled={busy !== null}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-[#16212B] hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                            {busy === `test-${p.id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} {t('testBtn')}
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => startEdit(p)}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                            {t('actionEdit')}
                          </button>
                          <button onClick={() => run(`del${p.id}`, () => deleteProviderProfile(p.id), t('profileDeletedNotice'))} disabled={busy !== null}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2">
                            <Trash2 className="w-3 h-3" /> {t('actionDelete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
