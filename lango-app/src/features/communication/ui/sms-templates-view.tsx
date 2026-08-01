'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Plus, Trash2, Save, Smartphone, AlertCircle, CheckCircle2,
} from 'lucide-react';

type ApiTemplate = { id: string; name: string; body: string };

const VARIABLES = ['{nom_parent}', '{nom_eleve}', '{montant}', '{date}', '{ecole}'];

export function SmsTemplatesView() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTemplates() {
    try {
      const res = await fetch('/api/communication/templates');
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data);
      }
    } catch (err) {
      console.error('Failed loading templates', err);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function selectTemplate(t: ApiTemplate) {
    setSelectedId(t.id);
    setName(t.name);
    setBody(t.body);
  }

  function newTemplate() {
    setSelectedId(null);
    setName('');
    setBody('');
  }

  function insertVariable(v: string) {
    setBody(prev => `${prev} ${v}`);
  }

  async function handleSave() {
    if (!name || !body) {
      setError('Nom et message sont requis.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/communication/templates', {
        method: selectedId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedId ? { id: selectedId, name, body } : { name, body }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de l\'enregistrement.');
        return;
      }
      setSuccess(json.message);
      await loadTemplates();
      if (!selectedId) {
        selectTemplate(json.data);
      }
    } catch (err) {
      console.error('Template save failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/communication/templates?id=${id}`, { method: 'DELETE' });
    if (selectedId === id) {
      newTemplate();
    }
    await loadTemplates();
  }

  const previewBody = body
    .replace(/\{nom_parent\}/g, 'M. Karim Benali')
    .replace(/\{nom_eleve\}/g, 'Yassine Benali')
    .replace(/\{montant\}/g, '3 600 MAD')
    .replace(/\{date\}/g, '25/05/2025')
    .replace(/\{ecole\}/g, 'Groupe scolaire Atlas');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Modèles de messages</h1>
          <p className="text-xs text-slate-500 mt-1">Créez et gérez vos modèles de SMS.</p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500">Modèles</h3>
            <button onClick={newTemplate} className="text-xs font-bold text-[#2487B8] hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /><span>Nouveau</span>
            </button>
          </div>
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className={`w-full p-3 rounded-xl border flex items-start gap-2 ${selectedId === t.id ? 'bg-[#DCEBF4]/50 border-[#2487B8]' : 'bg-white border-slate-200/80'}`}>
                <button onClick={() => selectTemplate(t)} className="flex-1 min-w-0 text-left flex items-start gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedId === t.id ? 'bg-[#2487B8] text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#16212B] truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{t.body}</p>
                  </div>
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {templates.length === 0 && <p className="text-xs text-slate-400">Aucun modèle.</p>}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Nom du modèle</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700">Message</label>
              <span className="text-[11px] text-slate-400 font-mono">{body.length} / 160</span>
            </div>
            <textarea
              rows={4}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#2487B8] text-slate-800 leading-relaxed"
            />
            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-bold text-slate-500">Variables disponibles</label>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map(v => (
                  <button key={v} type="button" onClick={() => insertVariable(v)} className="px-2.5 py-1 bg-[#DCEBF4] text-[#1B6C93] hover:bg-[#CBE1EF] rounded-lg text-xs font-mono font-bold transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" disabled={saving} onClick={handleSave} className="gap-2 text-xs rounded-xl h-10 px-6">
              <Save className="w-4 h-4" />
              <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#2487B8]" />
            <h3 className="text-sm font-bold text-[#16212B]">Aperçu SMS</h3>
          </div>
          <div className="bg-slate-900 p-4 rounded-3xl border-4 border-slate-800 shadow-xl space-y-3 max-w-[280px] mx-auto">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full mx-auto"></div>
            <div className="bg-slate-100 p-3 rounded-2xl space-y-2 text-xs">
              <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200 text-slate-800 space-y-1">
                <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{previewBody || 'Votre message apparaîtra ici.'}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
