"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, FileArchive, FileDown } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { MappingLookup, SpreadsheetSummary, TemplateSummary } from "@/lib/types";
import { applyMapping, downloadBlob, getPreviewSegments, readWorkflowState } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export default function EditorPage() {
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetSummary | null>(null);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [patients, setPatients] = useState<Record<string, string>[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"" | "single" | "batch">("");

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
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar o editor.");
      } finally {
        setLoading(false);
      }
    }

    loadEditorContext();
  }, []);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(patients.length - 1, 0)));
  }, [patients.length]);

  const selectedPatient = patients[selectedIndex] || {};
  const previewSegments = useMemo(() => getPreviewSegments(template?.text || "", selectedPatient), [selectedPatient, template?.text]);

  function updatePatientField(field: string, value: string) {
    setPatients((current) =>
      current.map((patient, index) => (index === selectedIndex ? { ...patient, [field]: value } : patient))
    );
  }

  async function generateSingle() {
    if (!template) {
      return;
    }

    setGenerating("single");

    try {
      const { blob, filename } = await api.blob("/laudo/gerar", {
        method: "POST",
        body: JSON.stringify({
          template_id: template.id,
          patient_data: selectedPatient
        })
      });
      downloadBlob(blob, filename || "laudo.docx");
      toast.success("DOCX gerado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar o DOCX.");
    } finally {
      setGenerating("");
    }
  }

  async function generateBatch() {
    if (!template) {
      return;
    }

    setGenerating("batch");

    try {
      const { blob, filename } = await api.blob("/laudo/lote", {
        method: "POST",
        body: JSON.stringify({
          template_id: template.id,
          patients
        })
      });
      downloadBlob(blob, filename || "laudos.zip");
      toast.success("Lote gerado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar o lote.");
    } finally {
      setGenerating("");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Editor"
        description="Revise paciente por paciente, ajuste os campos e valide o resultado final em uma visualizacao semelhante ao documento real."
        actions={
          <Button asChild variant="secondary">
            <Link href="/importar?step=mapping">
              <ArrowLeftRight className="h-4 w-4" />
              Revisar mapeamento
            </Link>
          </Button>
        }
        contentClassName="flex min-h-0 overflow-hidden px-8 py-6"
      >
        {loading ? (
          <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Skeleton className="h-full rounded-3xl" />
            <Skeleton className="h-full rounded-3xl" />
          </div>
        ) : (
          <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-zinc-200/80 bg-white/90">
              <CardHeader className="border-b border-zinc-200/80">
                <CardTitle>Pacientes</CardTitle>
                <CardDescription>
                  {patients.length} registros importados · {Object.keys(mapping).length} colunas mapeadas
                </CardDescription>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <div className="border-b border-zinc-200/80 px-5 py-4">
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {patients.length ? (
                      patients.map((patient, index) => {
                        const active = index === selectedIndex;
                        return (
                          <button
                            key={`${patient.nome || patient.paciente || "paciente"}-${index}`}
                            type="button"
                            onClick={() => setSelectedIndex(index)}
                            className={cn(
                              "w-full rounded-2xl border px-4 py-3 text-left transition",
                              active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-zinc-50 hover:border-zinc-400"
                            )}
                          >
                            <p className="text-sm font-semibold">
                              {patient.nome || patient.paciente || `Paciente ${index + 1}`}
                            </p>
                            <p className={cn("mt-1 text-xs", active ? "text-zinc-300" : "text-zinc-500")}>
                              {Object.values(patient).filter(Boolean).length} campos preenchidos
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-zinc-500">Nenhum paciente disponivel.</p>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-4">
                    {template?.fields.length ? (
                      template.fields.map((field) => (
                        <div key={field} className="space-y-2">
                          <Label htmlFor={`field-${field}`}>{field}</Label>
                          <Input
                            id={`field-${field}`}
                            value={selectedPatient[field] || ""}
                            onChange={(event) => updatePatientField(field, event.target.value)}
                          />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">Nenhum campo disponivel no modelo atual.</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-200/80 px-5 py-4">
                  <Button className="w-full" onClick={generateSingle} loading={generating === "single"} disabled={!patients.length}>
                    <FileDown className="h-4 w-4" />
                    Gerar DOCX
                  </Button>
                  <Button
                    className="mt-3 w-full"
                    variant="secondary"
                    onClick={generateBatch}
                    loading={generating === "batch"}
                    disabled={!patients.length}
                  >
                    <FileArchive className="h-4 w-4" />
                    Gerar todos (.zip)
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-zinc-200/80 bg-white/90">
              <CardHeader className="border-b border-zinc-200/80">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Preview do laudo</CardTitle>
                    <CardDescription>
                      A substituicao dos marcadores acontece no frontend e responde imediatamente aos ajustes do formulario.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{template?.name || "Sem modelo"}</Badge>
                    <Badge variant="secondary">{spreadsheet?.row_count || 0} pacientes</Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 bg-zinc-100 p-6">
                <div className="h-full overflow-auto rounded-[28px] border border-zinc-200 bg-zinc-100 p-6">
                  <div
                    className="mx-auto bg-white px-[72px] py-[88px] text-[15px] leading-8 text-zinc-800 shadow-[0_24px_80px_rgba(24,24,27,0.14)]"
                    style={{ width: 794, minHeight: 1123 }}
                  >
                    {template?.text ? (
                      <div className="whitespace-pre-wrap font-serif">
                        {previewSegments.map((segment, index) =>
                          segment.type === "text" ? (
                            <span key={`text-${index}`}>{segment.value}</span>
                          ) : (
                            <span
                              key={`field-${segment.field}-${index}`}
                              className={cn(
                                "rounded-md px-1 py-0.5",
                                segment.missing ? "bg-amber-100 text-amber-900" : "text-zinc-900"
                              )}
                            >
                              {segment.value}
                            </span>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="flex min-h-[800px] items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                        Nenhum texto de modelo disponivel para preview.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
