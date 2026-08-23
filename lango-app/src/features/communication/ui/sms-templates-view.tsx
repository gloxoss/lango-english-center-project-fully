'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  Plus,
  Trash2,
  Save,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  FileCode,
  ShieldCheck,
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
    setBody((prev) => `${prev} ${v}`);
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
        setError(json.message || "Échec de l'enregistrement.");
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
    .replace(/\{date\}/g, '25/05/2026')
    .replace(/\{ecole\}/g, 'SchoolOS English Center');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Studio de Modèles de Messages
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Conception de modèles réutilisables avec variables dynamiques et prévisualisation mobile en direct.
            </p>
          </div>
        </div>

        <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Approuvé Meta WhatsApp API</span>
        </Badge>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Templates List Column */}
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modèles Enregistrés</h3>
            <button
              onClick={newTemplate}
              className="text-xs font-bold text-[#0066FF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau</span>
            </button>
          </div>
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`w-full p-3 rounded-xl border flex items-start gap-2 transition-all ${
                  selectedId === t.id ? 'bg-blue-50/70 border-[#0066FF]' : 'bg-white border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <button onClick={() => selectTemplate(t)} className="flex-1 min-w-0 text-left flex items-start gap-2 cursor-pointer">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectedId === t.id ? 'bg-[#0066FF] text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-[#16212B] truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{t.body}</p>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {templates.length === 0 && <p className="text-xs text-slate-400 font-medium">Aucun modèle créé.</p>}
          </div>
        </Card>

        {/* Editor Form Column */}
        <Card className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Nom de Référence du Modèle *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rappel Facture Impayée - Relance 1"
              className="h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700">Corps du Message *</label>
              <span className="text-[11px] text-slate-400 font-mono font-bold">{body.length} / 160 caractères</span>
            </div>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Saisissez le texte du modèle..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066FF] text-slate-800 leading-relaxed font-mono"
            />

            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Variables Dynamiques Disponibles:
              </label>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-3 py-1 bg-blue-50 text-[#0052CC] hover:bg-blue-100 rounded-xl text-xs font-mono font-bold border border-blue-100 transition-colors cursor-pointer"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              disabled={saving}
              onClick={handleSave}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-2 text-xs rounded-xl h-10 px-6 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Enregistrement...' : 'Enregistrer le Modèle'}</span>
            </Button>
          </div>
        </Card>

        {/* Mobile Live Simulator Column */}
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-sm font-bold text-[#16212B]">Simulateur Mobile Live</h3>
          </div>

          <div className="bg-slate-900 p-4 rounded-3xl border-4 border-slate-800 shadow-xl space-y-3 max-w-[280px] mx-auto">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full mx-auto" />
            <div className="bg-slate-100 p-3 rounded-2xl space-y-2 text-xs">
              <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200 text-slate-800 space-y-1">
                <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans">
                  {previewBody || 'Votre message de démonstration s\'affichera ici avec les variables remplacées.'}
                </p>
                <span className="text-[9px] text-slate-400 block text-right">Aujourd'hui 14:32</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
