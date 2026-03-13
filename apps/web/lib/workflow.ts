export type WorkflowState = {
  spreadsheetId?: string;
  templateId?: string;
  mapping?: Record<string, string>;
};

const STORAGE_KEY = "easylaudo.workflow";

export function readWorkflowState(): WorkflowState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkflowState) : {};
  } catch {
    return {};
  }
}

export function writeWorkflowState(next: WorkflowState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function mergeWorkflowState(partial: WorkflowState) {
  writeWorkflowState({
    ...readWorkflowState(),
    ...partial
  });
}

export function renderPreviewText(templateText: string, values: Record<string, string | null | undefined>) {
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_\- ]+?)\s*\}\}/g, (_, field) => values[field]?.toString() || "________");
}

export function applyMapping(
  rows: Record<string, string>[],
  fields: string[],
  mapping: Record<string, string>
) {
  return rows.map((row) => {
    const patient = Object.fromEntries(fields.map((field) => [field, ""])) as Record<string, string>;

    Object.entries(mapping).forEach(([column, field]) => {
      if (!field || field === "__ignore__") {
        return;
      }
      patient[field] = row[column] ?? "";
    });

    return patient;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

