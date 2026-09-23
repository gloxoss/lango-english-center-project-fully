import { DocumentTemplateSchema, FieldAllowlist } from './types';

/**
 * Validates a template against an allowed list of fields.
 * Returns an array of field names that are present in the template but not allowed.
 */
export function validateTemplateFields(
  template: DocumentTemplateSchema,
  allowlist: FieldAllowlist
): string[] {
  if (!template?.schemas || !Array.isArray(template.schemas) || !allowlist?.allowedFields || allowlist.allowedFields.length === 0) {
    return [];
  }

  const allowed = new Set(allowlist.allowedFields);
  const violations = new Set<string>();

  for (const schemaPage of template.schemas) {
    if (Array.isArray(schemaPage)) {
      // Modern pdfme schemas (2D array: pages -> schema element items)
      for (const element of schemaPage) {
        if (element && typeof element === 'object') {
          const fieldName = (element as any).name;
          if (fieldName && !allowed.has(fieldName)) {
            violations.add(fieldName);
          }
        }
      }
    } else if (schemaPage && typeof schemaPage === 'object') {
      // Legacy pdfme schemas (array of objects: pages -> { [fieldName]: schema })
      for (const [key, value] of Object.entries(schemaPage)) {
        const fieldName = (value && typeof value === 'object' && (value as any).name) ? (value as any).name : key;
        if (fieldName && !allowed.has(fieldName)) {
          violations.add(fieldName);
        }
      }
    }
  }

  return Array.from(violations);
}
