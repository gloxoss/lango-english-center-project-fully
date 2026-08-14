'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, RefreshCw, Sparkles, AlertCircle, X, Power, Play, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { api, CHANNEL_LABELS, CHANNEL_BADGE, AUTOMATION_KIND_LABELS, fmtDate, fmtCount } from './broadcast-ui';

type Connection = { id: string; name: string; channel: string };
type Template = { id: string; name: string; channel: string };

type Automation = {
  id: string; name: string; kind: string; channel: string; connectionId: string; templateId: string;
  sendTime: string; isActive: boolean; nextRunAt: string | null; createdAt: string; updatedAt: string;
};

type Run = {
  id: string; runDate: string; status: string; createdCount: number | null;
  queuedCount: number | null; skippedCount: number | null; failedCount: number | null;
  startedAt: string | null; completedAt: string | null; createdAt: string;
};

const KINDS = ['birthday_student', 'birthday_staff'];

export function AutomationsView() {
  const [rows, setRows] = useState<Automation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [name, setName] = useState('');
  const [kind, setKind] = useState('birthday_student');
  const [channel, setChannel] = useState('sms');
  const [connectionId, setConnectionId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [sendTime, setSendTime] = useState('09:00');

  const [runs, setRuns] = useState<Record<string, Run[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Automation[]>('/api/addons/broadcast/automations');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error?.message ?? 'Impossible de charger les automations.');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showForm) return;
    api<Connection[]>('/api/addons/broadcast/connections').then((r) => { if (r.ok && r.data) setConnections(r.data); });
    api<Template[]>('/api/addons/broadcast/templates').then((r) => { if (r.ok && r.data) setTemplates(r.data); });
  }, [showForm]);

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    const res = await api<Automation>('/api/addons/broadcast/automations', {
      method: 'POST',
      body: JSON.stringify({ name, kind, channel, connectionId, templateId, sendTime }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName(''); setKind('birthday_student'); setChannel('sms'); setConnectionId(''); setTemplateId(''); setSendTime('09:00');
      load();
    } else {
      setFormError(res.error?.message ?? 'Création impossible.');
    }
  };

  const toggle = async (a: Automation) => {
    await api(`/api/addons/broadcast/automations/${a.id}/toggle`, { method: 'POST' });
    load();
  };

  const del = async (a: Automation) => {
    await api(`/api/addons/broadcast/automations/${a.id}`, { method: 'DELETE' });
    load();
  };

  const testRun = async (a: Automation) => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await api<{ alreadyRan: boolean; queuedCount: number }>(`/api/addons/broadcast/automations/${a.id}/test`, {
      method: 'POST', body: JSON.stringify({ runDate: today }),
    });
    if (res.ok) setMsg({ ok: true, text: `Test exécuté : ${res.data?.queuedCount ?? 0} destinataire(s) mis en file.` });
    else setMsg({ ok: false, text: res.error?.message ?? 'Test impossible.' });
    load();
  };

  const toggleRuns = async (a: Automation) => {
    if (runs[a.id]) {
      setRuns((prev) => { const n = { ...prev }; delete n[a.id]; return n; });
      setExpanded((prev) => ({ ...prev, [a.id]: false }));
      return;
    }
    const res = await api<Run[]>(`/api/addons/broadcast/automations/${a.id}/runs`);
    if (res.ok && res.data) { setRuns((prev) => ({ ...prev, [a.id]: res.data ?? [] })); setExpanded((prev) => ({ ...prev, [a.id]: true })); }
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement des automations…</div>;
  }

  if (error && !rows) {
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error}
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Réessayer</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Automations</h1>
          <p className="text-sm text-slate-500">Envois automatiques déclenchés par un événement (ex. anniversaires).</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="mr-2 h-4 w-4" /> Nouvelle automation</Button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {msg.ok ? <Sparkles className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
        </div>
      )}

      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">Nouvelle automation</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Vœux d’anniversaire élèves" />
            </div>
            <div>
              <Label>Déclencheur</Label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {KINDS.map((k) => <option key={k} value={k}>{AUTOMATION_KIND_LABELS[k]}</option>)}
              </select>
            </div>
            <div>
              <Label>Canal</Label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {['sms', 'email', 'whatsapp', 'telegram', 'messenger'].map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <Label>Connexion</Label>
              <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">— Sélectionner —</option>
                {connections.filter((c) => c.channel === channel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Modèle (version publiée)</Label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">— Sélectionner —</option>
                {templates.filter((t) => t.channel === channel).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Heure d’envoi</Label>
              <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={saving || !name.trim() || !connectionId || !templateId}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Créer
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aucune automation. Créez-en une pour automatiser vos envois.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><Sparkles className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-[#16212B]">{a.name}</p>
                    <p className="text-xs text-slate-500">{AUTOMATION_KIND_LABELS[a.kind] ?? a.kind} · envoi à {a.sendTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`border ${CHANNEL_BADGE[a.channel]}`}>{CHANNEL_LABELS[a.channel]}</Badge>
                  <Badge className={`border ${a.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Button variant="outline" size="sm" onClick={() => toggle(a)}><Power className="mr-1 h-3.5 w-3.5" /> {a.isActive ? 'Désactiver' : 'Activer'}</Button>
                  <Button variant="outline" size="sm" onClick={() => testRun(a)}><Play className="mr-1 h-3.5 w-3.5" /> Tester</Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleRuns(a)}>{expanded[a.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-rose-600" onClick={() => del(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {expanded[a.id] && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-[#16212B]">Exécutions</h3>
                  {(!runs[a.id] || (runs[a.id]?.length ?? 0) === 0) && <p className="text-sm text-slate-400">Aucune exécution.</p>}
                  {runs[a.id]?.map((r) => (
                    <div key={r.id} className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
                      <span className="font-medium text-[#16212B]">{fmtDate(r.runDate)}</span>
                      <Badge className={`border ${r.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{r.status === 'completed' ? 'Terminée' : r.status}</Badge>
                      <span className="text-xs text-slate-500">Trouvés : <b>{fmtCount(r.createdCount)}</b></span>
                      <span className="text-xs text-slate-500">En file : <b>{fmtCount(r.queuedCount)}</b></span>
                      <span className="text-xs text-slate-500">Exclus : <b>{fmtCount(r.skippedCount)}</b></span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
