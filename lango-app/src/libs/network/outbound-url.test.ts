import dns from 'node:dns';
import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isBlockedAddress, ipv4ToInt, probeTarget, validateOutboundUrl, validatedLookup,
} from './outbound-url';

function blockReason(ip: string): string | undefined {
  return isBlockedAddress(ip).blocked ? isBlockedAddress(ip).reason : undefined;
}

function mockLookup(map: Record<string, string[]>): void {
  const impl = (async (hostname: string, options: dns.LookupOptions = {}) => {
    const addrs = map[hostname] ?? [];
    if (options.all) {
      return addrs.map(a => ({ address: a, family: a.includes(':') ? 6 : 4 }));
    }
    return { address: addrs[0] ?? '', family: addrs[0]?.includes(':') ? 6 : 4 };
  }) as typeof dns.promises.lookup;
  vi.spyOn(dns.promises, 'lookup').mockImplementation(impl);
}

describe('isBlockedAddress — blocked ranges', () => {
  const blocked = [
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['10.0.0.1', 'rfc1918-10'],
    ['10.255.255.255', 'rfc1918-10'],
    ['172.16.0.1', 'rfc1918-172'],
    ['172.31.255.255', 'rfc1918-172'],
    ['192.168.0.1', 'rfc1918-192.168'],
    ['192.168.255.255', 'rfc1918-192.168'],
    ['169.254.169.254', 'link-local'], // cloud metadata service
    ['169.254.0.1', 'link-local'],
    ['0.0.0.0', 'reserved'], // first octet 0 => reserved block
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fe80::1', 'link-local'],
    ['fc00::1', 'unique-local (ULA)'],
    ['ff02::1', 'multicast'],
    ['::ffff:127.0.0.1', 'loopback'], // IPv4-mapped loopback
    ['::ffff:10.0.0.1', 'rfc1918-10'], // IPv4-mapped RFC1918
  ] as const;

  for (const [ip, reason] of blocked) {
    it(`blocks ${ip} (${reason})`, () => {
      expect(blockReason(ip)).toBe(reason);
    });
  }
});

describe('isBlockedAddress — public addresses are allowed', () => {
  const publicIps = [
    '8.8.8.8', '1.1.1.1', '93.184.216.34', '104.18.0.1', '2001:4860:4860::8888',
    '2606:4700:4700::1111',
  ];
  for (const ip of publicIps) {
    it(`allows ${ip}`, () => {
      expect(isBlockedAddress(ip).blocked).toBe(false);
    });
  }
});

describe('validateOutboundUrl — literal IPs (encoded forms normalized by WHATWG URL)', () => {
  it.each([
    'http://127.0.0.1',
    'http://2130706433', // decimal integer form of 127.0.0.1
    'http://0x7f000001', // hex form
    'http://0177.0.0.1', // octal form
    'http://127.1',      // short dotted form
    'http://127.0.1',
    'http://[::1]',
    'http://169.254.169.254',
  ])('blocks %s', async (input) => {
    await expect(validateOutboundUrl(input)).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('blocks loopback on a non-default port', async () => {
    await expect(validateOutboundUrl('http://127.0.0.1:8080')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('blocks non-http schemes', async () => {
    await expect(validateOutboundUrl('ftp://example.com')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('blocks disallowed ports even on public hosts', async () => {
    await expect(validateOutboundUrl('http://example.com:8080')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
    await expect(validateOutboundUrl('https://example.com:9443')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('allows https on a public literal host', async () => {
    const { url } = await validateOutboundUrl('https://8.8.8.8');
    expect(url.hostname).toBe('8.8.8.8');
  });
});

describe('validateOutboundUrl — DNS resolution', () => {
  afterEach(() => vi.restoreAllMocks());

  it('blocks a hostname that resolves to localhost (Docker service / dev host)', async () => {
    mockLookup({ localhost: ['127.0.0.1', '::1'] });
    await expect(validateOutboundUrl('http://localhost:80')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('blocks a Docker-internal service name resolving to RFC1918', async () => {
    mockLookup({ db: ['172.17.0.2'], postgres: ['172.18.0.3'], redis: ['192.168.65.1'] });
    await expect(validateOutboundUrl('http://db')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
    await expect(validateOutboundUrl('http://postgres:5432')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
    await expect(validateOutboundUrl('http://redis')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('blocks host.docker.internal / metadata hostnames', async () => {
    mockLookup({ 'host.docker.internal': ['192.168.65.254'], 'metadata.google.internal': ['169.254.169.254'] });
    await expect(validateOutboundUrl('http://host.docker.internal')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
    await expect(validateOutboundUrl('http://metadata.google.internal')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('blocks a hostname whose ANY resolved address is internal (mixed A records)', async () => {
    // A public-to-private rebinding target: the validator must reject because
    // one of the addresses is internal, even though another is public.
    mockLookup({ 'evil.example.com': ['93.184.216.34', '10.0.0.5'] });
    await expect(validateOutboundUrl('http://evil.example.com')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });

  it('returns every validated address for a public hostname', async () => {
    mockLookup({ 'api.example.com': ['93.184.216.34'] });
    const { addresses } = await validateOutboundUrl('https://api.example.com');
    expect(addresses).toEqual(['93.184.216.34']);
  });

  it('rejects an unresolvable hostname', async () => {
    mockLookup({ 'no-such-host.invalid': [] });
    await expect(validateOutboundUrl('https://no-such-host.invalid')).rejects.toMatchObject({ status: 400, code: 'SSRF_BLOCKED' });
  });
});

describe('validatedLookup — rebinding-proof pinning', () => {
  it('returns exactly the validated addresses and never re-resolves', () => {
    const lookup = validatedLookup(['93.184.216.34']);
    const cb = vi.fn();
    lookup('api.example.com', { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [{ address: '93.184.216.34', family: 4 }]);
  });

  it('returns the first address when all:false', () => {
    const lookup = validatedLookup(['2606:4700:4700::1111']);
    const cb = vi.fn();
    lookup('api.example.com', { all: false }, cb);
    expect(cb).toHaveBeenCalledWith(null, '2606:4700:4700::1111', 6);
  });
});

describe('probeTarget — rebinding-proof connection', () => {
  function listen(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
      const server = http.createServer(handler);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (typeof address === 'object' && address) resolve({ server, port: address.port });
      });
    });
  }

  function close(server: http.Server): Promise<void> {
    return new Promise((resolve) => { server.close(() => resolve()); });
  }

  it('reports a 2xx as reachable', async () => {
    const { server, port } = await listen((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); });
    try {
      const probe = await probeTarget({ url: new URL(`http://127.0.0.1:${port}/health`), addresses: ['127.0.0.1'] });
      expect(probe.ok).toBe(true);
      expect(probe.statusCode).toBe(200);
      expect(probe.message).toBe('Connexion réussie');
    } finally {
      await close(server);
    }
  });

  it('never follows a redirect and reports it blocked', async () => {
    const { server, port } = await listen((_req, res) => { res.writeHead(302, { location: 'http://127.0.0.1:8080/secret' }); res.end(); });
    try {
      const probe = await probeTarget({ url: new URL(`http://127.0.0.1:${port}/x`), addresses: ['127.0.0.1'] });
      expect(probe.ok).toBe(false);
      expect(probe.statusCode).toBe(302);
      expect(probe.message).toMatch(/Redirection bloquée/);
    } finally {
      await close(server);
    }
  });

  it('times out instead of hanging', async () => {
    const { server, port } = await listen(() => { /* never respond */ });
    try {
      const started = Date.now();
      const probe = await probeTarget({ url: new URL(`http://127.0.0.1:${port}/`), addresses: ['127.0.0.1'] }, 800);
      expect(probe.ok).toBe(false);
      expect(probe.statusCode).toBe(0);
      expect(probe.message).toMatch(/Délai d'attente/);
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await close(server);
    }
  });
});

describe('ipv4ToInt', () => {
  it('packs dotted decimal to a bigint-safe int', () => {
    expect(ipv4ToInt('127.0.0.1')).toBe(2130706433);
    expect(ipv4ToInt('169.254.169.254')).toBe(0xa9fea9fe);
    expect(ipv4ToInt('172.16.0.1')).toBe(0xac100001);
  });
});
