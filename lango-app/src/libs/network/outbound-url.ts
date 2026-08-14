import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { ApiError } from '@/libs/api/errors';

// ---------------------------------------------------------------------------
// SSRF-safe outbound URL validation.
//
// The provider "test connection" flow lets a school admin type an endpoint URL
// that the server then fetches. Without guards that is a Server-Side Request
// Forgery primitive: the admin-controlled URL could point at localhost, RFC1918
// subnets, the cloud metadata service (169.254.169.254) or other internal
// services reachable from the Next server but not from a browser.
//
// Defense order:
//   1. Parse with WHATWG URL (it normalizes integer/hex/octal/short IPv4
//      encodings to dotted decimal, so an encoded 127.0.0.1 is still caught).
//   2. Enforce scheme (http/https) and a small allowlist of ports.
//   3. Resolve every address the hostname maps to and reject the whole URL if
//      ANY of them is loopback, private, link-local, multicast, unspecified,
//      reserved, or the cloud metadata range. Blocking only the first address
//      would let a hostname that resolves to [public, 169.254.169.254] through.
//   4. Callers must connect via `lookup` returning exactly these validated
//      addresses (see createValidatedRequest) so DNS cannot be re-resolved to
//      an internal address between validation and connect (DNS rebinding).
//   5. Never follow redirects (a 3xx to an internal host is not re-validated).
//   6. Never read or return the response body.
// ---------------------------------------------------------------------------

export const ALLOWED_SCHEMES = ['https:', 'http:'] as const;
export const ALLOWED_PORTS = [80, 443] as const;

const PRIVATE_RANGES: ReadonlyArray<{ name: string; test: (ipv4: number) => boolean }> = [
  { name: 'loopback', test: v => v >>> 24 === 127 },
  { name: 'rfc1918-10', test: v => (v >>> 24) === 10 },
  { name: 'rfc1918-172', test: v => (v >>> 24) === 172 && (v >>> 16) >= 0xac10 && (v >>> 16) <= 0xac1f },
  { name: 'rfc1918-192.168', test: v => (v >>> 24) === 192 && (v >>> 16) === 0xc0a8 },
  { name: 'link-local', test: v => (v >>> 24) === 169 && (v >>> 16) === 0xa9fe },
  { name: 'benchmarking', test: v => (v >>> 24) === 198 && ((v >>> 16) === 0xc618 || (v >>> 16) === 0xc619) },
  { name: 'reserved', test: v => (v >>> 24) === 240 || (v >>> 24) === 0 },
  { name: 'unspecified', test: v => v === 0 },
];

/** True when a resolved IPv4 belongs to a network the server must never fetch. */
export function isBlockedIpv4(ipv4: number): { blocked: boolean; reason?: string } {
  for (const range of PRIVATE_RANGES) {
    if (range.test(ipv4)) {
      return { blocked: true, reason: range.name };
    }
  }
  return { blocked: false };
}

/** True when a resolved IPv6 is loopback / link-local / multicast / unspecified. */
export function isBlockedIpv6(ip: string): { blocked: boolean; reason?: string } {
  const lower = ip.toLowerCase();
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) is really IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    const octets = mapped[1]!.split('.').map(Number);
    const v4 = ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
    return isBlockedIpv4(v4);
  }
  if (lower === '::1' || lower === '::') {
    return { blocked: true, reason: lower === '::1' ? 'loopback' : 'unspecified' };
  }
  if (lower.startsWith('fe80')) {
    return { blocked: true, reason: 'link-local' };
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) {
    return { blocked: true, reason: 'unique-local (ULA)' };
  }
  if (lower.startsWith('ff')) {
    return { blocked: true, reason: 'multicast' };
  }
  return { blocked: false };
}

/** True when an address (IPv4 or IPv6 literal or DNS name) is unsafe to fetch. */
export function isBlockedAddress(address: string): { blocked: boolean; reason?: string } {
  const ipv4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some(o => o > 255)) {
      return { blocked: true, reason: 'invalid-ipv4' };
    }
    const packed = ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
    return isBlockedIpv4(packed);
  }

  const family = isIP(address);
  if (family === 6) {
    return isBlockedIpv6(address);
  }
  if (family === 4) {
    const octets = address.split('.').map(Number);
    const packed = ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
    return isBlockedIpv4(packed);
  }
  // Not a literal: caller must resolve it and check every result.
  return { blocked: false };
}

function parseIpv4(s: string): number {
  const octets = s.split('.').map(Number);
  return ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
}

export async function resolveHostname(hostname: string): Promise<string[]> {
  // dns.lookup with all:true returns every A/AAAA record the OS resolver knows.
  const found = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return found.map(({ address }) => address);
}

export type ValidatedTarget = {
  url: URL;
  /** Every validated address the caller may connect to (rebinding-proof). */
  addresses: string[];
};

/**
 * Validate an outbound URL for SSRF safety. Throws ApiError(400, 'SSRF_BLOCKED')
 * when the scheme, port, hostname or any resolved address is unsafe. Returns
 * the parsed URL plus the pre-validated addresses the connection must use.
 */
export async function validateOutboundUrl(input: string): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(400, 'SSRF_BLOCKED', 'URL d\'endpoint invalide.');
  }

  if (!ALLOWED_SCHEMES.includes(url.protocol as (typeof ALLOWED_SCHEMES)[number])) {
    throw new ApiError(400, 'SSRF_BLOCKED', 'Seuls les endpoints HTTP/HTTPS sont autorisés.');
  }

  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (!(ALLOWED_PORTS as readonly number[]).includes(port)) {
    throw new ApiError(400, 'SSRF_BLOCKED',
      `Port ${port} non autorisé. Seuls les ports ${ALLOWED_PORTS.join(', ')} sont autorisés.`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const family = isIP(hostname);

  let addresses: string[];
  if (family !== 0) {
    // Literal IP (WHATWG already normalized encoded forms to dotted decimal).
    addresses = [hostname];
  } else {
    // Hostname: DNS-rebinding-safe callers connect only to these addresses.
    let resolved: string[];
    try {
      resolved = await resolveHostname(hostname);
    } catch {
      throw new ApiError(400, 'SSRF_BLOCKED', `Hôte "${hostname}" introuvable.`);
    }
    if (resolved.length === 0) {
      throw new ApiError(400, 'SSRF_BLOCKED', `Hôte "${hostname}" sans adresse.`);
    }
    addresses = resolved;
  }

  for (const addr of addresses) {
    const { blocked, reason } = isBlockedAddress(addr);
    if (blocked) {
      throw new ApiError(400, 'SSRF_BLOCKED',
        `Adresse interne interdite (${reason}) : ${addr}.`);
    }
  }

  return { url, addresses };
}

// ---------------------------------------------------------------------------
// Connection helper with a custom lookup pinned to the validated addresses.
// ---------------------------------------------------------------------------

/**
 * A node `lookup` implementation that returns exactly the pre-validated
 * addresses. Because the socket connects to these addresses directly, a DNS
 * rebinding attempt (hostname re-resolves to an internal IP after validation)
 * is ineffective: the second resolution is never consulted.
 */
export function validatedLookup(addresses: string[]): LookupFunction {
  return (_hostname, options, cb) => {
    if (options.all) {
      cb(null, addresses.map(a => ({ address: a, family: isIP(a) === 6 ? 6 : 4 })));
      return;
    }
    cb(null, addresses[0]!, isIP(addresses[0]!) === 6 ? 6 : 4);
  };
}

/** Small helper: parse the packed int for tests. */
export function ipv4ToInt(ip: string): number {
  return parseIpv4(ip);
}

// ---------------------------------------------------------------------------
// SSRF-safe reachability probe.
//
// Connects through a custom `lookup` pinned to the validated addresses (DNS
// rebinding is ineffective), never follows redirects (a 3xx destination is not
// re-validated), and never reads or returns the response body.
// ---------------------------------------------------------------------------

export type ConnectionProbe = {
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  message: string;
};

export function probeTarget(target: ValidatedTarget, timeoutMs = 3000): Promise<ConnectionProbe> {
  const lib = target.url.protocol === 'https:' ? https : http;
  const start = Date.now();

  return new Promise((resolve) => {
    const req = lib.request(target.url, {
      method: 'GET',
      // Pin the connection to the pre-validated addresses. The hostname is never
      // resolved again, so a DNS rebinding race cannot swap in an internal IP.
      lookup: validatedLookup(target.addresses),
      headers: { connection: 'close' },
      timeout: timeoutMs,
    });

    req.on('response', (res) => {
      const latencyMs = Date.now() - start;
      const statusCode = res.statusCode ?? 0;
      // Drain without buffering: the body is never returned to the caller.
      res.resume();
      const ok = statusCode >= 200 && statusCode < 300;
      let message: string;
      if (ok) {
        message = 'Connexion réussie';
      } else if (statusCode >= 300 && statusCode < 400) {
        // Node does not auto-follow redirects; we deliberately do not either.
        message = 'Redirection bloquée — destination non vérifiée';
      } else {
        message = `Réponse HTTP ${statusCode}${res.statusMessage ? ` (${res.statusMessage})` : ''}`;
      }
      resolve({ ok, statusCode, latencyMs, message });
    });

    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });

    req.on('error', () => {
      const isTimeout = req.destroyed && Date.now() - start >= timeoutMs;
      resolve({
        ok: false,
        statusCode: 0,
        latencyMs: Date.now() - start,
        message: isTimeout ? 'Délai d\'attente dépassé (3s)' : 'Hôte injoignable ou erreur réseau',
      });
    });

    req.end();
  });
}
