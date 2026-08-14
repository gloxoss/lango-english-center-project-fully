// security-config.ts
// Static configuration for Security Policies, 2FA Adoption Targets & Presets
// Decoupled from JSX per Next.js App Router Rule 3 (Content Separation).

export const PASSWORD_COMPLEXITY_OPTIONS = [
  { value: 'strict', label: 'Stricte (12+ car., chiffres, symboles & majuscules)' },
  { value: 'standard', label: 'Standard (8+ car., lettres & chiffres)' },
  { value: 'basic', label: 'Basique (6+ car. sans contrainte)' },
] as const;

export const SESSION_TIMEOUT_OPTIONS = [
  { value: '30', label: "30 minutes d'inactivité" },
  { value: '60', label: "1 heure d'inactivité" },
  { value: '240', label: "4 heures d'inactivité" },
  { value: '480', label: "8 heures (fin de journée)" },
] as const;
