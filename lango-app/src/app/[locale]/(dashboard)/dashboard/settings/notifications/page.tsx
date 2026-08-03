'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, CheckCircle2, AlertCircle, Mail, MessageSquare,
  Smartphone, RefreshCw, Eye, ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Notification = {
  id: string;
  template: string;
  channel: 'in_app' | 'email' | 'sms';
  status: 'pending' | 'sent' | 'failed';
  data: Record<string, unknown> | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  in_app: <Bell className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-App',
  email: 'Email',
  sms: 'SMS',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-600 border-amber-200',
  sent: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  sent: 'Envoyé',
  failed: 'Échec',
};

function NotificationRow({ n }: { n: Notification }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-none">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="text-slate-400">
          {CHANNEL_ICONS[n.channel] ?? <Smartphone className="w-3.5 h-3.5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-800 text-xs truncate">{n.template}</div>
          <div className="text-[10px] text-slate-400">
            {new Date(n.createdAt).toLocaleString('fr-FR')}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-[10px] border px-2 ${STATUS_STYLES[n.status] ?? ''}`}>
            {STATUS_LABELS[n.status] ?? n.status}
          </Badge>
          <span className="text-[10px] text-slate-400 font-medium">
            {CHANNEL_LABELS[n.channel] ?? n.channel}
          </span>
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-600">
            <div>
              <span className="font-semibold text-slate-500">Envoyé à</span>
              <p>{n.sentAt ? new Date(n.sentAt).toLocaleString('fr-FR') : '—'}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Lu à</span>
              <p>{n.readAt ? new Date(n.readAt).toLocaleString('fr-FR') : '—'}</p>
            </div>
          </div>
          {n.data && Object.keys(n.data).length > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl font-mono text-[10px] text-slate-600 overflow-auto">
              {JSON.stringify(n.data, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
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
      const url = unreadOnly ? '/api/notifications?unread=true' : '/api/notifications';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setItems(json.data);
      else showToast('err', 'Erreur chargement des notifications.');
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, showToast]);

  useEffect(() => { load(); }, [load]);

  const byStatus = {
    sent: items.filter(n => n.status === 'sent').length,
    pending: items.filter(n => n.status === 'pending').length,
    failed: items.filter(n => n.status === 'failed').length,
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Boîte d&apos;envoi notifications</h1>
          <p className="text-xs text-slate-500 mt-1">Toutes les notifications générées par le système.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 text-xs rounded-full">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* SMS simulation banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span><strong>Mode simulation :</strong> Les SMS et emails sont enregistrés en base mais aucun envoi réel n&apos;est effectué vers un opérateur externe.</span>
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

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
          ✓ {byStatus.sent} envoyé(s)
        </span>
        <span className="text-[10px] px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
          ⏳ {byStatus.pending} en attente
        </span>
        <span className="text-[10px] px-3 py-1 rounded-full bg-red-50 text-red-700 font-semibold border border-red-200">
          ✕ {byStatus.failed} en échec
        </span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={e => setUnreadOnly(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-500 rounded"
          />
          Non lues uniquement
        </label>
        <div className="flex gap-1.5">
          {['in_app', 'email', 'sms'].map(ch => (
            <span key={ch} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
              {CHANNEL_LABELS[ch]}
            </span>
          ))}
        </div>
      </div>

      {/* List */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Bell className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune notification</p>
            <p className="text-xs mt-1">Les notifications apparaissent ici au fil des actions.</p>
          </div>
        ) : (
          items.map(n => <NotificationRow key={n.id} n={n} />)
        )}
      </Card>
    </div>
  );
}
