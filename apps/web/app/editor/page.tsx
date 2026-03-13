"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SectionCard } from "@/components/section-card";
import { api } from "@/lib/api";
import { MappingLookup, SpreadsheetSummary, TemplateSummary } from "@/lib/types";
import { applyMapping, downloadBlob, readWorkflowState, renderPreviewText } from "@/lib/workflow";

export default function EditorPage() {
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetSummary | null>(null);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [patients, setPatients] = useState<Record<string, string>[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEditorContext() {
      try {
        const workflow = readWorkflowState();
        if (!workflow.spreadsheetId || !workflow.templateId) {
          throw new Error("Fluxo incompleto. Importe uma planilha e salve o mapeamento antes de abrir o editor.");
        }

        const [loadedSpreadsheet, loadedTemplate, loadedMapping] = await Promise.all([
          api.get<SpreadsheetSummary>(`/planilha/${workflow.spreadsheetId}`),
          api.get<TemplateSummary>(`/modelo/${workflow.templateId}`),
          api.get<MappingLookup>(
            `/mapeamento/buscar?spreadsheet_id=${workflow.spreadsheetId}&template_id=${workflow.templateId}`
          )
        ]);

        const activeMapping =
          workflow.mapping && Object.keys(workflow.mapping).length
            ? workflow.mapping
            : {
                ...loadedMapping.suggested_map,
                ...loadedMapping.saved_map
              };

        setSpreadsheet(loadedSpreadsheet);
        setTemplate(loadedTemplate);
        setMapping(activeMapping);
        setPatients(applyMapping(loadedSpreadsheet.rows || [], loadedTemplate.fields, activeMapping));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar editor.");
      } finally {
        setLoading(false);
      }
    }

    loadEditorContext();
  }, []);

  const selectedPatient = patients[selectedIndex] || {};
  const preview = useMemo(
    () => renderPreviewText(template?.text || "", selectedPatient),
    [selectedPatient, template?.text]
  );

  function updatePatientField(field: string, value: string) {
    setPatients((current) =>
      current.map((patient, index) => (index === selectedIndex ? { ...patient, [field]: value } : patient))
    );
  }

  async function generateSingle() {
    if (!template) {
      return;
    }

    try {
      const { blob, filename } = await api.blob("/laudo/gerar", {
        method: "POST",
        body: JSON.stringify({
          template_id: template.id,
          patient_data: selectedPatient
        })
      });
      downloadBlob(blob, filename || "laudo.docx");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao gerar DOCX.");
    }
  }

  async function generateBatch() {
    if (!template) {
      return;
    }

    try {
      const { blob, filename } = await api.blob("/laudo/lote", {
        method: "POST",
        body: JSON.stringify({
          template_id: template.id,
          patients
        })
      });
      downloadBlob(blob, filename || "laudos.zip");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao gerar lote.");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Editor principal"
        description="Revise os dados por paciente, ajuste campos pontuais e gere o DOCX individual ou em lote sem voltar para o Word."
      >
        {loading ? <p className="rounded-3xl bg-white px-5 py-4 text-sm text-ink/60">Carregando editor...</p> : null}
        {error ? <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p> : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            title="Pacientes e formulario"
            subtitle={`Mapeamento ativo com ${Object.keys(mapping).length} coluna(s).`}
            actions={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={generateSingle} disabled={!patients.length} className="panel-button">
                  Gerar DOCX
                </button>
                <button type="button" onClick={generateBatch} disabled={!patients.length} className="panel-button-secondary">
                  Gerar todos
                </button>
              </div>
            }
          >
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
              <div className="space-y-3">
                {patients.length ? (
                  patients.map((patient, index) => (
                    <button
                      key={`${patient.nome || patient.paciente || "paciente"}-${index}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`flex w-full flex-col rounded-3xl border px-4 py-4 text-left transition ${
                        selectedIndex === index ? "border-pine bg-pine text-white" : "border-ink/10 bg-mist/65 text-ink"
                      }`}
                    >
                      <span className="text-sm font-semibold">{patient.nome || patient.paciente || `Paciente ${index + 1}`}</span>
                      <span className={`mt-1 text-xs ${selectedIndex === index ? "text-white/80" : "text-ink/55"}`}>
                        {Object.values(patient).filter(Boolean).length} campos preenchidos
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-ink/65">Nenhum paciente disponivel com o contexto atual.</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {template?.fields.map((field) => (
                  <div key={field}>
                    <label className="mb-2 block text-sm font-semibold text-ink/70">{field}</label>
                    <input
                      className="panel-input"
                      value={selectedPatient[field] || ""}
                      onChange={(event) => updatePatientField(field, event.target.value)}
                    />
                  </div>
                )) || <p className="text-sm text-ink/65">Escolha um modelo para editar os campos.</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Preview em tempo real" subtitle="O preview substitui os marcadores no frontend antes da geracao final.">
            <div className="rounded-[28px] border border-dashed border-pine/25 bg-white p-6">
              <pre className="whitespace-pre-wrap text-sm leading-7 text-ink/80">{preview || "Nenhum template carregado."}</pre>
            </div>
          </SectionCard>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
