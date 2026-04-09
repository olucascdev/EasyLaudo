export type User = {
  id: string;
  email: string;
  created_at: string;
};

export type TemplateSummary = {
  id: string;
  name: string;
  file_path: string;
  fields: string[];
  text?: string;
  detected_fields?: string[];
  created_at: string;
};

export type TemplateProcessResult = {
  file_path: string;
  filename: string;
  text: string;
  detected_fields: string[];
};

export type SpreadsheetSummary = {
  id: string;
  file_path: string;
  columns: string[];
  row_count: number;
  preview?: Record<string, string>[];
  rows?: Record<string, string>[];
  sheet_name?: string | null;
  header_row_index?: number | null;
  created_at: string;
};

export type MappingLookup = {
  id?: string;
  spreadsheet_id: string;
  template_id: string;
  saved_map: Record<string, string>;
  suggested_map: Record<string, string>;
  created_at?: string;
};

export type ImportStep = "upload" | "mapping" | "editor";

export type SavedImportFlowSummary = {
  mapping_id: string;
  spreadsheet_id: string;
  spreadsheet_name: string;
  template_id: string;
  template_name: string;
  row_count: number;
  has_draft: boolean;
  updated_at: string;
};

export type EditorDraft = {
  id?: string;
  mapping_id: string;
  patients: Record<string, string>[];
  selected_index: number;
  updated_at: string;
};

export type EditorContext = {
  mapping_id: string;
  spreadsheet: SpreadsheetSummary;
  template: TemplateSummary;
  mapping: Record<string, string>;
  patients: Record<string, string>[];
  selected_index: number;
  has_draft: boolean;
};

export type DashboardOverview = {
  report_counts: {
    gerado: number;
    pendente: number;
    erro: number;
  };
  reports: Array<{
    id: string;
    template_id: string | null;
    patient_data: Record<string, string>;
    file_path: string | null;
    status: string;
    created_at: string;
  }>;
  spreadsheets: SpreadsheetSummary[];
  templates: TemplateSummary[];
};

export type ExtractionResult = {
  filename: string;
  status: string;
  method: string;
  data: Record<string, string | null>;
  message?: string;
};

export type RetentionPolicy = {
  editor_drafts_days: number;
  spreadsheets_days: number;
  reports_days: number;
  temporary_files_days: number;
};

export type LgpdTransparency = {
  processing_purposes: string[];
  third_party_processing: {
    ai_extraction_enabled: boolean;
    provider: string;
  };
  retention_policy: RetentionPolicy;
};

export type LgpdExportPayload = {
  generated_at: string;
  request_id?: string;
  retention_policy: RetentionPolicy;
  user: {
    id: string;
    email: string;
    created_at: string;
  };
  data: {
    templates: Array<Record<string, unknown>>;
    spreadsheets: Array<Record<string, unknown>>;
    mappings: Array<Record<string, unknown>>;
    reports: Array<Record<string, unknown>>;
    editor_drafts: Array<Record<string, unknown>>;
  };
};
