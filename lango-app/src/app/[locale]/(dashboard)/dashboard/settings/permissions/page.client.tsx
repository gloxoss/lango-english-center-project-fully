'use client';

import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// These match DEFAULT_ROLE_PERMISSIONS keys (excluding super_admin)
const ROLES = [
  { id: 'school_admin' },
  { id: 'teacher' },
  { id: 'accountant' },
  { id: 'receptionist' },
  { id: 'guard' },
  { id: 'librarian' },
  { id: 'student' },
  { id: 'parent' },
  { id: 'alumni' },
] as const;

type RoleId = typeof ROLES[number]['id'];

type Matrix = Record<RoleId, Record<string, boolean>>;
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
  const locale = useLocale();
  const t = useTranslations('SettingsPermissions');
  const tRoles = useTranslations('Roles');
  const [data, setData] = useState<ApiData | null>(null);
  const [matrix, setMatrix] = useState<Matrix>({} as Matrix);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // 'roleId.permKey'
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

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/settings/permissions');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error('Failed to load permissions');
      }
      setData(json.data);
      setMatrix(json.data.matrix);
      setLoadError(false);
    } catch {
      setLoadError(true);
      showToast('err', t('loadError'));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (roleId: RoleId, permKey: string) => {
    const current = matrix[roleId]?.[permKey] ?? false;
    const newVal = !current;
    const cellKey = `${roleId}.${permKey}`;
    if (roleId === 'school_admin' && permKey === 'users.permissions.manage' && current) {
      // eslint-disable-next-line no-alert
      if (!window.confirm(t('confirmLockout'))) {
        return;
      }
    }

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
      if (!res.ok || !json.success) {
        setMatrix(m => ({
          ...m,
          [roleId]: { ...(m[roleId] ?? {}), [permKey]: current },
        }));
        showToast('err', t('updateError'));
      } else {
        showToast('ok', t('updated'));
        await load(false);
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

  if (!data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 py-16 text-sm text-red-700"
      >
        <p>{t('loadError')}</p>
        <Button onClick={() => void load()}>{t('retry')}</Button>
      </div>
    );
  }

  const groups = groupPermissions(data.permissions);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('subtitle')}
            {data.overrideCount > 0 && (
              <span className="ml-2 font-semibold text-blue-600">{t('overridesCount', { count: data.overrideCount })}</span>
            )}
          </p>
          {locale !== 'fr' && <p className="mt-1 text-xs text-slate-500">{t('technicalKeyNote')}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading || saving !== null}
          className="gap-2 rounded-full text-xs"
        >
          <RefreshCw className="size-3.5" />
          {t('refresh')}
        </Button>
      </div>

      {loadError && <div role="alert" className="text-sm text-red-700">{t('loadError')}</div>}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`
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
      <Card className="
        overflow-x-auto rounded-2xl border border-slate-200 shadow-xs
      "
      >
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="
                min-w-[220px] px-4 py-3 text-left font-bold text-slate-700
              "
              >
                {t('permission')}
              </th>
              {ROLES.map(role => (
                <th
                  key={role.id}
                  className="
                    min-w-[100px] p-3 text-center font-bold text-slate-700
                  "
                >
                  {tRoles(role.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([module, keys]) => (
              <Fragment key={module}>
                {/* Module separator row */}
                <tr className="bg-slate-50/70">
                  <td
                    colSpan={ROLES.length + 1}
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
                      <div className="font-medium text-slate-800">{locale === 'fr' ? data.permissions[permKey] : permKey}</div>
                      <div className="font-mono text-[10px] text-slate-400">{permKey}</div>
                    </td>
                    {ROLES.map((role) => {
                      const granted = matrix[role.id]?.[permKey] ?? false;
                      const isSaving = saving === `${role.id}.${permKey}`;

                      return (
                        <td key={role.id} className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => void toggle(role.id, permKey)}
                            disabled={saving !== null}
                            title={t(granted ? 'revoke' : 'grant')}
                            aria-label={t(granted ? 'revokeLabel' : 'grantLabel', { role: tRoles(role.id), permission: permKey })}
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
      <div className="flex items-center gap-5 text-[10px] text-slate-500">
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
          {t('auditNote')}
        </Badge>
      </div>
    </div>
  );
}
