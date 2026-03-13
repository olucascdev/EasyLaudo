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
