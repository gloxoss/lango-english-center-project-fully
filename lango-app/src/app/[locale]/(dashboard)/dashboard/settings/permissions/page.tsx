'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, ShieldCheck, ShieldX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// These match DEFAULT_ROLE_PERMISSIONS keys (excluding super_admin)
const ROLES = [
  { id: 'school_admin', label: 'Administrateur' },
  { id: 'teacher', label: 'Enseignant' },
  { id: 'accountant', label: 'Comptable' },
  { id: 'receptionist', label: 'Réceptionniste' },
  { id: 'guard', label: 'Gardien' },
  { id: 'student', label: 'Élève' },
  { id: 'parent', label: 'Parent' },
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
    if (!groups[ns]) groups[ns] = [];
    groups[ns].push(key);
  }
  return groups;
}

const MODULE_LABELS: Record<string, string> = {
  settings: 'Paramètres',
  students: 'Élèves',
  teachers: 'Enseignants',
  academics: 'Académique',
  attendance: 'Présence',
  finance: 'Finance',
  users: 'Utilisateurs',
  audit: 'Audit',
  guardians: 'Parents/Tuteurs',
  communication: 'Communication',
  grading: 'Notes',
  reports: 'Rapports',
  hr: 'RH & Paie',
};

export default function PermissionsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [matrix, setMatrix] = useState<Matrix>({} as Matrix);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // 'roleId.permKey'
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/permissions');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setMatrix(json.data.matrix);
      }
    } catch {
      showToast('err', 'Erreur chargement des permissions.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (roleId: RoleId, permKey: string) => {
    const current = matrix[roleId]?.[permKey] ?? false;
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
        showToast('err', json.error?.message ?? 'Erreur mise à jour permission.');
      } else {
        showToast('ok', json.message ?? 'Permission mise à jour.');
      }
    } catch {
      setMatrix(m => ({
        ...m,
        [roleId]: { ...(m[roleId] ?? {}), [permKey]: current },
      }));
      showToast('err', 'Erreur réseau.');
    } finally {
      setSaving(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const groups = groupPermissions(data.permissions);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Matrice des permissions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configurez les capacités de chaque rôle.
            {data.overrideCount > 0 && (
              <span className="ml-2 text-blue-600 font-semibold">{data.overrideCount} dérogation(s) active(s)</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="gap-2 text-xs rounded-full"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
          toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Matrix Table */}
      <Card className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-bold text-slate-700 min-w-[220px]">Permission</th>
              {ROLES.map(role => (
                <th key={role.id} className="px-3 py-3 font-bold text-slate-700 min-w-[100px] text-center">
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([module, keys]) => (
              <>
                {/* Module separator row */}
                <tr key={`${module}-header`} className="bg-slate-50/70">
                  <td
                    colSpan={ROLES.length + 1}
                    className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-t border-slate-100"
                  >
                    {MODULE_LABELS[module] ?? module}
                  </td>
                </tr>

                {keys.map(permKey => (
                  <tr key={permKey} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{data.permissions[permKey]}</div>
                      <div className="font-mono text-[10px] text-slate-400">{permKey}</div>
                    </td>
                    {ROLES.map(role => {
                      const granted = matrix[role.id]?.[permKey] ?? false;
                      const isSaving = saving === `${role.id}.${permKey}`;

                      return (
                        <td key={role.id} className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(role.id, permKey)}
                            disabled={isSaving}
                            title={granted ? 'Cliquer pour révoquer' : 'Cliquer pour accorder'}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                              isSaving
                                ? 'opacity-50 cursor-wait'
                                : granted
                                  ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-300 hover:bg-red-50 hover:text-red-400'
                            }`}
                          >
                            {granted
                              ? <ShieldCheck className="w-4 h-4" />
                              : <ShieldX className="w-4 h-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-5 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Accordée
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldX className="w-3.5 h-3.5 text-slate-300" /> Refusée
        </span>
        <Badge variant="neutral" className="text-[10px]">
          Les modifications sont appliquées immédiatement et auditées.
        </Badge>
      </div>
    </div>
  );
}
