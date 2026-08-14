'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Pencil, Trash2, Save, X, Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type Field = {
  id: string;
  key: string;
  label: string;
  entityType: 'student' | 'guardian' | 'employee';
  fieldType: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options: string[] | null;
  required: boolean;
  defaultValue: unknown;
  sortOrder: number;
  isActive: boolean;
};

type FieldForm = {
  key: string;
  label: string;
  entityType: string;
  fieldType: string;
  options: string;
  required: string;
  sortOrder: string;
};

const ENTITY_TYPES = ['student', 'guardian', 'employee'] as const;
const FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'] as const;

const EMPTY_FORM: FieldForm = { key: '', label: '', entityType: 'student', fieldType: 'text', options: '', required: 'false', sortOrder: '0' };

const ENTITY_LABEL: Record<string, string> = { student: 'Élève', guardian: 'Tuteur', employee: 'Employé' };
const FIELD_LABEL: Record<string, string> = { text: 'Texte', number: 'Nombre', date: 'Date', select: 'Liste', boolean: 'Booléen' };

export default function CustomFieldsPage() {
  const [rows, setRows] = useState<Field[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Field | null>(null);
  const [form, setForm] = useState<FieldForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // value manager state
  const [valueFieldId, setValueFieldId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState('');
  const [rawValue, setRawValue] = useState('');
  const [existingValue, setExistingValue] = useState<unknown>(null);
  const [busyValue, setBusyValue] = useState(false);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const load = useCallback(async () => {
    try {
      const qs = entityFilter === 'all' ? '' : `?entityType=${entityFilter}`;
      const res = await fetch(`/api/settings/custom-fields${qs}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
      else showToast('err', json.error?.message ?? 'Erreur chargement des champs.');
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [entityFilter, showToast]);

  useEffect(() => { load(); }, [load]);

  const fieldDef = valueFieldId ? rows.find(r => r.id === valueFieldId) ?? null : null;

  const handleCreate = async () => {
    setBusy(true);
    try {
      const options = form.fieldType === 'select'
        ? form.options.split(',').map(o => o.trim()).filter(Boolean)
        : undefined;
      const res = await fetch('/api/settings/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key.trim(),
          label: form.label.trim(),
          entityType: form.entityType,
          fieldType: form.fieldType,
          options,
          required: form.required === 'true',
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setForm(EMPTY_FORM);
        showToast('ok', 'Champ créé.');
        load();
      } else {
        showToast('err', json.error?.message ?? 'Création impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const options = form.fieldType === 'select'
        ? form.options.split(',').map(o => o.trim()).filter(Boolean)
        : undefined;
      const res = await fetch(`/api/settings/custom-fields/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label.trim(),
          fieldType: form.fieldType,
          options,
          required: form.required === 'true',
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditing(null);
        setForm(EMPTY_FORM);
        showToast('ok', 'Champ mis à jour.');
        load();
      } else {
        showToast('err', json.error?.message ?? 'Mise à jour impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (f: Field) => {
    setEditing(f);
    setForm({
      key: f.key,
      label: f.label,
      entityType: f.entityType,
      fieldType: f.fieldType,
      options: f.options?.join(', ') ?? '',
      required: String(f.required),
      sortOrder: String(f.sortOrder),
    });
  };

  const handleDeactivate = async (f: Field) => {
    if (!window.confirm(`Désactiver le champ « ${f.label} » ?`)) return;
    try {
      const res = await fetch(`/api/settings/custom-fields/${f.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Champ désactivé.');
        if (valueFieldId === f.id) { setValueFieldId(null); setEntityId(''); }
        load();
      } else {
        showToast('err', json.error?.message ?? 'Désactivation impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    }
  };

  const openValueManager = (f: Field) => {
    setValueFieldId(f.id);
    setEntityId('');
    setRawValue('');
    setExistingValue(null);
  };

  const loadValue = async () => {
    if (!valueFieldId || !entityId.trim()) return;
    try {
      const res = await fetch(`/api/settings/custom-fields/${valueFieldId}/values?entityId=${encodeURIComponent(entityId.trim())}`);
      const json = await res.json();
      if (json.success) {
        setExistingValue(json.data?.value ?? null);
        setRawValue(json.data ? String(json.data.value) : '');
      } else {
        showToast('err', json.error?.message ?? 'Lecture impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    }
  };

  const handleSaveValue = async () => {
    if (!valueFieldId || !entityId.trim()) { showToast('err', 'Saisissez un identifiant d’entité.'); return; }
    setBusyValue(true);
    try {
      let value: unknown = rawValue;
      if (fieldDef?.fieldType === 'number') value = rawValue === '' ? '' : Number(rawValue);
      if (fieldDef?.fieldType === 'boolean') value = rawValue === 'true';
      if (fieldDef?.fieldType === 'select' && rawValue === '') { showToast('err', 'Sélectionnez une option.'); setBusyValue(false); return; }
      const res = await fetch(`/api/settings/custom-fields/${valueFieldId}/values`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entityId.trim(), value }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Valeur enregistrée.');
        loadValue();
      } else {
        showToast('err', json.error?.message ?? 'Enregistrement impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusyValue(false);
    }
  };

  const handleClearValue = async () => {
    if (!valueFieldId || !entityId.trim()) return;
    if (!window.confirm('Effacer la valeur pour cette entité ?')) return;
    setBusyValue(true);
    try {
      const res = await fetch(`/api/settings/custom-fields/${valueFieldId}/values`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entityId.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', 'Valeur supprimée.');
        setExistingValue(null);
        setRawValue('');
      } else {
        showToast('err', json.error?.message ?? 'Suppression impossible.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
    } finally {
      setBusyValue(false);
    }
  };

  const set = (k: keyof FieldForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Champs personnalisés</h1>
        <p className="text-xs text-slate-500 mt-1">Attributs sur mesure pour élèves, tuteurs et employés. Le registre définit les champs ; leur raccordement aux formulaires élèves/tuteurs/factures sera réalisé dans une étape ultérieure.</p>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
          toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <Card className="border border-slate-200 rounded-2xl shadow-xs p-5">
        <div className="text-sm font-bold text-slate-800 mb-3">{editing ? `Modifier « ${editing.label} »` : 'Nouveau champ'}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input className="h-9 text-xs rounded-xl" placeholder="Clé (ex: cndp_number)" value={form.key} onChange={set('key')} disabled={!!editing} />
          <Input className="h-9 text-xs rounded-xl" placeholder="Libellé (ex: Numéro CNDP)" value={form.label} onChange={set('label')} />
          <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={form.entityType} onChange={set('entityType')} disabled={!!editing}>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_LABEL[t]}</option>)}
          </select>
          <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={form.fieldType} onChange={set('fieldType')}>
            {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_LABEL[t]}</option>)}
          </select>
          {form.fieldType === 'select' && (
            <Input className="h-9 text-xs rounded-xl md:col-span-2" placeholder="Options séparées par des virgules (ex: A, B, C)" value={form.options} onChange={set('options')} />
          )}
          <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={form.required} onChange={set('required')}>
            <option value="false">Facultatif</option>
            <option value="true">Obligatoire</option>
          </select>
          <Input className="h-9 text-xs rounded-xl" placeholder="Ordre (ex: 10)" value={form.sortOrder} onChange={set('sortOrder')} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={editing ? handleUpdate : handleCreate}
            disabled={busy || !form.label.trim() || !form.key.trim() || (form.fieldType === 'select' && !form.options.split(',').map(o => o.trim()).filter(Boolean).length)}
            className="gap-2 h-9 rounded-full px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? 'Enregistrer' : 'Créer le champ'}
          </Button>
          {editing && (
            <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); }} className="h-9 rounded-full px-4 text-xs" variant="outline">
              <X className="w-3.5 h-3.5" /> Annuler
            </Button>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-1.5">
        {['all', ...ENTITY_TYPES].map(t => (
          <button
            key={t}
            onClick={() => setEntityFilter(t)}
            className={`h-8 px-4 rounded-full text-xs font-semibold transition-colors ${
              entityFilter === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t === 'all' ? 'Tous' : ENTITY_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">Aucun champ personnalisé. Créez le premier pour commencer.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(f => (
            <Card key={f.id} className="border border-slate-200 rounded-2xl shadow-xs p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{f.label}</span>
                    <Badge variant={f.isActive ? 'success' : 'neutral'} className="text-[10px] px-2">{f.isActive ? 'Actif' : 'Inactif'}</Badge>
                    <Badge variant="neutral" className="text-[10px] px-2">{FIELD_LABEL[f.fieldType]}</Badge>
                    {f.required && <Badge variant="warning" className="text-[10px] px-2">Obligatoire</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                    {f.key} · {ENTITY_LABEL[f.entityType]}{f.options?.length ? ` · options : ${f.options.join(', ')}` : ''}
                    <span className="text-slate-400"> · ordre {f.sortOrder}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openValueManager(f)} title="Gérer les valeurs" className="h-8 w-8 p-0 text-slate-500">
                    <Database className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(f)} title="Modifier" className="h-8 w-8 p-0 text-slate-500">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {f.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => handleDeactivate(f)} title="Désactiver" className="h-8 w-8 p-0 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {valueFieldId === f.id && (
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input className="h-9 text-xs rounded-xl" placeholder="ID de l’entité (ex: STU-2026-001)" value={entityId} onChange={e => setEntityId(e.target.value)} onBlur={loadValue} />
                  {f.fieldType === 'boolean' ? (
                    <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={rawValue} onChange={e => setRawValue(e.target.value)}>
                      <option value="">—</option>
                      <option value="true">Vrai</option>
                      <option value="false">Faux</option>
                    </select>
                  ) : f.fieldType === 'select' ? (
                    <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={rawValue} onChange={e => setRawValue(e.target.value)}>
                      <option value="">—</option>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <Input
                      className="h-9 text-xs rounded-xl"
                      type={f.fieldType === 'number' ? 'number' : f.fieldType === 'date' ? 'date' : 'text'}
                      placeholder={f.fieldType === 'number' ? 'Valeur numérique' : 'Valeur'}
                      value={rawValue}
                      onChange={e => setRawValue(e.target.value)}
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    <Button onClick={handleSaveValue} disabled={busyValue || !entityId.trim()} className="gap-1.5 h-9 rounded-full px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                      {busyValue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Enregistrer
                    </Button>
                    {existingValue !== null && (
                      <Button onClick={handleClearValue} disabled={busyValue} variant="outline" className="h-9 rounded-full px-3 text-xs">
                        Effacer
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Plus className="w-3 h-3" /> Les champs Clé/Type d’entité sont verrouillés après création.</div>
    </div>
  );
}
