'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Plus, Pencil, Trash2, Save, X, Loader2, Database } from 'lucide-react';
import { useTranslations } from 'next-intl';
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


export default function CustomFieldsPage() {
  const cf = useTranslations('CustomFieldsPage');
  const ENTITY_LABEL = (key: string) => (cf.has(`entities.${key}`) ? cf(`entities.${key}` as 'entities.student') : key);
  const FIELD_LABEL = (key: string) => (cf.has(`types.${key}`) ? cf(`types.${key}` as 'types.text') : key);
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
      else showToast('err', json.error?.message ?? cf('loadError'));
    } catch {
      showToast('err', cf('networkError'));
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
        showToast('ok', cf('created'));
        load();
      } else {
        showToast('err', json.error?.message ?? cf('createError'));
      }
    } catch {
      showToast('err', cf('networkError'));
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
        showToast('ok', cf('updated'));
        load();
      } else {
        showToast('err', json.error?.message ?? cf('updateError'));
      }
    } catch {
      showToast('err', cf('networkError'));
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
    if (!window.confirm(cf('confirmDeactivate', { label: f.label }))) return;
    try {
      const res = await fetch(`/api/settings/custom-fields/${f.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('ok', cf('deactivated'));
        if (valueFieldId === f.id) { setValueFieldId(null); setEntityId(''); }
        load();
      } else {
        showToast('err', json.error?.message ?? cf('deactivateError'));
      }
    } catch {
      showToast('err', cf('networkError'));
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
        showToast('err', json.error?.message ?? cf('readError'));
      }
    } catch {
      showToast('err', cf('networkError'));
    }
  };

  const handleSaveValue = async () => {
    if (!valueFieldId || !entityId.trim()) { showToast('err', cf('entityIdRequired')); return; }
    setBusyValue(true);
    try {
      let value: unknown = rawValue;
      if (fieldDef?.fieldType === 'number') value = rawValue === '' ? '' : Number(rawValue);
      if (fieldDef?.fieldType === 'boolean') value = rawValue === 'true';
      if (fieldDef?.fieldType === 'select' && rawValue === '') { showToast('err', cf('selectOption')); setBusyValue(false); return; }
      const res = await fetch(`/api/settings/custom-fields/${valueFieldId}/values`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entityId.trim(), value }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', cf('valueSaved'));
        loadValue();
      } else {
        showToast('err', json.error?.message ?? cf('saveError'));
      }
    } catch {
      showToast('err', cf('networkError'));
    } finally {
      setBusyValue(false);
    }
  };

  const handleClearValue = async () => {
    if (!valueFieldId || !entityId.trim()) return;
    if (!window.confirm(cf('confirmClear'))) return;
    setBusyValue(true);
    try {
      const res = await fetch(`/api/settings/custom-fields/${valueFieldId}/values`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entityId.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', cf('valueCleared'));
        setExistingValue(null);
        setRawValue('');
      } else {
        showToast('err', json.error?.message ?? cf('clearError'));
      }
    } catch {
      showToast('err', cf('networkError'));
    } finally {
      setBusyValue(false);
    }
  };

  const set = (k: keyof FieldForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{cf('title')}</h1>
        <p className="text-xs text-slate-500 mt-1">{cf('subtitle')}</p>
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
        <div className="text-sm font-bold text-slate-800 mb-3">{editing ? cf('editTitle', { label: editing.label }) : cf('newField')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input className="h-9 text-xs rounded-xl" placeholder={cf('keyPlaceholder')} value={form.key} onChange={set('key')} disabled={!!editing} />
          <Input className="h-9 text-xs rounded-xl" placeholder={cf('labelPlaceholder')} value={form.label} onChange={set('label')} />
          <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={form.entityType} onChange={set('entityType')} disabled={!!editing}>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_LABEL(t)}</option>)}
          </select>
          <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={form.fieldType} onChange={set('fieldType')}>
            {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_LABEL(t)}</option>)}
          </select>
          {form.fieldType === 'select' && (
            <Input className="h-9 text-xs rounded-xl md:col-span-2" placeholder={cf('optionsPlaceholder')} value={form.options} onChange={set('options')} />
          )}
          <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={form.required} onChange={set('required')}>
            <option value="false">{cf('optional')}</option>
            <option value="true">{cf('required')}</option>
          </select>
          <Input className="h-9 text-xs rounded-xl" placeholder={cf('orderPlaceholder')} value={form.sortOrder} onChange={set('sortOrder')} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={editing ? handleUpdate : handleCreate}
            disabled={busy || !form.label.trim() || !form.key.trim() || (form.fieldType === 'select' && !form.options.split(',').map(o => o.trim()).filter(Boolean).length)}
            className="gap-2 h-9 rounded-full px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? cf('save') : cf('create')}
          </Button>
          {editing && (
            <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); }} className="h-9 rounded-full px-4 text-xs" variant="outline">
              <X className="w-3.5 h-3.5" /> {cf('cancel')}
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
            {t === 'all' ? cf('all') : ENTITY_LABEL(t)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">{cf('empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(f => (
            <Card key={f.id} className="border border-slate-200 rounded-2xl shadow-xs p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{f.label}</span>
                    <Badge variant={f.isActive ? 'success' : 'neutral'} className="text-[10px] px-2">{f.isActive ? cf('active') : cf('inactive')}</Badge>
                    <Badge variant="neutral" className="text-[10px] px-2">{FIELD_LABEL(f.fieldType)}</Badge>
                    {f.required && <Badge variant="warning" className="text-[10px] px-2">{cf('required')}</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                    {f.key} · {ENTITY_LABEL(f.entityType)}{f.options?.length ? ` · ${cf('optionsList', { list: f.options.join(', ') })}` : ''}
                    <span className="text-slate-400"> · {cf('order', { n: f.sortOrder })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openValueManager(f)} title={cf('manageValues')} aria-label={cf('manageValues')} className="h-8 w-8 p-0 text-slate-500">
                    <Database className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(f)} title={cf('edit')} aria-label={cf('edit')} className="h-8 w-8 p-0 text-slate-500">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {f.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => handleDeactivate(f)} title={cf('deactivate')} aria-label={cf('deactivate')} className="h-8 w-8 p-0 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {valueFieldId === f.id && (
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input className="h-9 text-xs rounded-xl" placeholder={cf('entityIdPlaceholder')} value={entityId} onChange={e => setEntityId(e.target.value)} onBlur={loadValue} />
                  {f.fieldType === 'boolean' ? (
                    <select className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 text-slate-700" value={rawValue} onChange={e => setRawValue(e.target.value)}>
                      <option value="">—</option>
                      <option value="true">{cf('yes')}</option>
                      <option value="false">{cf('no')}</option>
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
                      placeholder={f.fieldType === 'number' ? cf('numberValue') : cf('value')}
                      value={rawValue}
                      onChange={e => setRawValue(e.target.value)}
                    />
                  )}
                  <div className="flex items-center gap-1.5">
                    <Button onClick={handleSaveValue} disabled={busyValue || !entityId.trim()} className="gap-1.5 h-9 rounded-full px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                      {busyValue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {cf('save')}
                    </Button>
                    {existingValue !== null && (
                      <Button onClick={handleClearValue} disabled={busyValue} variant="outline" className="h-9 rounded-full px-3 text-xs">
                        {cf('clear')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Plus className="w-3 h-3" /> {cf('lockedNote')}</div>
    </div>
  );
}
