'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plus, RefreshCw, FileText, AlertCircle, X, ChevronDown, ChevronUp, CheckCircle2, Send,
} from 'lucide-react';
import { api, CHANNEL_LABELS, CHANNEL_BADGE, TEMPLATE_STATUS_LABELS, fmtDate, isAddonNotActivated, type ApiErrorShape } from './broadcast-ui';

type TemplateVersion = {
  id: string;
  version: number;
  subject: string | null;
  bodyText: string;
  variableSchema: { name: string }[] | null;
  status: string;
  createdAt: string;
};

type Template = {
  id: string;
  name: string;
  channel: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  latestVersion: TemplateVersion | null;
};

const CHANNELS = ['sms', 'email', 'whatsapp', 'telegram', 'messenger'];
const CATEGORIES = ['general', 'announcement', 'reminder', 'event', 'invoice', 'other'];

export function TemplatesView() {
  const [rows, setRows] = useState<Template[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('sms');
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');

  const [expanded, setExpanded] = useState<Record<string, { versions: TemplateVersion[]; loaded: boolean }>>({});
  const [newVersions, setNewVersions] = useState<Record<string, { subject: string; bodyText: string }>>({});
  const [published, setPublished] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Template[]>('/api/addons/broadcast/templates');
    if (res.ok && res.data) setRows(res.data);
    else setError(res.error ?? { message: 'Impossible de charger les modèles.' });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (t: Template) => {
    if (expanded[t.id]?.loaded) {
      setExpanded((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] ?? { versions: [] as TemplateVersion[] }), loaded: false } }));
      return;
    }
    const res = await api<TemplateVersion[]>(`/api/addons/broadcast/templates/${t.id}/versions`);
    if (res.ok && res.data) {
      setExpanded((prev) => ({ ...prev, [t.id]: { versions: res.data ?? [], loaded: true } }));
    }
  };

  const addVersion = async (t: Template) => {
    const v = newVersions[t.id];
    if (!v || !v.bodyText.trim()) return;
    const res = await api<TemplateVersion>(`/api/addons/broadcast/templates/${t.id}/versions`, {
      method: 'POST', body: JSON.stringify({ subject: v.subject, bodyText: v.bodyText }),
    });
    if (res.ok) {
      setNewVersions((prev) => ({ ...prev, [t.id]: { subject: '', bodyText: '' } }));
      await toggleExpand(t);
      load();
    }
  };

  const publish = async (t: Template, versionId: string) => {
    const res = await api<{ status: string }>(`/api/addons/broadcast/templates/${t.id}/versions/${versionId}/publish`, { method: 'POST' });
    if (res.ok) {
      setPublished((prev) => ({ ...prev, [versionId]: true }));
      await toggleExpand(t);
      load();
    }
  };

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    const res = await api<{ template: Template; version: TemplateVersion }>('/api/addons/broadcast/templates', {
      method: 'POST',
      body: JSON.stringify({ name, channel, category, initial: { subject, bodyText } }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName(''); setChannel('sms'); setCategory('general'); setSubject(''); setBodyText('');
      load();
    } else {
      setFormError(res.error?.message ?? 'Création impossible.');
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement des modèles…</div>;
  }

  if (error && !rows) {
    if (isAddonNotActivated(error)) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error.message ?? 'Module non activé.'}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-20 text-rose-600">
        <AlertCircle className="h-5 w-5" /> {error.message ?? 'Erreur inconnue.'}
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Réessayer</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Modèles de messages</h1>
          <p className="text-sm text-slate-500">Versions versionnées ; publiez la version immuable utilisée par les campagnes.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}><Plus className="mr-2 h-4 w-4" /> Nouveau modèle</Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-[#16212B]">Nouveau modèle</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Rappel de rentrée" />
            </div>
            <div>
              <Label>Canal</Label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <Label>Catégorie</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Objet (e-mail)</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Contenu</Label>
              <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={3} placeholder="Bonjour {{firstName}}, …" />
              <p className="mt-1 text-xs text-slate-400">Variables auto-détectées avec la syntaxe <code>{'{{nom}}'}</code>.</p>
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={saving || !name.trim() || !bodyText.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} Créer
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {(!rows || rows.length === 0) ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aucun modèle. Créez un modèle pour l’utiliser dans une campagne.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => {
            const ex = expanded[t.id];
            return (
              <Card key={t.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D1F5E8] text-[#16212B]"><FileText className="h-5 w-5" /></div>
                    <div>
                      <p className="font-semibold text-[#16212B]">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.category} · modifié le {fmtDate(t.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`border ${CHANNEL_BADGE[t.channel]}`}>{CHANNEL_LABELS[t.channel]}</Badge>
                    <Badge className={`border ${t.latestVersion?.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      {t.latestVersion ? `${TEMPLATE_STATUS_LABELS[t.latestVersion.status] ?? t.latestVersion.status} v${t.latestVersion.version}` : 'Sans version'}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggleExpand(t)}>
                      {ex?.loaded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {ex?.loaded && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    {ex.versions.length === 0 && <p className="text-sm text-slate-400">Aucune version.</p>}
                    {ex.versions.map((v) => (
                      <div key={v.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-[#16212B]">v{v.version}</span>
                            <Badge className={`border ${v.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>{TEMPLATE_STATUS_LABELS[v.status] ?? v.status}</Badge>
                            {v.subject && <span>· {v.subject}</span>}
                          </div>
                          {v.status === 'draft' && (
                            <Button size="sm" onClick={() => publish(t, v.id)} disabled={published[v.id]}>
                              {published[v.id] ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Send className="mr-1 h-3.5 w-3.5" />} Publier
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{v.bodyText}</p>
                        {v.variableSchema && v.variableSchema.length > 0 && (
                          <p className="mt-1 text-xs text-slate-400">Variables : {v.variableSchema.map((x) => `{{${x.name}}}`).join(' ')}</p>
                        )}
                      </div>
                    ))}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label>Ajouter une version</Label>
                        <Input
                          value={newVersions[t.id]?.bodyText ?? ''}
                          onChange={(e) => setNewVersions((prev) => ({ ...prev, [t.id]: { subject: prev[t.id]?.subject ?? '', bodyText: e.target.value } }))}
                          placeholder="Contenu de la nouvelle version…"
                        />
                      </div>
                      <Button variant="outline" onClick={() => addVersion(t)} disabled={!newVersions[t.id]?.bodyText?.trim()}>+ Version</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
