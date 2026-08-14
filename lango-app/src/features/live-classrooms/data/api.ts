// API fetch helpers for the Live Classrooms add-on UI.
//
// All calls go through the server API which re-derives tenant/role from the
// session — the client never sends tenant or role. Responses follow the app
// convention { success: boolean, data?, error?: { code, message } }.

export type LiveSessionRow = {
  id: string;
  title: string;
  status: string;
  providerType: string | null;
  profileName: string | null;
  teacherName: string | null;
  className: string | null;
  sectionName: string | null;
  subjectName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  providerMeetingId: string | null;
  creatorUserId: string | null;
  createdAt: string;
};

export type ProviderProfileRow = {
  id: string;
  name: string;
  providerType: string;
  scope: string;
  baseUrl: string | null;
  accountId: string | null;
  capabilities: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorShape = { code: string; message: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({ success: false, error: { code: 'INVALID_RESPONSE', message: 'Réponse serveur invalide.' } }));
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message ?? `Erreur ${res.status}`);
  }
  return json.data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Erreur inconnue';
}

export function getSessions(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return request<{ rows: LiveSessionRow[]; total: number; page: number; pageSize: number }>(
    `/api/addons/live-classrooms/sessions${qs ? `?${qs}` : ''}`,
  );
}

export function getSessionDetail(id: string) {
  return request<{
    session: LiveSessionRow & { description: string | null; policy: Record<string, unknown>; teacherUserId: string };
    teacherName: string | null;
    profileName: string | null;
    providerType: string | null;
    className: string | null;
    sectionName: string | null;
    subjectName: string | null;
    invitations: Array<{ id: string; userId: string; participantRole: string; joinEligible: boolean; deliveryState: string; userName: string | null }>;
    events: Array<{ id: string; eventType: string; userId: string | null; externalParticipantId: string | null; providerTimestamp: string; participantRole: string | null }>;
  }>(`/api/addons/live-classrooms/sessions/${id}`);
}

export function createSession(body: Record<string, unknown>) {
  return request<unknown>('/api/addons/live-classrooms/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateSession(id: string, body: Record<string, unknown>) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function startSession(id: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}/start`, { method: 'POST' });
}

export function endSession(id: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}/end`, { method: 'POST' });
}

export function cancelSession(id: string, reason?: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export function joinSession(id: string) {
  return request<{ token: string; expiresAt: string; role: string; sessionId: string }>(
    `/api/addons/live-classrooms/sessions/${id}/join`,
    { method: 'POST' },
  );
}

export function redeemJoin(id: string, token: string) {
  return request<{ url: string; expiresAt: string; role: string; providerType: string }>(
    `/api/addons/live-classrooms/sessions/${id}/redeem-join`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) },
  );
}

export function syncSession(id: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}/sync`, { method: 'POST' });
}

export function getAttendance(id: string) {
  return request<Array<{
    id: string; userId: string; participantRole: string; firstJoinAt: string | null;
    lastLeaveAt: string | null; totalPresenceSeconds: number; reconnectCount: number;
    lateJoinSeconds: number; earlyLeaveSeconds: number; status: string;
    reconciliationState: string; reconciliationNote: string | null; userName: string | null;
  }>>(`/api/addons/live-classrooms/sessions/${id}/attendance`);
}

export function reconcileAttendance(id: string, body: { note?: string; manual?: Array<{ userId: string; status: string }> }) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}/reconcile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

export function postAttendance(id: string, note?: string) {
  return request<{ posted: number; skipped: number }>(`/api/addons/live-classrooms/sessions/${id}/post-attendance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note ?? null }),
  });
}

export function getRecordings(id: string) {
  return request<Array<{
    id: string; providerRecordingId: string | null; state: string; playbackUrl: string | null;
    downloadUrl: string | null; durationSeconds: number | null; expiresAt: string | null; retentionDays: number | null;
  }>>(`/api/addons/live-classrooms/sessions/${id}/recordings`);
}

export function syncRecordings(id: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}/recordings`, { method: 'POST' });
}

export function deleteRecording(sessionId: string, recordingId: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${sessionId}/recordings/${recordingId}`, { method: 'DELETE' });
}

export function getMaterials(id: string) {
  return request<Array<{ id: string; assetId: string; title: string; status: string; createdAt: string }>>(
    `/api/addons/live-classrooms/sessions/${id}/materials`,
  );
}

export function attachMaterial(id: string, assetId: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${id}/materials`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId }),
  });
}

export function detachMaterial(sessionId: string, assetId: string) {
  return request<unknown>(`/api/addons/live-classrooms/sessions/${sessionId}/materials/${assetId}`, { method: 'DELETE' });
}

export function getMySessions() {
  return request<Array<{
    id: string; title: string; status: string; className: string | null; sectionName: string | null;
    subjectName: string | null; teacherName: string | null; scheduledStart: string; scheduledEnd: string;
    providerType: string | null; canJoin: boolean;
  }>>('/api/addons/live-classrooms/my-sessions');
}

export function getReportOverview(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return request<{
    totalSessions: number; endedSessions: number; failedSessions: number; cancelledSessions: number;
    sessionsWithAttendance: number; presenceRate: number; readyRecordings: number;
    joinedEvents: number; invitedCount: number;
  }>(`/api/addons/live-classrooms/reports/overview${qs ? `?${qs}` : ''}`);
}

export function getProviderProfiles() {
  return request<ProviderProfileRow[]>('/api/addons/live-classrooms/provider-profiles');
}

export function createProviderProfile(body: Record<string, unknown>) {
  return request<unknown>('/api/addons/live-classrooms/provider-profiles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

export function updateProviderProfile(id: string, body: Record<string, unknown>) {
  return request<unknown>(`/api/addons/live-classrooms/provider-profiles/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

export function deleteProviderProfile(id: string) {
  return request<unknown>(`/api/addons/live-classrooms/provider-profiles/${id}`, { method: 'DELETE' });
}

export function testProviderProfile(id: string) {
  return request<{ ok: boolean; mode: string; latencyMs: number | null; error: string | null }>(
    `/api/addons/live-classrooms/provider-profiles/${id}/test`, { method: 'POST' },
  );
}
