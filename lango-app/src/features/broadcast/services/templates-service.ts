import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { communicationTemplateVersions, communicationTemplates } from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import { extractVariables, renderTemplate, sanitizeHtml } from './template-render';
import type { broadcastChannel } from '../models/broadcast-schema';

type Channel = (typeof broadcastChannel.enumValues)[number];

export type TemplateVersionInput = {
  subject?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  variableSchema?: { name: string }[];
  locale?: string;
};

export function templatePublic(t: typeof communicationTemplates.$inferSelect) {
  return { id: t.id, name: t.name, channel: t.channel, category: t.category, isActive: t.isActive, createdAt: t.createdAt, updatedAt: t.updatedAt };
}

function versionPublic(v: typeof communicationTemplateVersions.$inferSelect) {
  return {
    id: v.id,
    version: v.version,
    subject: v.subject,
    bodyText: v.bodyText,
    bodyHtml: v.bodyHtml,
    variableSchema: v.variableSchema,
    locale: v.locale,
    status: v.status,
    providerApprovalStatus: v.providerApprovalStatus,
    createdAt: v.createdAt,
  };
}

export async function listTemplates(tenantId: string, channel?: string) {
  const conditions: any[] = [eq(communicationTemplates.tenantId, tenantId)];
  if (channel) conditions.push(eq(communicationTemplates.channel, channel as any));
  const rows = await db
    .select()
    .from(communicationTemplates)
    .where(and(...conditions))
    .orderBy(desc(communicationTemplates.updatedAt));
  const out = [];
  for (const t of rows) {
    const [latest] = await db
      .select()
      .from(communicationTemplateVersions)
      .where(and(
        eq(communicationTemplateVersions.tenantId, tenantId),
        eq(communicationTemplateVersions.templateId, t.id),
      ))
      .orderBy(desc(communicationTemplateVersions.version))
      .limit(1);
    out.push({ ...templatePublic(t), latestVersion: latest ? versionPublic(latest) : null });
  }
  return out;
}

export async function getTemplate(tenantId: string, id: string) {
  const [t] = await db
    .select()
    .from(communicationTemplates)
    .where(and(eq(communicationTemplates.id, id), eq(communicationTemplates.tenantId, tenantId)))
    .limit(1);
  if (!t) throw new ApiError(404, 'NOT_FOUND', 'Modèle introuvable.');
  return t;
}

export async function createTemplate(
  tenantId: string,
  body: { name: string; channel: Channel; category?: string; initial: TemplateVersionInput },
  actorId: string | null,
) {
  const [inserted] = await db
    .insert(communicationTemplates)
    .values({ tenantId, name: body.name, channel: body.channel as any, category: body.category ?? 'general', createdBy: actorId })
    .returning();
  if (!inserted) throw new ApiError(500, 'INTERNAL', 'Création du modèle impossible.');
  const v = await addTemplateVersion(tenantId, inserted.id, body.initial, actorId);
  return { template: templatePublic(inserted), version: versionPublic(v) };
}

export async function addTemplateVersion(tenantId: string, templateId: string, body: TemplateVersionInput, actorId: string | null) {
  const t = await getTemplate(tenantId, templateId);
  if (t.tenantId !== tenantId) throw new ApiError(404, 'NOT_FOUND', 'Modèle introuvable.');
  const [maxRow] = await db
    .select({ v: communicationTemplateVersions.version })
    .from(communicationTemplateVersions)
    .where(and(
      eq(communicationTemplateVersions.tenantId, tenantId),
      eq(communicationTemplateVersions.templateId, templateId),
    ))
    .orderBy(desc(communicationTemplateVersions.version))
    .limit(1);
  const nextVersion = (maxRow?.v ?? 0) + 1;
  const [inserted] = await db
    .insert(communicationTemplateVersions)
    .values({
      tenantId,
      templateId,
      version: nextVersion,
      subject: body.subject ?? null,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml ? sanitizeHtml(body.bodyHtml) : null,
      variableSchema: body.variableSchema ?? extractVariables(body.bodyText).map((n) => ({ name: n })),
      locale: body.locale ?? 'fr',
      createdBy: actorId,
    })
    .returning();
  if (!inserted) throw new ApiError(500, 'INTERNAL', 'Création de la version impossible.');
  return inserted;
}

/** Publish a draft version — immutable thereafter. Only one published version per template. */
export async function publishTemplateVersion(tenantId: string, templateId: string, versionId: string) {
  const [v] = await db
    .select()
    .from(communicationTemplateVersions)
    .where(and(
      eq(communicationTemplateVersions.id, versionId),
      eq(communicationTemplateVersions.tenantId, tenantId),
      eq(communicationTemplateVersions.templateId, templateId),
    ))
    .limit(1);
  if (!v) throw new ApiError(404, 'NOT_FOUND', 'Version introuvable.');
  if (v.status === 'published') throw new ApiError(422, 'ALREADY_PUBLISHED', 'Cette version est déjà publiée.');
  await db.transaction(async (tx) => {
    await tx
      .update(communicationTemplateVersions)
      .set({ status: 'draft' })
      .where(and(
        eq(communicationTemplateVersions.tenantId, tenantId),
        eq(communicationTemplateVersions.templateId, templateId),
        eq(communicationTemplateVersions.status, 'published'),
      ));
    await tx
      .update(communicationTemplateVersions)
      .set({ status: 'published' })
      .where(eq(communicationTemplateVersions.id, versionId));
    await tx
      .update(communicationTemplates)
      .set({ isActive: true, updatedAt: new Date().toISOString() })
      .where(and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.tenantId, tenantId)));
  });
  const [published] = await db
    .select()
    .from(communicationTemplateVersions)
    .where(eq(communicationTemplateVersions.id, versionId))
    .limit(1);
  if (!published) throw new ApiError(500, 'INTERNAL', 'Publication impossible.');
  return published;
}

export async function getPublishedVersion(tenantId: string, templateId: string) {
  const [v] = await db
    .select()
    .from(communicationTemplateVersions)
    .where(and(
      eq(communicationTemplateVersions.tenantId, tenantId),
      eq(communicationTemplateVersions.templateId, templateId),
      eq(communicationTemplateVersions.status, 'published'),
    ))
    .orderBy(desc(communicationTemplateVersions.version))
    .limit(1);
  return v ?? null;
}

export async function listTemplateVersions(tenantId: string, templateId: string) {
  await getTemplate(tenantId, templateId);
  const rows = await db
    .select()
    .from(communicationTemplateVersions)
    .where(and(
      eq(communicationTemplateVersions.tenantId, tenantId),
      eq(communicationTemplateVersions.templateId, templateId),
    ))
    .orderBy(desc(communicationTemplateVersions.version));
  return rows.map(versionPublic);
}

export async function deleteTemplate(tenantId: string, templateId: string) {
  const [deleted] = await db
    .delete(communicationTemplates)
    .where(and(eq(communicationTemplates.id, templateId), eq(communicationTemplates.tenantId, tenantId)))
    .returning({ id: communicationTemplates.id });
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Modèle introuvable.');
}

export function renderVersion(v: { bodyText: string; subject?: string | null; variableSchema?: unknown }, values: Record<string, string>) {
  const allowlist = Array.isArray(v.variableSchema) ? (v.variableSchema as { name: string }[]).map((x) => x.name) : undefined;
  const bodyText = renderTemplate(v.bodyText, values, allowlist);
  const subject = v.subject ? renderTemplate(v.subject, values, allowlist) : undefined;
  return { bodyText, subject };
}
