import type { PermissionKey } from '@/libs/api/permissions';

export type SensitivityLevel = 'standard' | 'restricted' | 'confidential';
export type FreshnessType = 'realtime' | 'snapshot' | 'projection';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type ParameterType = 'string' | 'number' | 'boolean' | 'date' | 'select' | 'multi_select';

export type ParameterDefinition = {
  key: string;
  label: string;
  type: ParameterType;
  required?: boolean;
  defaultValue?: any;
  options?: Array<{ label: string; value: string }>;
  description?: string;
};

export type ColumnDefinition = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'percentage' | 'date' | 'datetime' | 'boolean' | 'badge';
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  formatter?: string;
};

export type ReportDefinitionContract = {
  key: string;
  domain: string;
  version: number;
  title: string;
  description: string;
  sensitivityLevel: SensitivityLevel;
  freshnessType: FreshnessType;
  executionAdapter: string;
  parametersSchema: ParameterDefinition[];
  columnsSchema: ColumnDefinition[];
  supportedFormats: ExportFormat[];
  requiredPermissions: PermissionKey[];
  isActive: boolean;
};

export type DomainReadinessStatus = {
  domain: string;
  isReady: boolean;
  reason?: string;
  missingContract?: string;
};

export type ReportCatalogItem = ReportDefinitionContract & {
  readiness: DomainReadinessStatus;
  isFavorite?: boolean;
};

export type ReportPreviewResult = {
  definition: ReportCatalogItem;
  columns: ColumnDefinition[];
  rows: Record<string, any>[];
  totalRows: number;
  isTruncated: boolean;
  generatedAt: string;
};
