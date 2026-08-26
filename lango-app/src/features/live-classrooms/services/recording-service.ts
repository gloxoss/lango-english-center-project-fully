// Recordings & classroom resources.
//
// Recordings are provider evidence (listRecordings) synced into SchoolOS as an
// immutable-ish, tenant-scoped projection. Deletion is provider-agnostic:
// the provider is asked to remove the remote recording, then the SchoolOS row is
// marked `deleted` (the audit/report record survives, per spec). Retention is
// policy-controlled and persisted as an expiry timestamp; a periodic job may
// later mark expired rows.
//
// Classroom materials are stable references into the Attachments Book addon via
// digitalAssetUsageLinks(usageType='live_class', usageRefId=<sessionId>). The
// same links are created by the content usage-links API when both addons are
// enabled; these helpers are the session-side read/attach/detach surface.
import { and, eq, inArray } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import type { RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import {
  digitalAssets, digitalAssetUsageLinks,
} from '@/features/attachments/models/attachments-schema';
import {
  liveClassProviderProfiles, liveClassRecordings, liveClassSessions,
} from '@/models/Schema';
import {
  getProviderOrThrow, isProviderFailure, type ProviderConfig,
  type ProviderRecording,
} from '@/features/live-classrooms/providers';
import { recordAudit } from '@/libs/api/audit';
import { loadSession } from './session-service';

export type RecordingRow = typeof liveClassRecordings.$inferSelect;

async function resolveProfile(
  tenantId: string,
  sessionId: string,
): Promise<{ session: typeof liveClassSessions.$inferSelect; profile: typeof liveClassProviderProfiles.$inferSelect }> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  if (!session.providerMeetingId) {
    throw new ApiError(409, 'SESSION_NO_ROOM', 'Cette session n\'a pas encore de salle fournisseur.');
  }
  const [profile] = await db.select().from(liveClassProviderProfiles)
    .where(and(eq(liveClassProviderProfiles.id, session.providerProfileId), eq(liveClassProviderProfiles.tenantId, tenantId)))
    .limit(1);
  if (!profile) throw new ApiError(422, 'INVALID_REFERENCE', 'Le profil fournisseur de cette session est introuvable.');
  return { session, profile };
}

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------

export async function syncSessionRecordings(ctx: RequestContext, tenantId: string, sessionId: string): Promise<RecordingRow[]> {
  const { session, profile } = await resolveProfile(tenantId, sessionId);
  const provider = getProviderOrThrow(profile.providerType);
  const config: ProviderConfig = { baseUrl: profile.baseUrl, accountId: profile.accountId };

  const recordings = await provider.listRecordings(session.providerMeetingId!, config);
  if (isProviderFailure(recordings)) {
    throw new ApiError(502, 'PROVIDER_FAILURE', recordings.error ?? 'Le fournisseur n\'a pas répondu.');
  }

  const now = new Date().toISOString();
  for (const r of recordings) {
    if (!r.providerRecordingId) continue;
    await db.insert(liveClassRecordings)
      .values({
        tenantId,
        sessionId,
        providerRecordingId: r.providerRecordingId,
        state: r.state,
        playbackUrl: r.playbackUrl ?? null,
        downloadUrl: r.downloadUrl ?? null,
        durationSeconds: r.durationSeconds ?? null,
        sizeBytes: r.sizeBytes ?? null,
        createdBy: ctx.userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [liveClassRecordings.tenantId, liveClassRecordings.providerRecordingId],
        set: {
          state: r.state,
          playbackUrl: r.playbackUrl ?? null,
          downloadUrl: r.downloadUrl ?? null,
          durationSeconds: r.durationSeconds ?? null,
          sizeBytes: r.sizeBytes ?? null,
          updatedAt: now,
        },
      });
  }

  recordAudit(ctx, 'update', 'live_class_session', sessionId, {
    action: 'sync_recordings', count: recordings.length,
  });
  return listSessionRecordings(tenantId, sessionId);
}

export async function listSessionRecordings(tenantId: string, sessionId: string): Promise<RecordingRow[]> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  return db.select().from(liveClassRecordings)
    .where(and(eq(liveClassRecordings.tenantId, tenantId), eq(liveClassRecordings.sessionId, sessionId)))
    .orderBy(liveClassRecordings.createdAt);
}

export async function deleteRecording(
  ctx: RequestContext,
  tenantId: string,
  sessionId: string,
  recordingId: string,
): Promise<RecordingRow> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

  const [recording] = await db.select().from(liveClassRecordings)
    .where(and(
      eq(liveClassRecordings.id, recordingId),
      eq(liveClassRecordings.tenantId, tenantId),
      eq(liveClassRecordings.sessionId, sessionId),
    )).limit(1);
  if (!recording) throw new ApiError(404, 'NOT_FOUND', 'Enregistrement introuvable.');

  if (recording.providerRecordingId) {
    const { profile } = await resolveProfile(tenantId, sessionId);
    const provider = getProviderOrThrow(profile.providerType);
    const config: ProviderConfig = { baseUrl: profile.baseUrl, accountId: profile.accountId };
    const result = await provider.deleteRecording(recording.providerRecordingId, config);
    if (isProviderFailure(result)) {
      throw new ApiError(502, 'PROVIDER_FAILURE', result.error ?? 'Le fournisseur n\'a pas pu supprimer l\'enregistrement.');
    }
  }

  const now = new Date().toISOString();
  const [updated] = await db.update(liveClassRecordings)
    .set({ state: 'deleted', playbackUrl: null, downloadUrl: null, updatedAt: now })
    .where(and(
      eq(liveClassRecordings.id, recordingId),
      eq(liveClassRecordings.tenantId, tenantId),
    ))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Enregistrement introuvable.');

  recordAudit(ctx, 'delete', 'live_class_recording', recordingId, {
    sessionId, providerRecordingId: recording.providerRecordingId,
  });
  return updated;
}

export async function setRecordingRetention(
  ctx: RequestContext,
  tenantId: string,
  sessionId: string,
  recordingId: string,
  retentionDays: number | null,
): Promise<RecordingRow> {
  const [recording] = await db.select().from(liveClassRecordings)
    .where(and(
      eq(liveClassRecordings.id, recordingId),
      eq(liveClassRecordings.tenantId, tenantId),
      eq(liveClassRecordings.sessionId, sessionId),
    )).limit(1);
  if (!recording) throw new ApiError(404, 'NOT_FOUND', 'Enregistrement introuvable.');

  const expiresAt = retentionDays && retentionDays > 0
    ? new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const [updated] = await db.update(liveClassRecordings)
    .set({ retentionDays, expiresAt, updatedAt: new Date().toISOString() })
    .where(and(eq(liveClassRecordings.id, recordingId), eq(liveClassRecordings.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Enregistrement introuvable.');

  recordAudit(ctx, 'update', 'live_class_recording', recordingId, { retentionDays });
  return updated;
}

// ---------------------------------------------------------------------------
// Classroom materials (Attachments Book usage links)
// ---------------------------------------------------------------------------

export type MaterialRow = {
  id: string;
  assetId: string;
  title: string;
  status: string;
  downloadable: boolean;
  usageRefId: string;
  createdAt: string;
};

export async function listSessionMaterials(tenantId: string, sessionId: string): Promise<MaterialRow[]> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

  const rows = await db
    .select({
      id: digitalAssetUsageLinks.id,
      assetId: digitalAssets.id,
      title: digitalAssets.title,
      status: digitalAssets.status,
      downloadable: digitalAssets.downloadable,
      usageRefId: digitalAssetUsageLinks.usageRefId,
      createdAt: digitalAssetUsageLinks.createdAt,
    })
    .from(digitalAssetUsageLinks)
    .innerJoin(digitalAssets, eq(digitalAssetUsageLinks.assetId, digitalAssets.id))
    .where(and(
      eq(digitalAssetUsageLinks.usageType, 'live_class'),
      eq(digitalAssetUsageLinks.usageRefId, sessionId),
      eq(digitalAssets.tenantId, tenantId),
    ))
    .orderBy(digitalAssetUsageLinks.createdAt);

  return rows as MaterialRow[];
}

export async function attachMaterial(
  ctx: RequestContext,
  tenantId: string,
  sessionId: string,
  assetId: string,
): Promise<MaterialRow> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

  const [asset] = await db.select().from(digitalAssets)
    .where(and(eq(digitalAssets.id, assetId), eq(digitalAssets.tenantId, tenantId))).limit(1);
  if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
  if (asset.status !== 'published') {
    throw new ApiError(422, 'NOT_PUBLISHED', 'Seule une ressource publiée peut être liée à une classe virtuelle.');
  }

  const [existing] = await db.select({ id: digitalAssetUsageLinks.id }).from(digitalAssetUsageLinks)
    .where(and(
      eq(digitalAssetUsageLinks.usageType, 'live_class'),
      eq(digitalAssetUsageLinks.usageRefId, sessionId),
      eq(digitalAssetUsageLinks.assetId, assetId),
    )).limit(1);
  if (existing) throw new ApiError(409, 'ALREADY_LINKED', 'Cette ressource est déjà liée à la classe virtuelle.');

  const [created] = await db.insert(digitalAssetUsageLinks)
    .values({ assetId, usageType: 'live_class', usageRefId: sessionId }).returning();
  if (!created) throw new ApiError(500, 'INTERNAL', 'Impossible de créer le lien.');

  recordAudit(ctx, 'create', 'digital_asset_usage_link', created.id, {
    usageType: 'live_class', usageRefId: sessionId,
  });

  return {
    id: created.id,
    assetId,
    title: asset.title,
    status: asset.status,
    downloadable: asset.downloadable,
    usageRefId: sessionId,
    createdAt: created.createdAt,
  };
}

export async function detachMaterial(
  ctx: RequestContext,
  tenantId: string,
  sessionId: string,
  assetId: string,
): Promise<{ removed: boolean }> {
  const session = await loadSession(tenantId, sessionId);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

  const [asset] = await db.select({ id: digitalAssets.id }).from(digitalAssets)
    .where(and(eq(digitalAssets.id, assetId), eq(digitalAssets.tenantId, tenantId))).limit(1);
  if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');

  await db.delete(digitalAssetUsageLinks).where(and(
    eq(digitalAssetUsageLinks.usageType, 'live_class'),
    eq(digitalAssetUsageLinks.usageRefId, sessionId),
    eq(digitalAssetUsageLinks.assetId, assetId),
  ));

  recordAudit(ctx, 'delete', 'digital_asset_usage_link', assetId, {
    usageType: 'live_class', usageRefId: sessionId,
  });
  return { removed: true };
}
