"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SectionCard } from "@/components/section-card";
import { api } from "@/lib/api";
import { MappingLookup, SpreadsheetSummary, TemplateSummary } from "@/lib/types";
import { mergeWorkflowState, readWorkflowState } from "@/lib/workflow";

export default function MapeamentoPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState("");
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetSummary | null>(null);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadBaseData() {
      try {
        const [loadedTemplates, loadedSpreadsheets] = await Promise.all([
          api.get<TemplateSummary[]>("/modelo/list"),
          api.get<SpreadsheetSummary[]>("/planilha/list")
        ]);

        const workflow = readWorkflowState();
        setTemplates(loadedTemplates);
        setSpreadsheets(loadedSpreadsheets);
        setSelectedTemplateId(workflow.templateId || loadedTemplates[0]?.id || "");
        setSelectedSpreadsheetId(workflow.spreadsheetId || loadedSpreadsheets[0]?.id || "");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar.");
      }
    }

    loadBaseData();
  }, []);

  useEffect(() => {
    if (!selectedSpreadsheetId) {
      return;
    }

    api
      .get<SpreadsheetSummary>(`/planilha/${selectedSpreadsheetId}`)
      .then(setSpreadsheet)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Falha ao carregar planilha."));
  }, [selectedSpreadsheetId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }

    api
      .get<TemplateSummary>(`/modelo/${selectedTemplateId}`)
      .then(setTemplate)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Falha ao carregar modelo."));
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!selectedSpreadsheetId || !selectedTemplateId) {
      return;
    }

    api
      .get<MappingLookup>(`/mapeamento/buscar?spreadsheet_id=${selectedSpreadsheetId}&template_id=${selectedTemplateId}`)
      .then((loaded) => {
        setMapping({
          ...loaded.suggested_map,
          ...loaded.saved_map
        });
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Falha ao carregar mapeamento."));
  }, [selectedSpreadsheetId, selectedTemplateId]);

  const unmappedColumns = useMemo(
    () => spreadsheet?.columns.filter((column) => !mapping[column] || mapping[column] === "__ignore__") || [],
    [mapping, spreadsheet?.columns]
  );

  async function handleSave() {
    if (!selectedSpreadsheetId || !selectedTemplateId) {
      setError("Selecione uma planilha e um modelo.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const cleanedMap = Object.fromEntries(
        Object.entries(mapping).filter(([, field]) => field && field !== "__ignore__")
      );

      await api.post("/mapeamento/salvar", {
        spreadsheet_id: selectedSpreadsheetId,
        template_id: selectedTemplateId,
        map: cleanedMap
      });

      mergeWorkflowState({
        spreadsheetId: selectedSpreadsheetId,
        templateId: selectedTemplateId,
        mapping: cleanedMap
      });
      router.push("/editor");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Mapeamento de colunas"
        description="Escolha uma planilha e um template, aceite as sugestoes automaticas e confirme como cada coluna deve alimentar o laudo."
      >
        {error ? <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p> : null}

        <SectionCard title="Contexto ativo" subtitle="O mapeamento e salvo para a combinacao planilha + modelo.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink/70">Planilha</label>
              <select className="panel-input" value={selectedSpreadsheetId} onChange={(event) => setSelectedSpreadsheetId(event.target.value)}>
                <option value="">Selecione</option>
                {spreadsheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.file_path.split("/").pop()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink/70">Modelo</label>
              <select className="panel-input" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                <option value="">Selecione</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Colunas da planilha" subtitle="Marque como cada coluna deve ser tratada.">
            <div className="space-y-3">
              {spreadsheet?.columns.map((column) => (
                <div key={column} className="grid gap-3 rounded-3xl border border-ink/10 bg-mist/70 p-4 md:grid-cols-[0.95fr_1.05fr] md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-ink">{column}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {mapping[column] && mapping[column] !== "__ignore__" ? "Mapeada" : "Ignorada"}
                    </p>
                  </div>
                  <select
                    className="panel-input"
                    value={mapping[column] || "__ignore__"}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [column]: event.target.value
                      }))
                    }
                  >
                    <option value="__ignore__">Ignorar</option>
                    {template?.fields.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </div>
              )) || <p className="text-sm text-ink/65">Selecione uma planilha para carregar as colunas.</p>}
            </div>
          </SectionCard>

          <SectionCard
            title="Campos do laudo"
            subtitle="Use as sugestoes automaticas como ponto de partida. Salvar leva para o editor."
            actions={
              <button type="button" onClick={handleSave} disabled={saving} className="panel-button">
                {saving ? "Salvando..." : "Salvar e continuar"}
              </button>
            }
          >
            {template ? (
              <div className="space-y-3">
                {template.fields.map((field) => {
                  const mappedColumn = Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0];
                  return (
                    <div key={field} className="rounded-3xl border border-ink/10 bg-white p-4">
                      <p className="text-sm font-semibold text-ink">{field}</p>
                      <p className="mt-1 text-sm text-ink/60">{mappedColumn || "Sem coluna associada"}</p>
                    </div>
                  );
                })}
                <p className="text-xs text-ink/55">
                  {unmappedColumns.length
                    ? `Colunas ainda sem destino: ${unmappedColumns.join(", ")}`
                    : "Todas as colunas relevantes receberam destino."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink/65">Selecione um modelo para listar os campos.</p>
            )}
          </SectionCard>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

