import { describe, expect, it } from 'vitest';
import { parseSensitiveProfileChanges } from './profile-edit-requests';
describe('sensitive employee profile changes', () => {
  it('accepts only approved sensitive fields', () => {
    expect(parseSensitiveProfileChanges({ bankRib: 'MA123', cnssNumber: 'CNSS1' })).toEqual({ bankRib: 'MA123', cnssNumber: 'CNSS1' });
    expect(() => parseSensitiveProfileChanges({ salary: 999999 })).toThrow();
    expect(() => parseSensitiveProfileChanges({})).toThrow();
  });
});
