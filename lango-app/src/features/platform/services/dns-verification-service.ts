import dns from 'node:dns/promises';

export interface DnsVerificationResult {
  domain: string;
  isFullyVerified: boolean;
  cnameMatched: boolean;
  aRecordMatched: boolean;
  txtTokenMatched: boolean;
  detectedCnames: string[];
  detectedIps: string[];
  detectedTxt: string[];
  expectedTarget: string;
  expectedIp: string;
  expectedToken?: string;
  message: string;
  checkedAt: string;
}

const DEFAULT_TARGET_HOST = 'schoolos.epioso.com';
const DEFAULT_TARGET_IP = '43.157.17.129';

/**
 * Performs real DNS queries to verify whether a custom domain or subdomain
 * is correctly routed to SchoolOS infrastructure and/or owns the verification TXT record.
 */
export async function verifyDomainDns(
  domain: string,
  expectedToken?: string | null
): Promise<DnsVerificationResult> {
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  const result: DnsVerificationResult = {
    domain: cleanDomain,
    isFullyVerified: false,
    cnameMatched: false,
    aRecordMatched: false,
    txtTokenMatched: false,
    detectedCnames: [],
    detectedIps: [],
    detectedTxt: [],
    expectedTarget: DEFAULT_TARGET_HOST,
    expectedIp: DEFAULT_TARGET_IP,
    expectedToken: expectedToken || undefined,
    message: '',
    checkedAt: new Date().toISOString(),
  };

  // 1. Query CNAME records
  try {
    const cnames = await dns.resolveCname(cleanDomain);
    result.detectedCnames = cnames.map(c => c.toLowerCase());
    result.cnameMatched = result.detectedCnames.some(
      c => c === DEFAULT_TARGET_HOST || c.endsWith('.schoolos.epioso.com') || c.endsWith('.schoolos.ma') || c.endsWith('.schoolos.app')
    );
  } catch {
    // CNAME not found or direct apex domain (which usually uses A records instead of CNAME)
  }

  // 2. Query A records (IPv4)
  try {
    const addresses = await dns.resolve4(cleanDomain);
    result.detectedIps = addresses;
    result.aRecordMatched = addresses.includes(DEFAULT_TARGET_IP);
  } catch {
    // A records not found or DNS resolution error
  }

  // 3. Query TXT records (for domain ownership verification)
  if (expectedToken) {
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      // txtRecords is an array of string arrays, e.g. [["schoolos-verify=..."]]
      const flatTxt = txtRecords.flat().map(t => t.trim());
      result.detectedTxt = flatTxt;
      result.txtTokenMatched = flatTxt.some(
        t => t === expectedToken || t === `schoolos-verify=${expectedToken}` || t.includes(expectedToken)
      );
    } catch {
      // TXT records not found
    }
  }

  // Verification criteria:
  // Domain is verified if either:
  // - CNAME points to SchoolOS host OR
  // - A record points to SchoolOS IP OR
  // - TXT ownership token matches
  const hasRouting = result.cnameMatched || result.aRecordMatched;
  const hasToken = result.txtTokenMatched;

  if (expectedToken) {
    result.isFullyVerified = hasRouting || hasToken;
  } else {
    result.isFullyVerified = hasRouting;
  }

  if (result.isFullyVerified) {
    if (result.cnameMatched) {
      result.message = `Configuration DNS valide : L'enregistrement CNAME pointe correctement vers ${DEFAULT_TARGET_HOST}.`;
    } else if (result.aRecordMatched) {
      result.message = `Configuration DNS valide : L'enregistrement A pointe correctement vers ${DEFAULT_TARGET_IP}.`;
    } else {
      result.message = `Propriété du domaine validée avec succès via le jeton de sécurité TXT.`;
    }
  } else {
    const issues: string[] = [];
    if (result.detectedCnames.length > 0 && !result.cnameMatched) {
      issues.push(`CNAME détecté (${result.detectedCnames.join(', ')}) ne correspond pas à ${DEFAULT_TARGET_HOST}`);
    } else if (result.detectedCnames.length === 0) {
      issues.push(`Aucun CNAME vers ${DEFAULT_TARGET_HOST} détecté`);
    }

    if (result.detectedIps.length > 0 && !result.aRecordMatched) {
      issues.push(`IP détectée (${result.detectedIps.join(', ')}) différente de ${DEFAULT_TARGET_IP}`);
    }

    if (expectedToken && !result.txtTokenMatched) {
      issues.push(`Jeton TXT introuvable`);
    }

    result.message = `Vérification incomplète : ${issues.join('. ')}. La propagation DNS peut prendre jusqu'à quelques heures.`;
  }

  return result;
}
