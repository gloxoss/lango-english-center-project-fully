// Template engine for broadcast messages. Same `{{variable}}` convention as the
// existing smsTemplates — no new syntax. Variable schemas are a declared
// allowlist; rendering a template with an undeclared variable fails (no silent
// injection). Email HTML is sanitized: script tags, event-handler attributes and
// javascript:/data: URLs are stripped (conservative, no DOM dependency).

export const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function extractVariables(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(VARIABLE_RE)) {
    if (m[1] !== undefined) seen.add(m[1]);
  }
  return [...seen];
}

export function renderTemplate(
  text: string,
  values: Record<string, string | number | null | undefined>,
  allowlist?: string[],
): string {
  const vars = extractVariables(text);
  for (const v of vars) {
    if (allowlist && !allowlist.includes(v)) {
      throw new Error(`Variable inconnue « ${v} » non autorisée`);
    }
    if (values[v] === undefined || values[v] === null) {
      throw new Error(`Variable « ${v} » manquante`);
    }
  }
  return text.replace(VARIABLE_RE, (_, name) => String(values[name] ?? ''));
}

/** Conservative HTML sanitizer for template body_html. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:.*?"|'javascript:.*?'|javascript:[^\s>]+)/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*("data:.*?"|'data:.*?'|data:[^\s>]+)/gi, '$1="#"');
}
