import { describe, expect, it } from 'vitest';
import { parseJson, settingsUpdateSchema } from '@/libs/api/validation';
import { ApiError } from '@/libs/api/errors';

describe('Settings Schema & Field-Level Error Invariants', () => {
  it('accepts empty string for optional contact emails without validation error', () => {
    const payload = {
      establishmentName: 'Groupe Scolaire Atlas',
      financialContactEmail: '',
      admissionsContactEmail: '',
      directorEmail: '',
      email: '',
      startDate: '',
      endDate: '',
    };

    const parsed = settingsUpdateSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.financialContactEmail).toBeNull();
      expect(parsed.data.admissionsContactEmail).toBeNull();
      expect(parsed.data.startDate).toBeNull();
    }
  });

  it('rejects invalid email addresses with clear localized message', () => {
    const payload = {
      establishmentName: 'Groupe Scolaire Atlas',
      financialContactEmail: 'not-an-email',
      admissionsContactEmail: 'also-invalid',
    };

    const parsed = settingsUpdateSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.financialContactEmail?.[0]).toBe('Adresse email invalide');
      expect(fieldErrors.admissionsContactEmail?.[0]).toBe('Adresse email invalide');
    }
  });

  it('requires establishmentName with localized message', () => {
    const payload = {
      establishmentName: '   ',
    };

    const parsed = settingsUpdateSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.establishmentName?.[0]).toBe("Le nom de l'établissement est obligatoire");
    }
  });

  it('parseJson attaches structured fieldErrors to ApiError details', async () => {
    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        establishmentName: '',
        financialContactEmail: 'invalid-email',
      }),
    });

    let caughtError: ApiError | null = null;
    try {
      await parseJson(request, settingsUpdateSchema);
    } catch (err) {
      if (err instanceof ApiError) {
        caughtError = err;
      }
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.status).toBe(422);
    expect(caughtError?.code).toBe('VALIDATION_ERROR');
    const details = caughtError?.details as { fieldErrors: Record<string, string> };
    expect(details?.fieldErrors?.establishmentName).toBe("Le nom de l'établissement est obligatoire");
    expect(details?.fieldErrors?.financialContactEmail).toBe('Adresse email invalide');
  });
});
