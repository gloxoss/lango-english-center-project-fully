'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ChildContextSwitcher } from '@/components/parent/ChildContextSwitcher';
import { useParentChildContext } from './use-parent-child-context';

export type ParentPageShellContext = {
  relationshipId: string | null;
  studentName: string | null;
  loading: boolean;
  error: string | null;
  reload: (child?: string) => void;
};

type ParentPageShellProps = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactElement;
};

// Page shell for child-scoped parent pages: title header + child switcher +
// refresh, plus the shared loading/error plumbing. `children` is a named child
// component (stable identity) that receives the active relationship id via
// cloneElement, so the view's own hooks live on a real child fiber and its local
// state survives shell re-renders.
export function ParentPageShell({ title, subtitle, icon, children }: ParentPageShellProps) {
  const { data, loading, error, switchTo, reload } = useParentChildContext();

  const activeId = data?.activeChild?.relationshipId ?? null;
  const studentName = data?.activeChild?.name ?? null;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0066FF]/10 border border-[#0066FF]/30 flex items-center justify-center text-[#0066FF]">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ChildContextSwitcher
            children={data?.children ?? []}
            activeRelationshipId={activeId}
            onChange={switchTo}
          />
          <button
            type="button"
            onClick={() => reload(activeId ?? undefined)}
            disabled={loading}
            aria-label="Actualiser"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && data?.children.length === 0 && (
        <div className="p-10 bg-white border border-slate-200 rounded-xl text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Aucun enfant lié</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Votre compte n'est relié à aucun enfant pour le moment. Contactez l'établissement
            pour activer le lien.
          </p>
        </div>
      )}

      {data?.children.length ? (
        React.cloneElement(children as React.ReactElement<ParentPageShellContext>, {
          relationshipId: activeId,
          studentName,
          loading,
          error,
          reload,
        })
      ) : null}
    </div>
  );
}
