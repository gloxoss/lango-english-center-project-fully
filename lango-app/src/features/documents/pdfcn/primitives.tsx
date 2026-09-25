import type { CSSProperties, ReactNode } from 'react';

// Adapted from pdfcn's MIT-licensed Takumi primitives:
// https://github.com/shadcn-labs/pdfcn/blob/main/apps/web/registry/bases/takumi/lib/pdf-primitives.tsx
// pdfcn uses points while Takumi lays out CSS pixels; keep the conversion at this boundary.
const pt = (value: number) => value * 96 / 72;

export function PdfText({ children, size = 10, color = '#334155', bold = false, align = 'left' }: {
  children: ReactNode; size?: number; color?: string; bold?: boolean; align?: CSSProperties['textAlign'];
}) {
  return <span style={{ fontSize: pt(size), color, fontWeight: bold ? 700 : 400, textAlign: align, lineHeight: 1.35 }}>{children}</span>;
}

export function PdfSection({ children, gap = 6, avoidBreak = false }: { children: ReactNode; gap?: number; avoidBreak?: boolean }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: pt(gap), breakInside: avoidBreak ? 'avoid' : undefined }}>{children}</div>;
}

export function PdfRow({ children, shaded = false }: { children: ReactNode; shaded?: boolean }) {
  return <div style={{ display: 'flex', flexDirection: 'row', gap: pt(5), padding: pt(5), borderBottom: '1px solid #e2e8f0', backgroundColor: shaded ? '#f8fafc' : '#ffffff', breakInside: 'avoid' }}>{children}</div>;
}

export function PdfCell({ children, width, align = 'left' }: { children: ReactNode; width: string; align?: CSSProperties['textAlign'] }) {
  return <div style={{ width, textAlign: align, minWidth: 0 }}>{children}</div>;
}
