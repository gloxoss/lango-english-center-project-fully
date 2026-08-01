import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, type PermissionKey } from './permissions';

const ALL_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

describe('Permissions system', () => {
  it('PERMISSIONS has no empty labels', () => {
    for (const [key, label] of Object.entries(PERMISSIONS)) {
      expect(label.length, `Permission ${key} has empty label`).toBeGreaterThan(0);
    }
  });

  it('permission keys follow module.action pattern', () => {
    for (const key of ALL_KEYS) {
      expect(key).toMatch(/^[a-z]+\.[a-z]+(\.[a-z]+)?$/);
    }
  });

  it('every role has at least one permission', () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      expect(perms.length, `Role ${role} has no permissions`).toBeGreaterThan(0);
    }
  });

  it('super_admin has all permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.super_admin.length).toBe(ALL_KEYS.length);
    for (const key of ALL_KEYS) {
      expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toContain(key);
    }
  });

  it('school_admin has all permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.school_admin.length).toBe(ALL_KEYS.length);
  });

  it('teacher can read students but not delete them', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.teacher).toContain('students.read');
    expect(DEFAULT_ROLE_PERMISSIONS.teacher).not.toContain('students.delete');
  });

  it('student cannot manage anything', () => {
    const studentPerms = DEFAULT_ROLE_PERMISSIONS.student;
    const managePerms = studentPerms.filter(p => p.includes('.manage') || p.includes('.create') || p.includes('.delete'));
    expect(managePerms.length).toBe(0);
  });

  it('guard has minimal permissions', () => {
    const guardPerms = DEFAULT_ROLE_PERMISSIONS.guard;
    expect(guardPerms.length).toBeLessThanOrEqual(5);
    expect(guardPerms).toContain('students.read');
    expect(guardPerms).toContain('attendance.read');
  });

  it('accountant can read and manage finance', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.accountant).toContain('finance.read');
    expect(DEFAULT_ROLE_PERMISSIONS.accountant).toContain('finance.manage');
  });

  it('parent has read-only access to child data', () => {
    const parentPerms = DEFAULT_ROLE_PERMISSIONS.parent;
    expect(parentPerms).toContain('students.read');
    expect(parentPerms).toContain('attendance.read');
    expect(parentPerms).toContain('grading.read');
    expect(parentPerms).toContain('finance.read');
    // Parent should not be able to manage student records.
    expect(parentPerms).not.toContain('students.create');
    expect(parentPerms).not.toContain('students.update');
  });

  it('every role permission is a valid key', () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const perm of perms) {
        expect(ALL_KEYS, `Permission ${perm} in ${role} is not in PERMISSIONS`).toContain(perm);
      }
    }
  });

  it('no duplicate permissions per role', () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const unique = new Set(perms);
      expect(unique.size, `Role ${role} has duplicate permissions`).toBe(perms.length);
    }
  });
});
