'use client';

import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Matrix = Record<string, Record<string, boolean>>;
type Permissions = Record<string, string>;

type ApiData = {
  permissions: Permissions;
  matrix: Matrix;
  overrideCount: number;
};

// Group permission keys by module prefix
function groupPermissions(perms: Permissions): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const key of Object.keys(perms)) {
    const ns = key.split('.')[0] ?? 'other';
    if (!groups[ns]) {
      groups[ns] = [];
    }
    groups[ns].push(key);
  }
  return groups;
}

export default function PermissionsPage() {
  const t = useTranslations('PermissionMatrix');
  const locale = useLocale();
  const [data, setData] = useState<ApiData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [matrix, setMatrix] = useState<Matrix>({} as Matrix);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // 'roleId.permKey'
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(setToast, 3500, null);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/settings/permissions');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error('Permission matrix unavailable');
      }
      setData(json.data);
      setMatrix(json.data.matrix);
    } catch {
      setLoadError(true);
      showToast('err', t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (roleId: string, permKey: string) => {
    const current = matrix[roleId]?.[permKey] ?? false;
    // eslint-disable-next-line no-alert
    if (current && !window.confirm(t('confirmRevoke', { role: roleId, permission: permKey }))) {
      return;
    }
    const newVal = !current;
    const cellKey = `${roleId}.${permKey}`;

    // Optimistic update
    setMatrix(m => ({
      ...m,
      [roleId]: { ...(m[roleId] ?? {}), [permKey]: newVal },
    }));
    setSaving(cellKey);

    try {
      const res = await fetch('/api/settings/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, permissionId: permKey, granted: newVal }),
      });
      const json = await res.json();
      if (!json.success) {
        // Revert
        setMatrix(m => ({
          ...m,
          [roleId]: { ...(m[roleId] ?? {}), [permKey]: current },
        }));
        showToast('err', json.error?.message ?? t('updateError'));
      } else {
        showToast('ok', t('updated'));
      }
    } catch {
      setMatrix(m => ({
        ...m,
        [roleId]: { ...(m[roleId] ?? {}), [permKey]: current },
      }));
      showToast('err', t('networkError'));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="
          size-8 animate-spin rounded-full border-2 border-blue-500
          border-t-transparent
        "
        />
      </div>
    );
  }

  if (!data || loadError) {
    return (
      <div
        role="alert"
        className="
          rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800
        "
      >
        <p>{t('loadError')}</p>
        <Button type="button" variant="outline" onClick={load} className="mt-3">{t('retry')}</Button>
      </div>
    );
  }

  const allGroups = groupPermissions(data.permissions);
  const query = search.trim().toLocaleLowerCase(locale);
  const groups: Record<string, string[]> = {};
  for (const [module, keys] of Object.entries(allGroups)) {
    if (selectedModule !== 'all' && selectedModule !== module) {
      continue;
    }
    const visibleKeys = keys.filter((key) => {
      const label = locale === 'fr'
        ? (data.permissions[key] ?? key)
        : key.split('.').map(part =>
            t.has(`parts.${part}`) ? t(`parts.${part}`) : part.replaceAll('_', ' '),
          ).join(' · ');
      return !query || key.toLocaleLowerCase(locale).includes(query) || label.toLocaleLowerCase(locale).includes(query);
    });
    if (visibleKeys.length) {
      groups[module] = visibleKeys;
    }
  }
  const roleIds = Object.keys(data.matrix);
  const capabilityLabel = (key: string) => locale === 'fr'
    ? data.permissions[key]
    : key.split('.').map(part => t.has(`parts.${part}`) ? t(`parts.${part}`) : part.replaceAll('_', ' ')).join(' · ');

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('subtitle')}
            {data.overrideCount > 0 && (
              <span className="ms-2 font-semibold text-blue-600">{t('overrideCount', { count: data.overrideCount })}</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="gap-2 rounded-full text-xs"
        >
          <RefreshCw className="size-3.5" />
          {t('refresh')}
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`
          flex items-center gap-2 rounded-xl p-3 text-xs font-semibold
          ${
        toast.type === 'ok'
          ? `border border-emerald-200 bg-emerald-50 text-emerald-700`
          : `border border-red-200 bg-red-50 text-red-700`
        }
        `}
        >
          {toast.type === 'ok'
            ? <CheckCircle2 className="size-4 shrink-0" />
            : (
                <AlertCircle className="size-4 shrink-0" />
              )}
          {toast.msg}
        </div>
      )}

      {/* Matrix Table */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="
            min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2
            text-sm
            sm:min-w-64
          "
        />
        <select
          value={selectedModule}
          onChange={event => setSelectedModule(event.target.value)}
          aria-label={t('moduleFilter')}
          className="
            rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
          "
        >
          <option value="all">{t('allModules')}</option>
          {Object.keys(allGroups).map(module => (
            <option value={module} key={module}>{t.has(`modules.${module}`) ? t(`modules.${module}`) : module}</option>
          ))}
        </select>
      </div>
      {Object.keys(groups).length === 0 && <p className="text-sm text-slate-600">{t('noResults')}</p>}
      <Card className="
        overflow-x-auto rounded-2xl border border-slate-200 shadow-xs
      "
      >
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="
                min-w-[220px] px-4 py-3 text-start font-bold text-slate-700
              "
              >
                {t('permission')}
              </th>
              {roleIds.map(roleId => (
                <th
                  key={roleId}
                  className="
                    min-w-[100px] p-3 text-center font-bold text-slate-700
                  "
                >
                  {t.has(`roles.${roleId}`) ? t(`roles.${roleId}`) : roleId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([module, keys]) => (
              <Fragment key={module}>
                {/* Module separator row */}
                <tr key={`${module}-header`} className="bg-slate-50/70">
                  <td
                    colSpan={roleIds.length + 1}
                    className="
                      border-t border-slate-100 px-4 py-1.5 text-[10px]
                      font-bold tracking-widest text-slate-500 uppercase
                    "
                  >
                    {t.has(`modules.${module}`) ? t(`modules.${module}`) : module}
                  </td>
                </tr>

                {keys.map(permKey => (
                  <tr
                    key={permKey}
                    className="
                      border-t border-slate-100 transition-colors
                      hover:bg-slate-50/50
                    "
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{capabilityLabel(permKey)}</div>
                      <div className="font-mono text-[10px] text-slate-400">{permKey}</div>
                    </td>
                    {roleIds.map((roleId) => {
                      const granted = matrix[roleId]?.[permKey] ?? false;
                      const isSaving = saving === `${roleId}.${permKey}`;

                      return (
                        <td key={roleId} className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(roleId, permKey)}
                            disabled={isSaving}
                            title={granted ? t('revoke') : t('grant')}
                            aria-label={`${granted ? t('revoke') : t('grant')}: ${permKey}, ${t.has(`roles.${roleId}`) ? t(`roles.${roleId}`) : roleId}`}
                            className={`
                              inline-flex size-7 items-center justify-center
                              rounded-lg transition-all
                              ${
                        isSaving
                          ? 'cursor-wait opacity-50'
                          : granted
                            ? `
                              bg-emerald-100 text-emerald-600
                              hover:bg-emerald-200
                            `
                            : `
                              bg-slate-100 text-slate-300
                              hover:bg-red-50 hover:text-red-400
                            `
                        }
                            `}
                          >
                            {granted
                              ? <ShieldCheck className="size-4" />
                              : <ShieldX className="size-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Legend */}
      <div className="
        flex flex-wrap items-center gap-5 text-[10px] text-slate-500
      "
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          {' '}
          {t('granted')}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldX className="size-3.5 text-slate-300" />
          {' '}
          {t('denied')}
        </span>
        <Badge variant="neutral" className="text-[10px]">
          {t('auditHint')}
        </Badge>
      </div>
    </div>
  );
}
