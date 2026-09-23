import { describe, it, expect } from 'vitest';
import { validateTemplateFields } from '../validators';
import type { DocumentTemplateSchema, FieldAllowlist } from '../types';

describe('validateTemplateFields', () => {
  const allowlist: FieldAllowlist = {
    allowedFields: ['photo', 'firstName', 'lastName', 'matricule', 'qrCode'],
  };

  it('handles 2D array schemas without flagging array index 0 as unauthorized', () => {
    const template = {
      basePdf: { width: 100, height: 100, padding: [0, 0, 0, 0] },
      schemas: [
        [
          { name: 'photo', type: 'image', position: { x: 0, y: 0 }, width: 50, height: 50 },
          { name: 'firstName', type: 'text', position: { x: 0, y: 50 }, width: 50, height: 20 },
        ],
      ],
    } as unknown as DocumentTemplateSchema;

    const violations = validateTemplateFields(template, allowlist);
    expect(violations).toEqual([]);
    expect(violations).not.toContain('0');
  });

  it('flags unauthorized field names correctly', () => {
    const template = {
      basePdf: { width: 100, height: 100, padding: [0, 0, 0, 0] },
      schemas: [
        [
          { name: 'photo', type: 'image', position: { x: 0, y: 0 }, width: 50, height: 50 },
          { name: 'unauthorizedCustomField', type: 'text', position: { x: 0, y: 50 }, width: 50, height: 20 },
        ],
      ],
    } as unknown as DocumentTemplateSchema;

    const violations = validateTemplateFields(template, allowlist);
    expect(violations).toEqual(['unauthorizedCustomField']);
  });

  it('handles legacy object-based schemas', () => {
    const template = {
      basePdf: { width: 100, height: 100, padding: [0, 0, 0, 0] },
      schemas: [
        {
          photo: { type: 'image' },
          badField: { type: 'text' },
        },
      ],
    } as unknown as DocumentTemplateSchema;

    const violations = validateTemplateFields(template, allowlist);
    expect(violations).toEqual(['badField']);
  });
});
