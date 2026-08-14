import type { PermissionKey } from '@/libs/api/permissions';
import { CORE_REPORT_DEFINITIONS } from './catalog-definitions';
import { checkReportReadiness } from './readiness-checker';
import type { ReportCatalogItem } from '../types/reporting-types';

export class CatalogService {
  /**
   * Returns all report definitions enriched with readiness status - checks
   * both domain-level (whole module disabled, e.g. Inventory) and
   * report-level (this specific report has no real data model yet, e.g.
   * fees.fines) readiness, so the catalog never shows a report as "Prêt"
   * when running it would 409.
   */
  static getDefinitions(): ReportCatalogItem[] {
    return CORE_REPORT_DEFINITIONS.map(def => ({
      ...def,
      readiness: checkReportReadiness(def.key, def.domain),
    }));
  }

  /**
   * Returns report definitions filtered by caller's permissions.
   */
  static getDefinitionsForUser(userPermissions: PermissionKey[]): ReportCatalogItem[] {
    const isSuperAdmin = userPermissions.includes('settings.security.manage');
    const catalog = this.getDefinitions();

    if (isSuperAdmin) {
      return catalog;
    }

    return catalog.filter(report => {
      if (!report.requiredPermissions || report.requiredPermissions.length === 0) {
        return true;
      }
      return report.requiredPermissions.some(perm => userPermissions.includes(perm));
    });
  }

  /**
   * Returns single report definition by key with support for dot/dash key normalization.
   */
  static getDefinitionByKey(key: string): ReportCatalogItem | undefined {
    const all = this.getDefinitions();
    const normalizedDotKey = key.replace(/-/g, '.');
    const normalizedDashKey = key.replace(/\./g, '-');
    return all.find(def => def.key === key || def.key === normalizedDotKey || def.key === normalizedDashKey);
  }
}
