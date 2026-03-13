export type WorkflowState = {
  spreadsheetId?: string;
  templateId?: string;
  mapping?: Record<string, string>;
};

export type TemplatePreviewSegment =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "field";
      field: string;
      value: string;
      missing: boolean;
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
  return templateText.replace(/\{\{\s*([^{}\n\r]+?)\s*\}\}/g, (_, field) => values[field]?.toString() || "________");
}

export function getPreviewSegments(
  templateText: string,
  values: Record<string, string | null | undefined>
): TemplatePreviewSegment[] {
  const segments: TemplatePreviewSegment[] = [];
  const matcher = /\{\{\s*([^{}\n\r]+?)\s*\}\}/g;
  let lastIndex = 0;

  let match = matcher.exec(templateText);
  while (match) {
    const [token, rawField] = match;
    const field = rawField.trim();
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({
        type: "text",
        value: templateText.slice(lastIndex, index)
      });
    }

    const resolvedValue = values[field]?.toString().trim();
    segments.push({
      type: "field",
      field,
      value: resolvedValue || `{{${field}}}`,
      missing: !resolvedValue
    });

    lastIndex = index + token.length;
    match = matcher.exec(templateText);
  }

  if (lastIndex < templateText.length) {
    segments.push({
      type: "text",
      value: templateText.slice(lastIndex)
    });
  }

  return segments.length
    ? segments
    : [
        {
          type: "text",
          value: templateText
        }
      ];
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
