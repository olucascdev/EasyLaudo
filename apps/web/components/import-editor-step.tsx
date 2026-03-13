"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, FileArchive, FileDown, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, buildApiUrl } from "@/lib/api";
import { downloadBlob, getPreviewSegments } from "@/lib/workflow";
import { EditorContext, EditorDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ExportOption = "single" | "zip" | "combined";
type DraftStatus = "idle" | "saving" | "saved" | "error";

type ImportEditorStepProps = {
  context: EditorContext;
  onBackToMapping: () => void;
};

function getPatientName(patient: Record<string, string>, index: number) {
  return patient.nome || patient.paciente || `Paciente ${index + 1}`;
}

function countFilledFields(fields: string[], patient: Record<string, string>) {
  return fields.filter((field) => (patient[field] || "").trim()).length;
}

function formatImportedSummary(count: number) {
  return count === 1
    ? "Da planilha foi identificado 1 registro importado."
    : `Da planilha foram identificados ${count} registros importados.`;
}

export function ImportEditorStep({ context, onBackToMapping }: ImportEditorStepProps) {
  const [patients, setPatients] = useState<Record<string, string>[]>(context.patients);
  const [selectedIndex, setSelectedIndex] = useState(context.selected_index);
  const [generating, setGenerating] = useState<"" | ExportOption>("");
  const [downloadOption, setDownloadOption] = useState<ExportOption>("combined");
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");

  const previewRefs = useRef<Array<HTMLElement | null>>([]);
  const skipAutosaveRef = useRef(true);
  const lastSavedPayloadRef = useRef("");

  useEffect(() => {
    const serialized = JSON.stringify({
      patients: context.patients,
      selected_index: context.selected_index
    });

    skipAutosaveRef.current = true;
    lastSavedPayloadRef.current = serialized;
    setPatients(context.patients);
    setSelectedIndex(context.selected_index);
    setDraftStatus(context.has_draft ? "saved" : "idle");
  }, [context.has_draft, context.mapping_id, context.patients, context.selected_index]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(patients.length - 1, 0)));
  }, [patients.length]);

  const templateFields = context.template.fields || [];
  const selectedPatient = patients[selectedIndex] || {};
  const selectedPatientName = getPatientName(selectedPatient, selectedIndex);
  const selectedPatientFilledFields = countFilledFields(templateFields, selectedPatient);

  const previewPages = useMemo(
    () => patients.map((patient) => getPreviewSegments(context.template.text || "", patient)),
    [context.template.text, patients]
  );

  const exportOptions = useMemo(
    () => [
      {
        id: "single" as const,
        title: "Somente um paciente",
        description: `Baixa apenas o laudo de ${selectedPatientName}.`
      },
      {
        id: "combined" as const,
        title: "Todos juntos",
        description: `Gera 1 DOCX com os ${patients.length} laudos no mesmo arquivo.`
      },
      {
        id: "zip" as const,
        title: "Todos separados",
        description: `Gera um .zip com os ${patients.length} laudos individualmente.`
      }
    ],
    [patients.length, selectedPatientName]
  );

  function getDraftPayload() {
    return {
      patients,
      selected_index: selectedIndex
    };
  }

  async function persistDraft(payload = getDraftPayload()) {
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedPayloadRef.current) {
      return;
    }

    setDraftStatus("saving");

    try {
      await api.put<EditorDraft>(`/mapeamento/${context.mapping_id}/editor-draft`, payload);
      lastSavedPayloadRef.current = serialized;
      setDraftStatus("saved");
    } catch {
      setDraftStatus("error");
    }
  }

  useEffect(() => {
    const payload = getDraftPayload();
    const serialized = JSON.stringify(payload);

    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    if (serialized === lastSavedPayloadRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistDraft(payload);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [context.mapping_id, patients, selectedIndex]);

  useEffect(() => {
    function flushDraft() {
      const payload = getDraftPayload();
      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedPayloadRef.current) {
        return;
      }

      void fetch(buildApiUrl(`/mapeamento/${context.mapping_id}/editor-draft`), {
        method: "PUT",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json"
        },
        body: serialized
      });
    }

    window.addEventListener("beforeunload", flushDraft);
    return () => {
      window.removeEventListener("beforeunload", flushDraft);
    };
  }, [context.mapping_id, patients, selectedIndex]);

  function focusPatient(index: number) {
    setSelectedIndex(index);
    window.requestAnimationFrame(() => {
      previewRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updatePatientField(field: string, value: string) {
    setPatients((current) =>
      current.map((patient, index) => (index === selectedIndex ? { ...patient, [field]: value } : patient))
    );
  }

  function removePatient(index: number) {
    const patientName = getPatientName(patients[index] || {}, index);

    setPatients((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setSelectedIndex((current) => {
      if (current > index) {
        return current - 1;
      }

      if (current === index) {
        return Math.max(0, current - 1);
      }

      return current;
    });

    toast.success(`${patientName} removido da revisao.`);
  }

  async function generateSingle() {
    setGenerating("single");

    try {
      const { blob, filename } = await api.blob("/laudo/gerar", {
        method: "POST",
        body: JSON.stringify({
          template_id: context.template.id,
          patient_data: selectedPatient
        })
      });

      downloadBlob(blob, filename || "laudo.docx");
      toast.success("Laudo individual gerado.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar o DOCX.");
      return false;
    } finally {
      setGenerating("");
    }
  }

  async function generateBatch(mode: "zip" | "combined") {
    setGenerating(mode);

    try {
      const { blob, filename } = await api.blob("/laudo/lote", {
        method: "POST",
        body: JSON.stringify({
          template_id: context.template.id,
          patients,
          mode
        })
      });

      downloadBlob(blob, filename || (mode === "combined" ? "laudos_combinados.docx" : "laudos.zip"));
      toast.success(mode === "combined" ? "Arquivo unico gerado com sucesso." : "Pacote de laudos gerado com sucesso.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar os laudos.");
      return false;
    } finally {
      setGenerating("");
    }
  }

  async function handleExport() {
    const success =
      downloadOption === "single" ? await generateSingle() : await generateBatch(downloadOption === "zip" ? "zip" : "combined");

    if (success) {
      setDownloadDialogOpen(false);
    }
  }

  const draftStatusLabel =
    draftStatus === "saving"
      ? "Salvando rascunho..."
      : draftStatus === "saved"
        ? "Rascunho salvo"
        : draftStatus === "error"
          ? "Falha ao salvar rascunho"
          : "Rascunho pronto";

  return (
    <>
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="max-w-lg rounded-[32px]">
          <DialogHeader>
            <DialogTitle>Escolher download</DialogTitle>
            <DialogDescription>
              Selecione se quer baixar um unico paciente, todos juntos no mesmo arquivo ou todos separados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {exportOptions.map((option) => (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition",
                  downloadOption === option.id
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-zinc-50 hover:border-zinc-400 hover:bg-white"
                )}
              >
                <input
                  type="checkbox"
                  checked={downloadOption === option.id}
                  onChange={() => setDownloadOption(option.id)}
                  className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                />
                <div>
                  <p className={cn("text-sm font-semibold", downloadOption === option.id ? "text-white" : "text-zinc-950")}>
                    {option.title}
                  </p>
                  <p className={cn("mt-1 text-sm", downloadOption === option.id ? "text-zinc-300" : "text-zinc-500")}>
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDownloadDialogOpen(false)} disabled={Boolean(generating)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} loading={generating === downloadOption} disabled={!patients.length}>
              <FileDown className="h-4 w-4" />
              Confirmar download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-start">
        <Button variant="secondary" onClick={onBackToMapping}>
          <ArrowLeftRight className="h-4 w-4" />
          Revisar mapeamento
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-1">
          <Card className="rounded-[32px] border-zinc-200/80 bg-white/90">
            <CardContent className="space-y-4 px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{context.spreadsheet.sheet_name || context.spreadsheet.file_path.split("/").pop()}</Badge>
                <Badge variant="secondary">{context.template.name || "Modelo ativo"}</Badge>
                <Badge variant="secondary">{Object.keys(context.mapping).length} colunas mapeadas</Badge>
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">Resumo</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{formatImportedSummary(patients.length)}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  O editor faz autosave em segundo plano. Saindo desta tela, voce pode retomar pelo fluxo salvo dentro de importar.
                </p>
              </div>
              <p className={cn("text-sm", draftStatus === "error" ? "text-red-600" : "text-zinc-500")}>{draftStatusLabel}</p>
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-zinc-200/80 bg-white/90">
            <CardHeader className="border-b border-zinc-200/80">
              <CardTitle>Importados</CardTitle>
              <CardDescription>Tabela com nome e acoes para editar ou excluir da revisao.</CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              {patients.length ? (
                <div className="overflow-hidden rounded-[28px] border border-zinc-200">
                  <Table>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden md:table-cell">Planilha</TableHead>
                        <TableHead className="hidden md:table-cell">Modelo</TableHead>
                        <TableHead className="text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patients.map((patient, index) => {
                        const active = index === selectedIndex;

                        return (
                          <TableRow
                            key={`${getPatientName(patient, index)}-${index}`}
                            onClick={() => focusPatient(index)}
                            className={cn("cursor-pointer", active && "bg-zinc-50")}
                          >
                            <TableCell className="font-semibold text-zinc-500">{String(index + 1).padStart(2, "0")}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-semibold text-zinc-950">{getPatientName(patient, index)}</p>
                                <p className="text-sm text-zinc-500">
                                  {templateFields.length
                                    ? `${countFilledFields(templateFields, patient)}/${templateFields.length} campos`
                                    : "Sem campos"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-zinc-600 md:table-cell">
                              {context.spreadsheet.sheet_name || context.spreadsheet.file_path.split("/").pop()}
                            </TableCell>
                            <TableCell className="hidden text-zinc-600 md:table-cell">{context.template.name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant={active ? "default" : "secondary"}
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    focusPatient(index);
                                  }}
                                >
                                  <PenLine className="h-4 w-4" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removePatient(index);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Nenhum paciente disponivel.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-zinc-200/80 bg-white/90">
            <CardHeader className="border-b border-zinc-200/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{selectedPatientName}</CardTitle>
                  <CardDescription>
                    Editor na esquerda. O preview do arquivo completo fica na direita e atualiza em tempo real.
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {templateFields.length ? `${selectedPatientFilledFields}/${templateFields.length} campos` : "Sem campos"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-5">
              <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                <p className="text-sm font-semibold text-zinc-950">Exportacao</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  O preview da direita representa o arquivo completo com todos os pacientes em sequencia.
                </p>
                <Button className="mt-4 w-full" onClick={() => setDownloadDialogOpen(true)} disabled={!patients.length}>
                  <FileArchive className="h-4 w-4" />
                  Escolher download
                </Button>
              </div>

              <div className="max-h-[520px] overflow-y-auto pr-1">
                <div className="space-y-4">
                  {templateFields.length ? (
                    templateFields.map((field) => (
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
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-col overflow-hidden rounded-[32px] border-zinc-200/80 bg-white/90">
          <CardHeader className="border-b border-zinc-200/80">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Preview do arquivo final</CardTitle>
                <CardDescription>
                  Um unico preview com todos os pacientes. Cada bloco abaixo representa 1 laudo dentro do mesmo arquivo.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{context.template.name || "Sem modelo"}</Badge>
                <Badge variant="secondary">{patients.length} laudos no mesmo arquivo</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 bg-zinc-100/80 p-4 sm:p-6">
            {context.template.text ? (
              <div className="h-full overflow-y-auto rounded-[28px] border border-zinc-200 bg-zinc-100 p-4 sm:p-8">
                <div className="mx-auto w-full max-w-[860px] bg-white px-6 py-8 shadow-[0_24px_80px_rgba(24,24,27,0.14)] md:px-[72px] md:py-[88px]">
                  {patients.length ? (
                    patients.map((patient, index) => {
                      const active = index === selectedIndex;

                      return (
                        <section
                          key={`preview-${getPatientName(patient, index)}-${index}`}
                          ref={(element) => {
                            previewRefs.current[index] = element;
                          }}
                          onClick={() => setSelectedIndex(index)}
                          className={cn("cursor-pointer scroll-mt-6", index > 0 && "mt-16 border-t border-dashed border-zinc-300 pt-16")}
                        >
                          <div
                            className={cn(
                              "mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition",
                              active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-950"
                            )}
                          >
                            <div>
                              <p className="font-semibold">{getPatientName(patient, index)}</p>
                              <p className={cn("text-sm", active ? "text-zinc-300" : "text-zinc-500")}>
                                {(context.spreadsheet.sheet_name || context.spreadsheet.file_path.split("/").pop())} · {context.template.name}
                              </p>
                            </div>
                            <Badge variant="secondary" className={cn(active && "border border-white/10 bg-white/10 text-white")}>
                              {templateFields.length
                                ? `${countFilledFields(templateFields, patient)}/${templateFields.length} campos`
                                : "Sem campos"}
                            </Badge>
                          </div>

                          <div className="whitespace-pre-wrap font-serif text-[15px] leading-8 text-zinc-800">
                            {previewPages[index]?.map((segment, segmentIndex) =>
                              segment.type === "text" ? (
                                <span key={`text-${index}-${segmentIndex}`}>{segment.value}</span>
                              ) : (
                                <span
                                  key={`field-${index}-${segment.field}-${segmentIndex}`}
                                  className={cn("rounded-md px-1 py-0.5", segment.missing ? "bg-amber-100 text-amber-900" : "text-zinc-900")}
                                >
                                  {segment.value}
                                </span>
                              )
                            )}
                          </div>
                        </section>
                      );
                    })
                  ) : (
                    <div className="flex min-h-[400px] items-center justify-center text-sm text-zinc-500">
                      Nenhum paciente disponivel para preview.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[360px] items-center justify-center rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                Nenhum texto de modelo disponivel para preview.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
