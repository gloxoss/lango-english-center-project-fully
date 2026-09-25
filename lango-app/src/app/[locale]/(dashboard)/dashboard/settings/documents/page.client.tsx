'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DOCUMENT_DEFAULTS, type DocumentDesign, type DocumentKind } from '@/features/documents/contracts';
import { openDocumentPreview } from '@/features/documents/ui/pdf-preview';
import {
  DOCUMENT_KINDS,
  FIELD_CONFIGS,
  OPTIONAL_FIELD_CONFIGS,
  SECTION_CONFIGS,
} from '@/features/documents/ui/document-design-config';

export default function DocumentDesignPage({ locale }: { locale: string }) {
  const t = useTranslations('DocumentSettings');
  const [kind, setKind] = useState<DocumentKind>('invoice');
  const [design, setDesign] = useState<DocumentDesign>(DOCUMENT_DEFAULTS.invoice);
  const [version, setVersion] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/documents/designs/${kind}`);
        const body = (await response.json()) as {
          data?: { published: { versionId: string | null }; draft: { design: DocumentDesign } };
          message?: string;
        };
        if (!response.ok || !body.data) throw new Error(body.message || t('settingsUnavailable'));
        if (!cancelled) {
          setDesign(body.data.draft.design);
          setVersion(body.data.published.versionId);
          setMessage('');
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : t('loadError'));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [kind, t]);

  async function save(publish: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/documents/designs/${kind}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(design),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || t('saveError'));
      if (publish) {
        const published = await fetch(`/api/documents/designs/${kind}/publish`, { method: 'POST' });
        const body = (await published.json()) as { data?: { versionId: string }; message?: string };
        if (!published.ok) throw new Error(body.message || t('publishError'));
        setVersion(body.data?.versionId ?? null);
      }
      setMessage(publish ? t('versionPublishedSuccess') : t('draftSavedSuccess'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('genericError'));
    } finally {
      setBusy(false);
    }
  }

  function moveSection(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= design.sectionOrder.length) return;
    const order = [...design.sectionOrder];
    [order[index], order[target]] = [order[target]!, order[index]!];
    setDesign({ ...design, sectionOrder: order });
  }

  function preview() {
    const id = sourceId.trim();
    if (kind === 'leadership_report') {
      return openDocumentPreview({ kind, sourceId: 'current', range: '30d', useDraft: true }, locale);
    }
    if (kind === 'exam_seating' || kind === 'exam_attendance') {
      return openDocumentPreview(
        {
          kind,
          sourceId: 'selected',
          scheduleIds: id.split(',').map(value => value.trim()).filter(Boolean),
          useDraft: true,
        },
        locale
      );
    }
    if (kind === 'timetable') {
      return openDocumentPreview({ kind, sourceId: id, viewMode, useDraft: true }, locale);
    }
    return openDocumentPreview({ kind, sourceId: id, useDraft: true }, locale);
  }

  const sectionLabelMap = Object.fromEntries(
    SECTION_CONFIGS.map(item => [item.section, t(item.labelKey)])
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('description')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DOCUMENT_KINDS.map(item => (
          <Button
            key={item.kind}
            type="button"
            variant={kind === item.kind ? 'default' : 'outline'}
            onClick={() => setKind(item.kind)}
          >
            {t(item.labelKey)}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 rounded-xl border bg-white p-5 md:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold">
          {t('style')}
          <select
            className="w-full rounded-md border p-2"
            value={design.variant}
            onChange={event =>
              setDesign({ ...design, variant: event.target.value as DocumentDesign['variant'] })
            }
          >
            <option value="classique">{t('styleClassic')}</option>
            <option value="minimal">{t('styleMinimal')}</option>
            <option value="moderne">{t('styleModern')}</option>
          </select>
        </label>

        <label className="space-y-1 text-sm font-semibold">
          {t('format')}
          <select
            className="w-full rounded-md border p-2"
            value={design.pageSize}
            onChange={event =>
              setDesign({ ...design, pageSize: event.target.value as DocumentDesign['pageSize'] })
            }
          >
            <option value="a4">A4</option>
            {kind === 'receipt' && <option value="a5">A5</option>}
          </select>
        </label>

        <label className="space-y-1 text-sm font-semibold">
          {t('orientation')}
          <select
            className="w-full rounded-md border p-2"
            value={design.orientation}
            onChange={event =>
              setDesign({ ...design, orientation: event.target.value as DocumentDesign['orientation'] })
            }
          >
            <option value="portrait">{t('orientationPortrait')}</option>
            <option value="landscape">{t('orientationLandscape')}</option>
          </select>
        </label>

        <label className="space-y-1 text-sm font-semibold">
          {t('accentColor')}
          <Input
            type="color"
            value={design.accentColor}
            onChange={event => setDesign({ ...design, accentColor: event.target.value })}
          />
        </label>

        <label className="space-y-1 text-sm font-semibold">
          {t('fontSize')}
          <select
            className="w-full rounded-md border p-2"
            value={design.fontScale}
            onChange={event =>
              setDesign({ ...design, fontScale: event.target.value as DocumentDesign['fontScale'] })
            }
          >
            <option value="compact">{t('fontCompact')}</option>
            <option value="normal">{t('fontNormal')}</option>
            <option value="large">{t('fontLarge')}</option>
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">{t('officialElements')}</legend>
          {(
            [
              ['showLogo', 'logo'],
              ['showStamp', 'stamp'],
              ['showSignature', 'signature'],
            ] as const
          ).map(([key, labelKey]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={design[key]}
                onChange={event => setDesign({ ...design, [key]: event.target.checked })}
              />
              {t(labelKey)}
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">{t('optionalFieldsTitle')}</legend>
          {OPTIONAL_FIELD_CONFIGS.map(item => (
            <label key={item.field} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={design.optionalFields.includes(item.field)}
                onChange={event =>
                  setDesign({
                    ...design,
                    optionalFields: event.target.checked
                      ? [...design.optionalFields, item.field]
                      : design.optionalFields.filter(f => f !== item.field),
                  })
                }
              />
              {t(item.labelKey)}
            </label>
          ))}
        </fieldset>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t('sectionOrderTitle')}</h2>
          {design.sectionOrder.map((section, index) => {
            const label = sectionLabelMap[section] ?? section;
            return (
              <div key={section} className="flex items-center justify-between rounded border px-3 py-1 text-sm">
                <span>{label}</span>
                <span>
                  <button
                    type="button"
                    aria-label={t('moveUp', { name: label })}
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    className="px-2 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t('moveDown', { name: label })}
                    onClick={() => moveSection(index, 1)}
                    disabled={index === design.sectionOrder.length - 1}
                    className="px-2 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t('labelsTitle')}</h2>
          {FIELD_CONFIGS[kind].map(item => (
            <label key={item.key} className="block text-xs text-slate-600">
              {t(item.labelKey)}
              <Input
                value={design.labels[item.key] ?? ''}
                placeholder={t('defaultLabel')}
                onChange={event =>
                  setDesign({
                    ...design,
                    labels: { ...design.labels, [item.key]: event.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>

        <label className="space-y-1 text-sm font-semibold md:col-span-2">
          {t('footerText')}
          <textarea
            className="min-h-20 w-full rounded-md border p-2 font-normal"
            maxLength={500}
            value={design.footerText}
            onChange={event => setDesign({ ...design, footerText: event.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} onClick={() => void save(false)}>
          {t('saveDraft')}
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => void save(true)}>
          {t('publish')}
        </Button>
        <span className="text-xs text-slate-500">
          {version ? t('versionPublished') : t('noVersionPublished')}
        </span>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-2 font-semibold">{t('previewAuthorized')}</h2>
        <div className="flex gap-2">
          {kind !== 'leadership_report' && (
            <Input
              aria-label={t('docOrStudentId')}
              value={sourceId}
              onChange={event => setSourceId(event.target.value)}
              placeholder={
                kind === 'statement'
                  ? t('studentId')
                  : kind === 'exam_attendance' || kind === 'exam_seating'
                    ? t('examIds')
                    : t('docId')
              }
            />
          )}
          {kind === 'timetable' && (
            <select
              value={viewMode}
              onChange={event => setViewMode(event.target.value as typeof viewMode)}
              className="rounded border p-2"
            >
              <option value="class">{t('optViewClass')}</option>
              <option value="teacher">{t('optViewTeacher')}</option>
              <option value="room">{t('optViewRoom')}</option>
            </select>
          )}
          <Button
            type="button"
            disabled={kind !== 'leadership_report' && !sourceId.trim()}
            onClick={preview}
          >
            {t('previewDraftBtn')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{t('previewNote')}</p>
      </div>

      {message && <p role="status" className="text-sm font-medium">{message}</p>}
    </div>
  );
}
