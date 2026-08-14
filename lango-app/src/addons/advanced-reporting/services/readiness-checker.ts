import { ADDONS } from '@/addons/registry';
import type { DomainReadinessStatus } from '../types/reporting-types';

// Report-level gaps (as opposed to domain-level - the domain itself is
// active, but this specific report has no real backing data model) found
// during future-implementation/advanced-reporting remediation, section-03.
const REPORT_LEVEL_NOT_READY: Record<string, string> = {
  'fees.fines': 'Aucun modèle de données réel pour les pénalités n\'existe encore.',
  'attendance.employee_summary': 'Aucun modèle de données réel pour le pointage du personnel n\'existe encore.',
  'attendance.exam_session': 'Aucun suivi de présence réel pour les séances d\'examen n\'existe encore.',
};

export function checkReportReadiness(reportKey: string, domain: string): DomainReadinessStatus {
  if (reportKey in REPORT_LEVEL_NOT_READY) {
    return { domain, isReady: false, reason: REPORT_LEVEL_NOT_READY[reportKey] };
  }
  return checkDomainReadiness(domain);
}

export function checkDomainReadiness(domain: string): DomainReadinessStatus {
  switch (domain.toLowerCase()) {
    case 'student':
    case 'attendance':
    case 'finance':
    case 'fees':
    case 'academics':
    case 'examination':
    case 'platform':
      return {
        domain,
        isReady: true,
      };

    case 'hr':
    case 'human-resources': {
      const hrAddon = ADDONS.find(a => a.id === 'human-resources');
      if (hrAddon && hrAddon.enabled) {
        return { domain, isReady: true };
      }
      return {
        domain,
        isReady: false,
        reason: 'Module RH non activé',
        missingContract: 'future-implementation/human-resources-employee-management/',
      };
    }

    case 'inventory': {
      const invAddon = ADDONS.find(a => a.id === 'inventory');
      if (invAddon && invAddon.enabled) {
        return { domain, isReady: true };
      }
      return {
        domain,
        isReady: false,
        reason: 'Module Gestion des Stocks non activé',
        missingContract: 'future-implementation/inventory-management/',
      };
    }

    default:
      return {
        domain,
        isReady: true,
      };
  }
}
