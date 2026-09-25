'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import type { PreviewRequest } from '../contracts';
import { PDF_PREVIEW_MESSAGES } from './pdf-preview-messages';

function PreviewDialog({ input, locale, onClose }: { input: PreviewRequest; locale: string; onClose: () => void }) {
  const t = useTranslations('PdfPreview');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [currentStatus, setCurrentStatus] = useState('');
  const blobRef = useRef<Blob | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const titles: Record<PreviewRequest['kind'], string> = {
    invoice: t('invoice'),
    receipt: t('receipt'),
    statement: t('statement'),
    student_profile: t('student_profile'),
    leadership_report: t('leadership_report'),
    exam_seating: t('exam_seating'),
    exam_attendance: t('exam_attendance'),
    timetable: t('timetable'),
  };
  const title = titles[input.kind];

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    async function load() {
      try {
        const response = await fetch('/api/documents/previews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message || t('unavailable', { status: response.status }));
        }
        setCurrentStatus(response.headers.get('X-Document-Current-Status') ?? '');
        const blob = await response.blob();
        if (blob.type !== 'application/pdf') throw new Error(t('invalidResponse'));
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t('genericUnavailable'));
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [input, t]);

  function download() {
    if (!blobRef.current) return;
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blobRef.current);
    link.href = objectUrl;
    link.download = `${input.kind}-${input.sourceId.replace(/[^\w-]/g, '_')}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  function print() {
    if (!url) return;
    const viewer = frameRef.current?.contentWindow;
    if (viewer) viewer.print();
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} PDF`}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/70 p-3 sm:p-6"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-t-xl bg-white px-4 py-3 shadow-lg">
        <strong className="text-sm text-slate-900">{title} · PDF{currentStatus ? ` · ${currentStatus}` : ''}</strong>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={download}
            disabled={!url}
            className="rounded-lg bg-[#2487B8] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t('download')}
          </button>
          <button
            type="button"
            onClick={print}
            disabled={!url}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {t('print')}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            {t('close')}
          </button>
        </div>
      </div>
      <div className="mx-auto min-h-0 w-full max-w-6xl flex-1 rounded-b-xl bg-white p-2 text-center text-sm text-slate-600">
        {busy ? (
          <p className="p-8">{t('creatingPdf')}</p>
        ) : error ? (
          <p role="alert" className="p-8 text-red-700">{error}</p>
        ) : url ? (
          <iframe ref={frameRef} src={url} title={`${title} PDF`} className="h-full w-full border-0" />
        ) : null}
      </div>
    </div>
  );
}

export function openDocumentPreview(input: PreviewRequest, locale = 'fr') {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const root = createRoot(mount);
  const close = () => {
    root.unmount();
    mount.remove();
  };
  const activeLocale = locale in PDF_PREVIEW_MESSAGES ? locale : 'fr';
  const messages = {
    PdfPreview: PDF_PREVIEW_MESSAGES[activeLocale as keyof typeof PDF_PREVIEW_MESSAGES],
  };

  root.render(
    <NextIntlClientProvider locale={activeLocale} messages={messages}>
      <PreviewDialog input={input} locale={activeLocale} onClose={close} />
    </NextIntlClientProvider>
  );
}
