'use client';

import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  MessageSquare,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ApiTemplate = { id: string; name: string; body: string };

const VARIABLES = ['{nom_parent}', '{nom_eleve}', '{montant}', '{date}', '{ecole}'];

export function SmsTemplatesView({ locale }: { locale?: string } = {}) {
  const t = useTranslations('Communication');
  const tCommon = useTranslations('Common');
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
      setError(t('nameAndBodyRequired'));
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
        setError(json.message || t('saveFailed'));
        return;
      }
      setSuccess(json.message);
      await loadTemplates();
      if (!selectedId) {
        selectTemplate(json.data);
      }
    } catch (err) {
      console.error('Template save failed', err);
      setError(t('connectionFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(tCommon('confirmDeleteGeneric'))) {
      return;
    }
    try {
      const res = await fetch(`/api/communication/templates?id=${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        toast.error(json?.error?.message || json?.message || tCommon('error'));
        return;
      }
    } catch {
      toast.error(tCommon('networkError'));
      return;
    }
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
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      {/* Top Header */}
      <div className="
        flex flex-col justify-between gap-4 rounded-2xl border
        border-slate-200/80 bg-white p-6 shadow-2xs
        sm:flex-row sm:items-center
      "
      >
        <div className="flex items-center gap-4">
          <div className="
            flex size-12 shrink-0 items-center justify-center rounded-2xl
            bg-linear-to-br from-[#0066FF] to-[#0052CC] text-white shadow-2xs
          "
          >
            <FileCode className="size-6" />
          </div>
          <div>
            <h1 className="
              text-2xl font-extrabold tracking-tight text-[#16212B]
            "
            >
              {t('templatesStudioTitle')}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {t('templatesStudioSubtitle')}
            </p>
          </div>
        </div>

        <Badge variant="success" className="gap-1 px-3 py-1.5 text-xs font-bold">
          <ShieldCheck className="size-3.5" />
          <span>{t('metaApproved')}</span>
        </Badge>
      </div>

      {error && (
        <div className="
          flex items-center gap-2.5 rounded-2xl border border-rose-200
          bg-rose-50 p-4 text-xs font-bold text-rose-800
        "
        >
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="
          flex items-center gap-2.5 rounded-2xl border border-emerald-200
          bg-emerald-50 p-4 text-xs font-bold text-emerald-800
        "
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="
        grid grid-cols-1 gap-6
        lg:grid-cols-4
      "
      >
        {/* Templates List Column */}
        <Card className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4
          shadow-2xs
        "
        >
          <div className="flex items-center justify-between">
            <h3 className="
              text-xs font-bold tracking-wider text-slate-500 uppercase
            "
            >
              {t('savedTemplates')}
            </h3>
            <button
              onClick={newTemplate}
              className="
                flex cursor-pointer items-center gap-1 text-xs font-bold
                text-[#0066FF]
                hover:underline
              "
            >
              <Plus className="size-3.5" />
              <span>{t('newTemplate')}</span>
            </button>
          </div>
          <div className="space-y-2">
            {templates.map(tItem => (
              <div
                key={tItem.id}
                className={`
                  flex w-full items-start gap-2 rounded-xl border p-3
                  transition-all
                  ${
              selectedId === tItem.id
                ? 'border-[#0066FF] bg-blue-50/70'
                : `
                  border-slate-200/80 bg-white
                  hover:bg-slate-50
                `
              }
                `}
              >
                <button
                  onClick={() => selectTemplate(tItem)}
                  className="
                    flex min-w-0 flex-1 cursor-pointer items-start gap-2
                    text-start
                  "
                >
                  <div
                    className={`
                      flex size-8 shrink-0 items-center justify-center
                      rounded-lg
                      ${
              selectedId === tItem.id
                ? 'bg-[#0066FF] text-white'
                : `bg-slate-100 text-slate-500`
              }
                    `}
                  >
                    <MessageSquare className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="
                      truncate text-xs font-extrabold text-[#16212B]
                    "
                    >
                      {tItem.name}
                    </p>
                    <p className="
                      mt-0.5 truncate text-[10px] font-medium text-slate-400
                    "
                    >
                      {tItem.body}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(tItem.id)}
                  title={t('deleteTemplate')}
                  className="
                    shrink-0 cursor-pointer rounded-lg p-1 text-rose-500
                    hover:bg-rose-50
                  "
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-xs font-medium text-slate-400">
                {t('noTemplatesCreated')}
              </p>
            )}
          </div>
        </Card>

        {/* Editor Form Column */}
        <Card className="
          space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
          lg:col-span-2
        "
        >
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">{t('templateNameLabel')}</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('templateNamePlaceholder')}
              className="
                h-10 rounded-xl border border-slate-200 bg-slate-50 text-xs
              "
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700">{t('messageBodyLabel')}</label>
              <span className="font-mono text-[11px] font-bold text-slate-400">
                {t('charCount', { current: body.length, max: 160 })}
              </span>
            </div>
            <textarea
              rows={5}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={t('messageBodyPlaceholder')}
              className="
                w-full rounded-xl border border-slate-200 bg-slate-50 p-3
                font-mono text-xs/relaxed text-slate-800
                focus:ring-2 focus:ring-[#0066FF] focus:outline-none
              "
            />

            <div className="space-y-2 pt-2">
              <label className="
                text-[11px] font-bold tracking-wider text-slate-500 uppercase
              "
              >
                {t('dynamicVariablesAvailable')}
              </label>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="
                      cursor-pointer rounded-xl border border-blue-100
                      bg-blue-50 px-3 py-1 font-mono text-xs font-bold
                      text-[#0052CC] transition-colors
                      hover:bg-blue-100
                    "
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-2">
            <Button
              disabled={saving}
              onClick={handleSave}
              className="
                h-10 cursor-pointer gap-2 rounded-xl bg-[#0066FF] px-6 text-xs
                font-bold text-white
                hover:bg-[#0052CC]
              "
            >
              <Save className="size-4" />
              <span>{saving ? t('saving') : t('saveTemplate')}</span>
            </Button>
          </div>
        </Card>

        {/* Mobile Live Simulator Column */}
        <Card className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
        "
        >
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-[#0066FF]" />
            <h3 className="text-sm font-bold text-[#16212B]">{t('mobileSimulatorTitle')}</h3>
          </div>

          <div className="
            mx-auto max-w-[280px] space-y-3 rounded-3xl border-4
            border-slate-800 bg-slate-900 p-4 shadow-xl
          "
          >
            <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-700" />
            <div className="space-y-2 rounded-2xl bg-slate-100 p-3 text-xs">
              <div className="
                space-y-1 rounded-xl border border-slate-200 bg-white p-3
                text-slate-800 shadow-xs
              "
              >
                <p className="
                  font-sans text-[11px] leading-relaxed whitespace-pre-wrap
                "
                >
                  {previewBody || t('mobileSimulatorPlaceholder')}
                </p>
                <span className="block text-right text-[9px] text-slate-400">{t('todayTime', { time: '14:32' })}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
