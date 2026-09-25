export function escapeDocumentHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  })[character]!);
}

export function printDocument(options: { title: string; body: string; locale?: string }): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('The browser blocked the document window. Allow pop-ups and try again.');
  }

  const lang = options.locale === 'ar' ? 'ar' : options.locale === 'en' ? 'en' : 'fr';
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="${lang}" dir="${dir}"><head>
    <meta charset="utf-8"><title>${escapeDocumentHtml(options.title)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #16212b; font: 12px/1.5 Arial, sans-serif; }
      h1 { font-size: 22px; margin: 0 0 6px; }
      h2 { font-size: 14px; margin: 24px 0 8px; }
      p { margin: 4px 0; }
      header { border-bottom: 2px solid #2487b8; padding-bottom: 16px; margin-bottom: 22px; }
      .muted { color: #596779; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 20px 0; }
      .meta div { break-inside: avoid; }
      .meta strong { display: block; color: #596779; font-size: 10px; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { padding: 8px; border-bottom: 1px solid #dce3e9; text-align: start; vertical-align: top; }
      th { background: #f1f6f9; font-size: 10px; }
      .number { text-align: end; white-space: nowrap; }
      .totals { width: min(100%, 320px); margin-inline-start: auto; }
      .totals div { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; }
      .totals .grand { border-top: 2px solid #16212b; font-size: 15px; font-weight: bold; margin-top: 5px; }
      tr { break-inside: avoid; }
      @media screen { body { max-width: 210mm; min-height: 297mm; padding: 16mm; margin: 20px auto; box-shadow: 0 2px 16px #0002; } }
    </style></head><body>${options.body}</body></html>`);
  printWindow.document.close();
  void printWindow.document.fonts.ready.then(() => {
    printWindow.focus();
    printWindow.print();
  });
}
