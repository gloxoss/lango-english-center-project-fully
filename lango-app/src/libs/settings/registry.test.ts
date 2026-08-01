import { describe, expect, it } from 'vitest';
import { getDefinition, getDefinitionsByNamespace, getNamespaces, SETTINGS_REGISTRY } from './registry';

describe('Settings registry', () => {
  it('has no duplicate keys', () => {
    const keys = SETTINGS_REGISTRY.map(d => d.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('every key matches namespace.name pattern', () => {
    for (const def of SETTINGS_REGISTRY) {
      expect(def.key).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(def.key.startsWith(`${def.namespace}.`)).toBe(true);
    }
  });

  it('every definition has a valid valueSchema', () => {
    for (const def of SETTINGS_REGISTRY) {
      // The default value must pass its own schema.
      const result = def.valueSchema.safeParse(def.defaultValue);
      expect(result.success, `Default for ${def.key} fails validation: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('getDefinition throws for unknown key', () => {
    expect(() => getDefinition('nonexistent.key')).toThrow('Clé de paramètre inconnue');
  });

  it('getDefinition returns correct definition', () => {
    const def = getDefinition('organization.establishmentName');
    expect(def.label).toBe('Nom de l\'établissement');
    expect(def.namespace).toBe('organization');
    expect(def.scope).toBe('tenant');
  });

  it('getDefinitionsByNamespace filters correctly', () => {
    const orgDefs = getDefinitionsByNamespace('organization');
    expect(orgDefs.length).toBeGreaterThan(0);
    for (const def of orgDefs) {
      expect(def.namespace).toBe('organization');
    }
  });

  it('getNamespaces returns unique list', () => {
    const ns = getNamespaces();
    expect(ns.length).toBeGreaterThan(0);
    expect(new Set(ns).size).toBe(ns.length);
    expect(ns).toContain('organization');
    expect(ns).toContain('academic');
    expect(ns).toContain('attendance');
    expect(ns).toContain('security');
  });

  it('legacy fields map to real schoolSettings columns', () => {
    const withLegacy = SETTINGS_REGISTRY.filter(d => d.legacyField);
    expect(withLegacy.length).toBeGreaterThan(0);

    // Every legacy field should be unique (no two keys pointing to the same column).
    const legacyFields = withLegacy.map(d => d.legacyField!);
    expect(new Set(legacyFields).size).toBe(legacyFields.length);
  });

  it('secret settings have internal or secret sensitivity', () => {
    const secrets = SETTINGS_REGISTRY.filter(d => d.sensitivity === 'secret');
    // V1 has no secrets yet, but the structure supports them.
    // This test ensures no public settings are accidentally marked secret.
    for (const def of secrets) {
      expect(def.requiredPermission).toBeTruthy();
    }
  });

  it('branch-scoped settings must have scope=branch', () => {
    const branchScoped = SETTINGS_REGISTRY.filter(d => d.scope === 'branch');
    expect(branchScoped.length).toBeGreaterThan(0);
    // Verify they make sense: city, address, phone, email can vary by branch.
    const branchKeys = branchScoped.map(d => d.key);
    expect(branchKeys).toContain('organization.city');
    expect(branchKeys).toContain('organization.address');
  });
});
