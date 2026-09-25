import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fromJsx } from '@takumi-rs/helpers/jsx';
import { PdfRenderer } from 'takumi-pdf';
import type { DocumentDesign, DocumentModel } from '../contracts';
import { PdfCell, PdfRow, PdfSection, PdfText } from '../pdfcn/primitives';

let enginePromise: Promise<{ renderer: PdfRenderer; latin: Buffer; arabic: Buffer }> | null = null;
async function engine() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      readFile(path.join(process.cwd(), 'public/fonts/Roboto-Regular.ttf')),
      readFile(path.join(process.cwd(), 'public/fonts/NotoSansArabic-Regular.ttf')),
    ]).then(([latin, arabic]) => ({ renderer: new PdfRenderer(), latin, arabic })).catch(error => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

export async function renderSchoolPdf(model: DocumentModel, design: DocumentDesign, draft = false): Promise<Buffer> {
  const { renderer, latin, arabic } = await engine();
  const accent = design.variant === 'minimal' ? '#334155' : design.accentColor;
  const label = (name: string) => design.labels[name] || name;
  const titleSize = design.fontScale === 'large' ? 21 : design.fontScale === 'compact' ? 16 : 18;
  const bodySize = design.fontScale === 'large' ? 11 : design.fontScale === 'compact' ? 8 : 9;
  const details = model.details.filter(item => item.value.trim());
  const widths = model.columns.map(() => `${(100 / Math.max(model.columns.length, 1)).toFixed(3)}%`);
  const sections = {
    identity: <PdfSection key="identity" gap={3} avoidBreak>
      {design.variant === 'moderne' && <div style={{ height: 7, backgroundColor: accent, marginBottom: 5 }} />}
      {design.showLogo && model.school.logo && <img src={model.school.logo} alt="" style={{ maxWidth: 110, maxHeight: 65, objectFit: 'contain' }} />}
      <PdfText size={12} color={accent} bold>{model.school.name}</PdfText>
      {design.optionalFields.includes('contact') && <PdfText size={8}>{[model.school.address, model.school.city, model.school.phone, model.school.email].filter(Boolean).join(' · ')}</PdfText>}
      {design.optionalFields.includes('legal') && model.school.legal && <PdfText size={7}>{model.school.legal}</PdfText>}
    </PdfSection>,
    details: <PdfSection key="details" gap={4} avoidBreak>
      <PdfText size={titleSize} color={accent} bold>{label('title') === 'title' ? model.title : label('title')}{draft ? ' · BROUILLON / DRAFT' : ''}</PdfText>
      <PdfText size={bodySize} bold>{model.reference}{model.status ? ` · ${model.status}` : ''}</PdfText>
      {details.map((item, index) => <PdfText key={`${item.label}-${index}`} size={bodySize}><strong>{label(item.label)}:</strong> {item.value}</PdfText>)}
    </PdfSection>,
    lines: <PdfSection key="lines" gap={0}>
      <PdfRow shaded>{model.columns.map((column, index) => <PdfCell key={column.key} width={widths[index]!} align={column.numeric ? 'right' : 'left'}><PdfText size={bodySize} bold>{label(column.label)}</PdfText></PdfCell>)}</PdfRow>
      {model.rows.length === 0
        ? <PdfText size={bodySize}>Aucune ligne.</PdfText>
        : model.rows.map((row, rowIndex) => <PdfRow key={rowIndex} shaded={rowIndex % 2 === 1}>{model.columns.map((column, index) => <PdfCell key={column.key} width={widths[index]!} align={column.numeric ? 'right' : 'left'}><PdfText size={bodySize}>{row[column.key] ?? ''}</PdfText></PdfCell>)}</PdfRow>)}
    </PdfSection>,
    totals: <PdfSection key="totals" gap={4} avoidBreak>{model.totals.map((item, index) => <div key={index} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: item.strong ? `2px solid ${accent}` : undefined, paddingBottom: 3 }}><PdfText size={bodySize} bold={item.strong}>{label(item.label)}</PdfText><PdfText size={item.strong ? bodySize + 2 : bodySize} bold={item.strong}>{item.value}</PdfText></div>)}</PdfSection>,
    footer: <PdfSection key="footer" gap={3} avoidBreak>
      {design.optionalFields.includes('note') && model.note && <PdfText size={bodySize}>{model.note}</PdfText>}
      {design.footerText && <PdfText size={7}>{design.footerText}</PdfText>}
      {(design.showStamp && model.school.stamp || design.showSignature && model.school.signature) && <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
        {design.showStamp && model.school.stamp && <img src={model.school.stamp} alt="" style={{ width: 100, maxHeight: 65, objectFit: 'contain' }} />}
        {design.showSignature && model.school.signature && <img src={model.school.signature} alt="" style={{ width: 100, maxHeight: 65, objectFit: 'contain' }} />}
      </div>}
    </PdfSection>,
  };
  const { node, css } = await fromJsx(<div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'Roboto', backgroundColor: '#ffffff' }}>
    {design.sectionOrder.map(name => sections[name])}
  </div>);
  const { node: footer } = await fromJsx(<div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Roboto', color: '#64748b', fontSize: 9 }}><span>{model.school.name}</span><span>Page <span className="pageNumber" /> / <span className="totalPages" /></span></div>);
  const bytes = await renderer.render(node, {
    size: design.pageSize,
    landscape: design.orientation === 'landscape',
    margin: design.pageSize === 'a5' ? 38 : 57,
    footer,
    css,
    fonts: [
      { name: 'Roboto', weight: 400, data: latin },
      { name: 'Noto Sans Arabic', weight: 400, data: arabic },
    ],
    fontFamilies: ['Roboto', 'Noto Sans Arabic', 'sans-serif'],
    metadata: { title: model.title },
  });
  return Buffer.from(bytes);
}
