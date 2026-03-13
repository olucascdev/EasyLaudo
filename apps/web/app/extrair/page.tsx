"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { ExtractionResult, TemplateSummary } from "@/lib/types";
import { downloadBlob } from "@/lib/workflow";

export default function ExtrairPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [manualFields, setManualFields] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<TemplateSummary[]>("/modelo/list")
      .then(setTemplates)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Falha ao carregar modelos."));
  }, []);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const effectiveFields = useMemo(() => {
    if (selectedTemplate?.fields.length) {
      return selectedTemplate.fields;
    }
    return manualFields
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);
  }, [manualFields, selectedTemplate?.fields]);

  const columns = useMemo(() => {
    const dynamicColumns = results.flatMap((result) => Object.keys(result.data));
    return Array.from(new Set(dynamicColumns));
  }, [results]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) {
      setError("Selecione ao menos um DOCX.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("fields", JSON.stringify(effectiveFields));
      const extracted = await api.upload<ExtractionResult[]>("/extracao/processar", formData);
      setResults(extracted);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Falha ao extrair.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const rows = results.map((result) => ({
      arquivo: result.filename,
      status: result.status,
      metodo: result.method,
      ...result.data
    }));

    const { blob, filename } = await api.blob("/extracao/exportar", {
      method: "POST",
      body: JSON.stringify({ rows })
    });
    downloadBlob(blob, filename || "extracao.xlsx");
  }

  return (
    <AuthGuard>
      <AppShell
        title="Extrair para planilha"
        description="Suba laudos DOCX, rode extracao por marcadores ou IA e revise os dados antes de exportar para XLSX."
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="Processar DOCX" subtitle="Selecione um template para reaproveitar os campos ou informe os campos manualmente.">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink/70">Template de referencia</label>
                <select className="panel-input" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                  <option value="">Sem template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink/70">Campos manuais (opcional)</label>
                <textarea
                  className="panel-input min-h-28"
                  placeholder="nome, data_atendimento, pressao_arterial"
                  value={manualFields}
                  onChange={(event) => setManualFields(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink/70">Arquivos DOCX</label>
                <input
                  className="panel-input"
                  type="file"
                  accept=".docx"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                />
              </div>
              {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={loading} className="panel-button">
                  {loading ? "Extraindo..." : "Processar arquivos"}
                </button>
                <button type="button" onClick={handleExport} disabled={!results.length} className="panel-button-secondary">
                  Exportar XLSX
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Campos ativos" subtitle="Lista usada pela extracao automatica quando o documento nao tem marcadores.">
            {effectiveFields.length ? (
              <div className="flex flex-wrap gap-2">
                {effectiveFields.map((field) => (
                  <span key={field} className="rounded-full bg-tide px-3 py-2 text-sm font-semibold text-pine">
                    {field}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink/65">Selecione um template ou informe os campos manualmente.</p>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Revisao da extracao" subtitle="A tabela e editavel antes da exportacao final.">
          {results.length ? (
            <div className="overflow-x-auto rounded-3xl border border-ink/10 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-pine text-white">
                  <tr>
                    <th className="px-4 py-3">Arquivo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Metodo</th>
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, rowIndex) => (
                    <tr key={`${result.filename}-${rowIndex}`} className="border-t border-ink/10">
                      <td className="px-4 py-3 text-ink/70">{result.filename}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={result.status} />
                      </td>
                      <td className="px-4 py-3 text-ink/70">{result.method}</td>
                      {columns.map((column) => (
                        <td key={column} className="px-4 py-3">
                          <input
                            className="panel-input min-w-40"
                            value={result.data[column] || ""}
                            onChange={(event) =>
                              setResults((current) =>
                                current.map((item, index) =>
                                  index === rowIndex
                                    ? {
                                        ...item,
                                        data: {
                                          ...item.data,
                                          [column]: event.target.value
                                        }
                                      }
                                    : item
                                )
                              )
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink/65">Nenhum arquivo processado ainda.</p>
          )}
        </SectionCard>
      </AppShell>
    </AuthGuard>
  );
}
