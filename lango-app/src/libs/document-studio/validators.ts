import { DocumentTemplateSchema, FieldAllowlist } from './types';

/**
 * Validates a template against an allowed list of fields.
 * Returns an array of field names that are present in the template but not allowed.
 */
export function validateTemplateFields(
  template: DocumentTemplateSchema,
  allowlist: FieldAllowlist
): string[] {
  const allowed = new Set(allowlist.allowedFields);
  const violations = new Set<string>();

  for (const schemaObject of template.schemas) {
    for (const fieldName of Object.keys(schemaObject)) {
      if (!allowed.has(fieldName)) {
        violations.add(fieldName);
      }
    }
  }

  return Array.from(violations);
}
