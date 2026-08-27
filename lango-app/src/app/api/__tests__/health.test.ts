import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health endpoint (D-11 / T8)', () => {
  it('returns status 200 with healthy and reachable database', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(json.database).toBe('reachable');
    expect(typeof json.uptime).toBe('number');
    expect(typeof json.timestamp).toBe('string');
  });
});
