import { Template as PdfmeTemplate, Schema as PdfmeSchema } from '@pdfme/common';

/**
 * Our wrapped template schema type.
 * A template is the blueprint for rendering documents (certificates, cards, etc.).
 * It is compatible with pdfme.
 */
export type DocumentTemplateSchema = PdfmeTemplate;

export type DocumentSchemaElement = PdfmeSchema;

/**
 * Validator configurations for allowed fields.
 */
export type FieldAllowlist = {
  allowedFields: string[];
};
