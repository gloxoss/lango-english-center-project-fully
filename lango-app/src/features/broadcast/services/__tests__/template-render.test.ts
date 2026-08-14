import { describe, expect, it } from 'vitest';
import { extractVariables, renderTemplate, sanitizeHtml } from '../template-render';

describe('Template engine ({{variable}} allowlist + HTML sanitizer)', () => {
  it('extracts declared variables', () => {
    expect(extractVariables('Hi {{name}}, balance {{account.balance}}')).toEqual(['name', 'account.balance']);
    expect(extractVariables('no vars here')).toEqual([]);
  });

  it('renders with supplied values', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'Aya' })).toBe('Hello Aya!');
    expect(renderTemplate('{{a}}-{{b}}', { a: 1, b: 2 })).toBe('1-2');
  });

  it('throws on a missing or null variable (no silent empty)', () => {
    expect(() => renderTemplate('Hi {{name}}', {})).toThrow(/manquante/);
    expect(() => renderTemplate('{{a}}', { a: null })).toThrow(/manquante/);
  });

  it('throws on an undeclared variable when an allowlist is enforced', () => {
    expect(() => renderTemplate('{{name}}', { name: 'Aya' }, ['fullName'])).toThrow(/non autorisée/);
    expect(() => renderTemplate('{{name}}', { name: 'Aya' }, ['name'])).not.toThrow();
  });

  it('sanitizes script tags, event handlers and javascript:/data: URLs', () => {
    const dirty = [
      '<p>ok</p><script>alert(1)</script>',
      '<a onclick="steal()" href="/x">y</a>',
      '<a href="javascript:alert(1)">y</a>',
      '<img src="data:text/html;base64,PHNjcmlwdD4=" />',
    ].join('');
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('data:text/html');
    expect(clean).toContain('<p>ok</p>');
  });
});
