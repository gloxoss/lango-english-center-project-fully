import type { CSSProperties } from 'react';
import type { ColumnDefinition } from '../../types/reporting-types';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { container, text } from '@takumi-rs/helpers';
import { PdfRenderer } from 'takumi-pdf';

/**
 * Report exports as vector PDF, rendered by takumi-pdf (Rust/WASM).
 *
 * Replaces a pdfkit implementation that drew the table by hand with manual column
 * maths. Three things were wrong with it beyond the layout:
 *
 *   1. It used the base-14 `Helvetica` font, which is WinAnsi-encoded and cannot
 *      represent Arabic at all. Any report carrying an Arabic student, subject or
 *      school name came out blank or mangled — in a Moroccan school system.
 *   2. `generatedBy` was accepted and then never used, so the attribution the
 *      caller passed was silently dropped.
 *   3. `ColumnDefinition.align` was ignored, so numeric columns left-aligned.
 *
 * Fonts embed as subsets, so output stays selectable and searchable rather than
 * becoming an image.
 */

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

// Right-aligned by default: a column of money or marks is read down its units
// digit, and left-aligning it makes totals impossible to scan.
const NUMERIC_TYPES = new Set<ColumnDefinition['type']>(['number', 'currency', 'percentage']);

function alignmentFor(column: ColumnDefinition): 'left' | 'center' | 'right' {
  return column.align ?? (NUMERIC_TYPES.has(column.type) ? 'right' : 'left');
}

const COLORS = {
  ink: '#16212b',
  body: '#334155',
  muted: '#64748b',
  rule: '#e2e8f0',
  headerBg: '#f8fafc',
};

type LoadedFonts = { latin: Buffer; arabic: Buffer };

/**
 * The WASM renderer and the font bytes, initialised once.
 *
 * Re-reading two font files and standing up a new WASM instance per request is
 * the expensive part; Takumi dedupes the fonts themselves across renders.
 */
let enginePromise: Promise<{ renderer: PdfRenderer; fonts: LoadedFonts }> | null = null;

async function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [latin, arabic] = await Promise.all([
        readFile(path.join(FONT_DIR, 'Roboto-Regular.ttf')),
        readFile(path.join(FONT_DIR, 'NotoSansArabic-Regular.ttf')),
      ]);

      return { renderer: new PdfRenderer(), fonts: { latin, arabic } };
    })().catch((error) => {
      // Never cache a failed init, or every later request inherits the failure.
      enginePromise = null;
      throw error;
    });
  }

  return enginePromise;
}

function cell(value: string, width: string, column: ColumnDefinition, bold = false) {
  return text(value, {
    fontSize: 8,
    width,
    color: bold ? COLORS.ink : COLORS.body,
    fontWeight: bold ? 700 : 400,
    textAlign: alignmentFor(column),
  });
}

export class PdfExporter {
  /**
   * Title, an attribution line, and a data table that flows across as many pages
   * as it needs. Landscape once the table is too wide to read in portrait.
   */
  static async generatePdfBuffer(
    title: string,
    columns: ColumnDefinition[],
    rows: Record<string, any>[],
    generatedBy: string,
  ): Promise<Buffer> {
    const { renderer, fonts } = await getEngine();

    const columnWidth = `${(100 / Math.max(columns.length, 1)).toFixed(4)}%`;

    const rowStyle = (header: boolean): CSSProperties => ({
      display: 'flex',
      flexDirection: 'row',
      gap: 8,
      paddingTop: header ? 6 : 5,
      paddingBottom: header ? 6 : 5,
      paddingLeft: 8,
      paddingRight: 8,
      ...(header ? { backgroundColor: COLORS.headerBg } : {}),
      borderBottomWidth: 1,
      borderBottomColor: COLORS.rule,
      borderBottomStyle: 'solid' as const,
    });

    const children = rows.length === 0
      ? [text('Aucune donnée pour ce rapport.', {
          fontSize: 10,
          color: COLORS.muted,
          textAlign: 'center',
          paddingTop: 24,
        })]
      : [
          container({
            style: rowStyle(true),
            children: columns.map(col => cell(col.label, columnWidth, col, true)),
          }),
          ...rows.map(row => container({
            style: rowStyle(false),
            children: columns.map(col => cell(String(row[col.key] ?? ''), columnWidth, col)),
          })),
        ];

    const doc = container({
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        backgroundColor: '#ffffff',
        fontFamily: 'Roboto',
      },
      children: [
        text(title, { fontSize: 16, fontWeight: 700, color: COLORS.ink, textAlign: 'center' }),
        text(
          `Généré le ${new Date().toLocaleString('fr-FR')} par ${generatedBy}`,
          { fontSize: 8, color: COLORS.muted, textAlign: 'center' },
        ),
        ...children,
      ],
    });

    const pdf = await renderer.render(doc, {
      size: 'a4',
      // Wide tables are unreadable in portrait. The pdfkit version made the same
      // call at the same threshold, and it is worth keeping.
      landscape: columns.length > 5,
      margin: 40,
      fonts: [
        { name: 'Roboto', weight: 400, data: fonts.latin },
        { name: 'Noto Sans Arabic', weight: 400, data: fonts.arabic },
      ],
      // Arabic sits in the fallback chain so a mixed row renders both scripts.
      // Takumi shapes Arabic and applies bidi; pdfkit + Helvetica could do neither.
      fontFamilies: ['Roboto', 'Noto Sans Arabic', 'sans-serif'],
    });

    return Buffer.from(pdf);
  }
}
