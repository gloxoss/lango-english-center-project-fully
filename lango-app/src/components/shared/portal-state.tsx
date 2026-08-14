'use client';

import {
  AlertTriangle,
  Loader2,
  Puzzle,
  ShieldAlert,
  WifiOff,
  Inbox,
} from 'lucide-react';

export type PortalState =
  | 'loading'
  | 'empty'
  | 'error'
  | 'offline'
  | 'forbidden'
  | 'addon-unavailable';

const STATE_CONTENT: Record<PortalState, { title: string; message: string; Icon: typeof Loader2 }> = {
  loading: {
    title: 'Chargement…',
    message: 'Veuillez patienter pendant le chargement du portail.',
    Icon: Loader2,
  },
  empty: {
    title: 'Aucune donnée',
    message: 'Il n\'y a rien à afficher pour le moment.',
    Icon: Inbox,
  },
  error: {
    title: 'Une erreur est survenue',
    message: 'Impossible de charger les données. Réessayez dans un instant.',
    Icon: AlertTriangle,
  },
  offline: {
    title: 'Connexion instable',
    message: 'La connexion réseau semble interrompue. Les données affichées peuvent être incomplètes.',
    Icon: WifiOff,
  },
  forbidden: {
    title: 'Accès refusé',
    message: 'Vous ne disposez pas des autorisations nécessaires pour cette ressource.',
    Icon: ShieldAlert,
  },
  'addon-unavailable': {
    title: 'Module non activé',
    message: 'Ce module n\'est pas activé pour votre établissement.',
    Icon: Puzzle,
  },
};

/**
 * Shared portal state view (loading / empty / error / offline / forbidden /
 * addon-unavailable) used by the portal home and downstream portal pages so
 * every portal renders the same degraded states consistently.
 */
export function PortalStateView({
  state,
  action,
}: {
  state: PortalState;
  action?: React.ReactNode;
}) {
  const { title, message, Icon } = STATE_CONTENT[state];

  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-center"
      role="status"
      aria-live="polite"
    >
      <Icon
        className={`size-8 text-slate-400 ${state === 'loading' ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{message}</p>
      </div>
      {action}
    </div>
  );
}
