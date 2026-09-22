import type {
  TeacherDetail,
  TeacherDirectoryItem,
  TeacherDirectoryQuery,
  TeacherFilterOptions,
  TeacherFormValues,
  TeacherListResponse,
  TeacherProvisioning,
  TeacherStatus,
} from '../model/types';

/** Uniform client result so views never treat a failed request as success. */
export type ApiResult<T>
  = | { ok: true; data: T }
    | { ok: false; status: number; code: string; message: string; dependencies?: { key: string; count: number }[] };

async function readError(res: Response): Promise<{ code: string; message: string; dependencies?: { key: string; count: number }[] }> {
  try {
    const json = await res.json();
    return {
      code: json?.error?.code ?? `HTTP_${res.status}`,
      message: json?.error?.message ?? json?.message ?? `Erreur ${res.status}`,
      dependencies: json?.dependencies,
    };
  } catch {
    return { code: `HTTP_${res.status}`, message: `Erreur ${res.status}` };
  }
}

function toQueryString(query: TeacherDirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status && query.status !== 'all') {
    params.set('status', query.status);
  }
  if (query.subjectId) {
    params.set('subjectId', query.subjectId);
  }
  if (query.classSectionId) {
    params.set('classSectionId', query.classSectionId);
  }
  if (query.branchId) {
    params.set('branchId', query.branchId);
  }
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params.toString();
}

export async function fetchTeachers(query: TeacherDirectoryQuery, signal?: AbortSignal): Promise<ApiResult<TeacherListResponse>> {
  const res = await fetch(`/api/teachers?${toQueryString(query)}`, { signal });
  if (!res.ok) {
    return { ok: false, status: res.status, ...(await readError(res)) };
  }
  const json = (await res.json()) as TeacherListResponse;
  return { ok: true, data: json };
}

export async function fetchTeacherDetail(id: string, signal?: AbortSignal): Promise<ApiResult<TeacherDetail>> {
  const res = await fetch(`/api/teachers?id=${encodeURIComponent(id)}`, { signal });
  if (!res.ok) {
    return { ok: false, status: res.status, ...(await readError(res)) };
  }
  const json = await res.json();
  return { ok: true, data: json.data as TeacherDetail };
}

export async function fetchTeacherFilterOptions(): Promise<ApiResult<TeacherFilterOptions>> {
  const res = await fetch('/api/teachers/options');
  if (!res.ok) {
    return { ok: false, status: res.status, ...(await readError(res)) };
  }
  const json = await res.json();
  return { ok: true, data: json.data as TeacherFilterOptions };
}

function buildWritePayload(values: TeacherFormValues) {
  return {
    fullName: values.fullName,
    email: values.email || undefined,
    phone: values.phone || undefined,
    employeeId: values.employeeId || undefined,
    specialization: values.specialization || undefined,
    cycle: values.cycle || undefined,
    hireDate: values.hireDate || undefined,
    dateOfBirth: values.dateOfBirth || undefined,
    gender: values.gender || undefined,
    nationalId: values.nationalId || undefined,
    address: values.address || undefined,
    city: values.city || undefined,
    qualification: values.qualification || undefined,
    salary: values.salary ? Number(values.salary) : undefined,
    branchId: values.branchId || undefined,
    documents: { contract: values.contract, cin: values.cin, diploma: values.diploma },
  };
}

export async function createTeacherRequest(
  values: TeacherFormValues,
): Promise<ApiResult<{ teacher: TeacherDirectoryItem; provisioning: TeacherProvisioning }>> {
  const res = await fetch('/api/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildWritePayload(values)),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, ...(await readError(res)) };
  }
  const json = await res.json();
  return { ok: true, data: { teacher: json.data, provisioning: json.provisioning } };
}

export async function updateTeacherRequest(
  id: string,
  values: TeacherFormValues,
): Promise<ApiResult<{ teacher: TeacherDirectoryItem }>> {
  const payload = buildWritePayload(values);
  const res = await fetch('/api/teachers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    // email and employeeId are immutable through the directory (identity fields).
    body: JSON.stringify({ id, ...payload, email: undefined, employeeId: undefined }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, ...(await readError(res)) };
  }
  const json = await res.json();
  return { ok: true, data: { teacher: json.data } };
}

export async function setTeacherStatusRequest(
  id: string,
  status: TeacherStatus,
): Promise<ApiResult<{ closedClassAssignments: number }>> {
  const res = await fetch('/api/teachers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, ...(await readError(res)) };
  }
  const json = await res.json();
  return { ok: true, data: { closedClassAssignments: json.statusChange?.closedClassAssignments ?? 0 } };
}

export async function deleteTeacherRequest(id: string): Promise<ApiResult<{ id: string }>> {
  const res = await fetch(`/api/teachers?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, status: res.status, ...(await readError(res)) };
  }
  return { ok: true, data: { id } };
}
