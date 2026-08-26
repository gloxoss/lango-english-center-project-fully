import crypto from 'node:crypto';

// AES-256-GCM authenticated encryption for tenant-scoped provider credentials
// (broadcast connections). Keyed from ENCRYPTION_KEY (fallback: BETTER_AUTH_SECRET,
// the app's existing ≥32-char secret). Version-tagged so the cipher can rotate
// later without breaking old rows. Only encrypted blobs are stored; decrypted
// values are returned exactly once at creation/test time, never re-rendered.

export function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'Missing required encryption key: ENCRYPTION_KEY or BETTER_AUTH_SECRET must be configured in environment variables.',
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Unsupported secret format');
  }
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncrypted(payload: string | null | undefined): boolean {
  return Boolean(payload && payload.startsWith('v1:'));
}
