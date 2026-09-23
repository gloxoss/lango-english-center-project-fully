import crypto from 'node:crypto';

export class SecureDownloadService {
  // No public fallback in production: a known key would let anyone mint valid
  // download links. BETTER_AUTH_SECRET (required at boot) is the fallback.
  private static get SECRET_KEY(): string {
    const secret = process.env.REPORTING_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REPORTING_SIGNING_SECRET or BETTER_AUTH_SECRET is required in production.');
    }
    return 'schoolos-dev-reporting-secret';
  }

  /**
   * Generates an HMAC SHA-256 signature for a report run download URL.
   */
  static generateSignature(runId: string, expiresAtTimestamp: number): string {
    const payload = `${runId}:${expiresAtTimestamp}`;
    return crypto.createHmac('sha256', this.SECRET_KEY).update(payload).digest('hex');
  }

  /**
   * Verifies signature and checks whether the link has expired.
   */
  static verifySignature(runId: string, expiresAtTimestamp: number, signature: string): boolean {
    if (Date.now() > expiresAtTimestamp) {
      return false; // Expired link
    }

    const expectedSignature = this.generateSignature(runId, expiresAtTimestamp);
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Generates full signed download URL for a run artifact.
   */
  static getSignedDownloadUrl(runId: string): string {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h expiration
    const sig = this.generateSignature(runId, expiresAt);
    return `/api/addons/reporting/runs/${runId}/download?expires=${expiresAt}&sig=${sig}`;
  }
}
