// Static config for the 3 institutional contact cards on the Organisation & Identite page.
// Decoupled from JSX per Next.js App Structure Rule 3 (Content Separation).
export const INSTITUTIONAL_CONTACT_ROLES = [
  {
    key: 'director' as const,
    label: 'Directeur',
    badge: 'Principal',
    nameField: 'directorName' as const,
    emailField: 'directorEmail' as const,
    phoneField: 'directorPhone' as const,
  },
  {
    key: 'finance' as const,
    label: 'Contact Financier',
    badge: 'Finance',
    nameField: 'financialContactName' as const,
    emailField: 'financialContactEmail' as const,
    phoneField: 'financialContactPhone' as const,
  },
  {
    key: 'admissions' as const,
    label: 'Contact Admissions',
    badge: 'Admissions',
    nameField: 'admissionsContactName' as const,
    emailField: 'admissionsContactEmail' as const,
    phoneField: 'admissionsContactPhone' as const,
  },
] as const;

export type ContactRoleKey = typeof INSTITUTIONAL_CONTACT_ROLES[number]['key'];
