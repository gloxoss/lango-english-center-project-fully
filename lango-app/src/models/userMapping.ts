// ponytail: the UI sends and displays French labels ('Admin', 'Actif'), the Postgres
// enums are English snake_case. Mapping lives here rather than in the routes so both
// directions stay in one place, and so the UI keeps working unchanged.

import { role as roleEnum, status as statusEnum } from './Schema';

type Role = (typeof roleEnum.enumValues)[number];
type Status = (typeof statusEnum.enumValues)[number];

const ROLE_TO_DB: Record<string, Role> = {
  'Admin': 'school_admin',
  'Enseignant': 'teacher',
  'Comptable': 'accountant',
  'Tuteur': 'parent',
  'Élève': 'student',
  'Eleve': 'student',
  'Super Admin': 'super_admin',
  'Réceptionniste': 'receptionist',
  'Gardien': 'guard',
};

const ROLE_TO_UI: Record<Role, string> = {
  super_admin: 'Super Admin',
  school_admin: 'Admin',
  teacher: 'Enseignant',
  accountant: 'Comptable',
  student: 'Élève',
  parent: 'Tuteur',
  receptionist: 'Réceptionniste',
  guard: 'Gardien',
};

const STATUS_TO_DB: Record<string, Status> = {
  'Actif': 'active',
  'Inactif': 'inactive',
  'Archivé': 'archived',
};

const STATUS_TO_UI: Record<Status, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  archived: 'Archivé',
};

/** French label -> enum. Also accepts a raw enum value, so callers can pass either.
 *  Unknown input falls back rather than throwing: a stale filter value in the UI
 *  should degrade to a default, not 500. */
export function toDbRole(label: string | null | undefined, fallback: Role = 'student'): Role {
  if (!label) {
    return fallback;
  }
  if (ROLE_TO_DB[label]) {
    return ROLE_TO_DB[label];
  }
  if ((roleEnum.enumValues as readonly string[]).includes(label)) {
    return label as Role;
  }
  return fallback;
}

export function toDbStatus(label: string | null | undefined, fallback: Status = 'active'): Status {
  if (!label) {
    return fallback;
  }
  if (STATUS_TO_DB[label]) {
    return STATUS_TO_DB[label];
  }
  if ((statusEnum.enumValues as readonly string[]).includes(label)) {
    return label as Status;
  }
  return fallback;
}

export function toUiRole(value: Role): string {
  return ROLE_TO_UI[value] ?? value;
}

export function toUiStatus(value: Status): string {
  return STATUS_TO_UI[value] ?? value;
}
