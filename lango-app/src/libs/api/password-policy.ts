import { ApiError } from './errors';

const COMMON_DISALLOWED_PASSWORDS = new Set([
  '1234567890',
  'password123',
  'password1234',
  'qwertyuiop',
  'admin123456',
  'schoolos123',
  'schoolos1234',
  'changeme123',
]);

export function validatePasswordPolicy(password: string): void {
  if (password.length < 10) {
    throw new ApiError(422, 'WEAK_PASSWORD', 'Le mot de passe doit contenir au moins 10 caractères.');
  }

  const lower = password.toLowerCase();
  if (COMMON_DISALLOWED_PASSWORDS.has(lower)) {
    throw new ApiError(422, 'WEAK_PASSWORD', 'Ce mot de passe est trop commun. Choisissez un mot de passe plus sécurisé.');
  }
}
