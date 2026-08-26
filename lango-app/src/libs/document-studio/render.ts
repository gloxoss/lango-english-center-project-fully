import { ApiError } from '@/libs/api/errors';
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
  const t = template as { basePdf?: unknown; schemas?: unknown } | null;
  if (!t || !t.basePdf || !Array.isArray(t.schemas) || t.schemas.length === 0) {
    throw new ApiError(
      422,
      'INVALID_TEMPLATE',
      'Ce modèle n\'est pas un gabarit valide (basePdf/schemas manquants). Rouvrez-le dans le designer et republiez-le.',
    );
  }

  // pdfme expects schemas as a 2D array (pages -> schema rows). A flat/1D array
  // (legacy seed data) would reach generate() and throw a cryptic INTERNAL_ERROR.
  if (!t.schemas.every((page) => Array.isArray(page))) {
    throw new ApiError(
      422,
      'INVALID_TEMPLATE',
      'Ce modèle n\'est pas un gabarit valide (schemas invalides). Rouvrez-le dans le designer et republiez-le.',
    );
  }

  // Lazy-load pdfme: its generator + schema plugins pull in PDF.js/WASM and add
  // seconds to any module that imports this file. Deferring to render time keeps
  // route imports (cards/issue, certificates/issue) light.
  const [{ generate }, { text, image, barcodes }] = await Promise.all([
    import('@pdfme/generator'),
    import('@pdfme/schemas'),
  ]);

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
