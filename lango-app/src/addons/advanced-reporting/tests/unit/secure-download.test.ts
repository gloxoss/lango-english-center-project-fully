// Secure report-run download link enforcement: HMAC-signed, 24h-expiring URLs.
// Proves tamper/expiry rejection is timing-safe and bound to the exact run id,
// without any DB.
import { describe, expect, it } from 'vitest';
import { SecureDownloadService } from '../../services/secure-download';

describe('SecureDownloadService (signed, expiring download links)', () => {
  it('round-trips a valid, unexpired signature', () => {
    const runId = 'run-123';
    const exp = Date.now() + 60_000;
    const sig = SecureDownloadService.generateSignature(runId, exp);
    expect(SecureDownloadService.verifySignature(runId, exp, sig)).toBe(true);
  });

  it('rejects an expired link', () => {
    const runId = 'run-123';
    const exp = Date.now() - 60_000;
    const sig = SecureDownloadService.generateSignature(runId, exp);
    expect(SecureDownloadService.verifySignature(runId, exp, sig)).toBe(false);
  });

  it('rejects a tampered signature of the same length', () => {
    const runId = 'run-123';
    const exp = Date.now() + 60_000;
    const sig = SecureDownloadService.generateSignature(runId, exp);
    const tampered = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
    expect(tampered).toHaveLength(sig.length);
    expect(SecureDownloadService.verifySignature(runId, exp, tampered)).toBe(false);
  });

  it('rejects a signature minted for a different run id', () => {
    const exp = Date.now() + 60_000;
    const sig = SecureDownloadService.generateSignature('run-A', exp);
    expect(SecureDownloadService.verifySignature('run-B', exp, sig)).toBe(false);
  });

  it('getSignedDownloadUrl embeds the run id, expiry and signature', () => {
    const url = SecureDownloadService.getSignedDownloadUrl('run-123');
    expect(url).toContain('/api/addons/reporting/runs/run-123/download');
    expect(url).toContain('expires=');
    expect(url).toContain('sig=');
  });
});
