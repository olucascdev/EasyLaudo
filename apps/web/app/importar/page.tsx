"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SectionCard } from "@/components/section-card";
import { api } from "@/lib/api";
import { SpreadsheetSummary } from "@/lib/types";
import { mergeWorkflowState } from "@/lib/workflow";

export default function ImportarPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetSummary | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function loadSpreadsheets() {
    api
      .get<SpreadsheetSummary[]>("/planilha/list")
      .then(setSpreadsheets)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Falha ao carregar."));
  }

  useEffect(() => {
    loadSpreadsheets();
  }, []);

  async function selectSpreadsheet(spreadsheetId: string) {
    const loadedSpreadsheet = await api.get<SpreadsheetSummary>(`/planilha/${spreadsheetId}`);
    setSpreadsheet(loadedSpreadsheet);
    mergeWorkflowState({ spreadsheetId });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Selecione um XLSX.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await api.upload<SpreadsheetSummary>("/planilha/upload", formData);
      setSpreadsheet(uploaded);
      mergeWorkflowState({ spreadsheetId: uploaded.id });
      loadSpreadsheets();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Falha ao importar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Importar planilha"
        description="Carregue uma planilha XLSX, valide as colunas detectadas e siga para a etapa de mapeamento."
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="Upload XLSX" subtitle="A API retorna colunas, preview das 5 primeiras linhas e contagem total.">
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                className="panel-input"
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
              {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={loading} className="panel-button">
                  {loading ? "Lendo planilha..." : "Importar planilha"}
                </button>
                {spreadsheet ? (
                  <button type="button" onClick={() => router.push("/mapeamento")} className="panel-button-secondary">
                    Continuar para mapeamento
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Preview" subtitle="As primeiras linhas ajudam a validar o arquivo antes do mapeamento.">
            {spreadsheet ? (
              <div className="space-y-4">
                <p className="text-sm text-ink/65">
                  {spreadsheet.row_count} linhas detectadas. Colunas: {spreadsheet.columns.join(", ")}
                </p>
                <div className="overflow-x-auto rounded-3xl border border-ink/10">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-pine text-white">
                      <tr>
                        {spreadsheet.columns.map((column) => (
                          <th key={column} className="px-4 py-3 font-semibold">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {spreadsheet.preview?.map((row, index) => (
                        <tr key={index} className="border-t border-ink/10 bg-white">
                          {spreadsheet.columns.map((column) => (
                            <td key={column} className="px-4 py-3 text-ink/70">
                              {row[column] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink/65">Nenhuma planilha carregada nesta sessao.</p>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Historico recente" subtitle="Planilhas ja enviadas pela conta.">
          <div className="space-y-3">
            {spreadsheets.length ? (
              spreadsheets.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  onClick={() => selectSpreadsheet(sheet.id)}
                  className="flex w-full flex-col gap-2 rounded-3xl border border-ink/10 bg-white p-4 text-left transition hover:border-pine"
                >
                  <span className="text-sm font-semibold">{sheet.file_path.split("/").pop()}</span>
                  <span className="text-sm text-ink/60">
                    {sheet.row_count} linhas • {sheet.columns.slice(0, 4).join(" • ")}
                  </span>
                </button>
              ))
            ) : (
              <p className="text-sm text-ink/65">Nenhum upload de planilha registrado.</p>
            )}
          </div>
        </SectionCard>
      </AppShell>
    </AuthGuard>
  );
}
