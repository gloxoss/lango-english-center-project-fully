import { generate } from '@pdfme/generator';
import { text, image, barcodes } from '@pdfme/schemas';
import { DocumentTemplateSchema } from './types';
import { loadFonts } from './fonts';

export type RenderPdfOptions = {
  template: DocumentTemplateSchema;
  inputs: Record<string, string>[];
};

type BlankPdfShape = {
  width: number;
  height: number;
  padding?: [number, number, number, number];
};

// pdfme 6.x requires a `padding` tuple on a blank basePdf. Versions stored
// without it (hand-built templates, legacy drafts) must not blow up rendering.
function normalizeBasePdf(template: DocumentTemplateSchema): DocumentTemplateSchema {
  const { basePdf } = template;
  if (!basePdf || typeof basePdf !== 'object' || ArrayBuffer.isView(basePdf) || basePdf instanceof ArrayBuffer) {
    return template;
  }
  const blank = basePdf as BlankPdfShape;
  if (typeof blank.width !== 'number' || typeof blank.height !== 'number' || Array.isArray(blank.padding)) {
    return template;
  }
  return { ...template, basePdf: { ...blank, padding: [0, 0, 0, 0] } };
}

/**
 * Server-side function to render a PDF using pdfme.
 * It automatically injects the Arabic and default fonts.
 */
export async function renderPdf({ template, inputs }: RenderPdfOptions): Promise<Buffer> {
  const plugins = {
    text,
    image,
    qrcode: barcodes.qrcode,
    barcode: barcodes.code128,
  };

  const font = await loadFonts();

  const options = { font };

  const pdfUint8Array = await generate({ template: normalizeBasePdf(template), plugins, options, inputs });
  return Buffer.from(pdfUint8Array);
}
