"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Database, FilePenLine, FileSpreadsheet, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { FileDropzone } from "@/components/file-dropzone";
import { ImportEditorStep } from "@/components/import-editor-step";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { EditorContext, ImportStep, MappingLookup, SavedImportFlowSummary, SpreadsheetSummary, TemplateSummary } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

type ImportWorkflowProps = {
  initialStep?: ImportStep;
  initialSpreadsheetId?: string;
  initialTemplateId?: string;
  initialMappingId?: string;
};

function Stepper({ step }: { step: ImportStep }) {
  const steps: Array<{ key: ImportStep; title: string; description: string }> = [
    {
      key: "upload",
      title: "Planilhas",
      description: "Envie e gerencie as planilhas importadas."
    },
    {
      key: "mapping",
      title: "Mapeamento",
      description: "Associe colunas aos campos do modelo."
    },
    {
      key: "editor",
      title: "Editor",
      description: "Revise os registros e gere os laudos finais."
    }
  ];

  return (
    <Card className="border-zinc-200/80 bg-white/80">
      <CardContent className="grid gap-4 p-4 md:grid-cols-3">
        {steps.map((item, index) => {
          const currentIndex = steps.findIndex((stepItem) => stepItem.key === step);
          const active = item.key === step;
          const complete = index < currentIndex;

          return (
            <div
              key={item.key}
              className={cn(
                "rounded-2xl border px-4 py-4 transition",
                active && "border-zinc-950 bg-zinc-950 text-white",
                complete && "border-emerald-200 bg-emerald-50 text-emerald-900",
                !active && !complete && "border-zinc-200 bg-zinc-50"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                    active && "bg-white/15 text-white",
                    complete && "bg-emerald-100 text-emerald-700",
                    !active && !complete && "bg-white text-zinc-500"
                  )}
                >
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className={cn("mt-1 text-sm", active ? "text-zinc-300" : complete ? "text-emerald-700" : "text-zinc-500")}>
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ImportWorkflowPage({
  initialStep = "upload",
  initialSpreadsheetId = "",
  initialTemplateId = "",
  initialMappingId = ""
}: ImportWorkflowProps) {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>(initialStep);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteFlowDialogOpen, setDeleteFlowDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [savedFlows, setSavedFlows] = useState<SavedImportFlowSummary[]>([]);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetSummary | null>(null);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [editorContext, setEditorContext] = useState<EditorContext | null>(null);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState(initialSpreadsheetId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const [selectedMappingId, setSelectedMappingId] = useState(initialMappingId);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [suggestedMap, setSuggestedMap] = useState<Record<string, string>>({});
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deletingFlowId, setDeletingFlowId] = useState("");
  const [spreadsheetToDelete, setSpreadsheetToDelete] = useState<SpreadsheetSummary | null>(null);
  const [flowToDelete, setFlowToDelete] = useState<SavedImportFlowSummary | null>(null);

  async function loadBase() {
    setLoadingBase(true);

    try {
      const [loadedTemplates, loadedSpreadsheets, loadedFlows] = await Promise.all([
        api.get<TemplateSummary[]>("/modelo/list"),
        api.get<SpreadsheetSummary[]>("/planilha/list"),
        api.get<SavedImportFlowSummary[]>("/mapeamento/list")
      ]);

      setTemplates(loadedTemplates);
      setSpreadsheets(loadedSpreadsheets);
      setSavedFlows(loadedFlows);

      setSelectedSpreadsheetId((current) => {
        const candidate = current || initialSpreadsheetId;
        if (candidate && loadedSpreadsheets.some((item) => item.id === candidate)) {
          return candidate;
        }
        return loadedSpreadsheets[0]?.id || "";
      });

      setSelectedTemplateId((current) => {
        const candidate = current || initialTemplateId;
        if (candidate && loadedTemplates.some((item) => item.id === candidate)) {
          return candidate;
        }
        return loadedTemplates[0]?.id || "";
      });

      setSelectedMappingId((current) => {
        const candidate = current || initialMappingId;
        if (candidate && loadedFlows.some((item) => item.mapping_id === candidate)) {
          return candidate;
        }
        return "";
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar o fluxo.");
    } finally {
      setLoadingBase(false);
    }
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (step === "editor" && !selectedMappingId && !loadingBase) {
      toast.error("Selecione um fluxo salvo antes de abrir o editor.");
      setStep("upload");
      router.replace("/importar");
    }
  }, [loadingBase, router, selectedMappingId, step]);

  useEffect(() => {
    if (!selectedSpreadsheetId) {
      setSpreadsheet(null);
      return;
    }

    api
      .get<SpreadsheetSummary>(`/planilha/${selectedSpreadsheetId}`)
      .then(setSpreadsheet)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar a planilha.");
      });
  }, [selectedSpreadsheetId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplate(null);
      return;
    }

    api
      .get<TemplateSummary>(`/modelo/${selectedTemplateId}`)
      .then(setTemplate)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar o modelo.");
      });
  }, [selectedTemplateId]);

  useEffect(() => {
    if (step !== "mapping" || !selectedSpreadsheetId || !selectedTemplateId) {
      setMapping({});
      setSuggestedMap({});
      setSavedMap({});
      return;
    }

    api
      .get<MappingLookup>(`/mapeamento/buscar?spreadsheet_id=${selectedSpreadsheetId}&template_id=${selectedTemplateId}`)
      .then((loadedMapping) => {
        setSelectedMappingId(loadedMapping.id || "");
        setSuggestedMap(loadedMapping.suggested_map);
        setSavedMap(loadedMapping.saved_map);
        setMapping({
          ...loadedMapping.suggested_map,
          ...loadedMapping.saved_map
        });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar as sugestoes.");
      });
  }, [selectedSpreadsheetId, selectedTemplateId, step]);

  useEffect(() => {
    if (step !== "editor" || !selectedMappingId) {
      setEditorContext(null);
      return;
    }

    setLoadingEditor(true);
    api
      .get<EditorContext>(`/mapeamento/${selectedMappingId}/editor-context`)
      .then((context) => {
        setEditorContext(context);
        setSelectedSpreadsheetId(context.spreadsheet.id);
        setSelectedTemplateId(context.template.id);
      })
      .catch(async (error) => {
        setEditorContext(null);
        toast.error(error instanceof Error ? error.message : "Falha ao carregar o editor.");
        setStep("upload");
        setSelectedMappingId("");
        router.replace("/importar");
        await loadBase();
      })
      .finally(() => setLoadingEditor(false));
  }, [router, selectedMappingId, step]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (step === "mapping") {
      params.set("step", "mapping");
      if (selectedSpreadsheetId) {
        params.set("spreadsheetId", selectedSpreadsheetId);
      }
      if (selectedTemplateId) {
        params.set("templateId", selectedTemplateId);
      }
      if (selectedMappingId) {
        params.set("mappingId", selectedMappingId);
      }
    }

    if (step === "editor" && selectedMappingId) {
      params.set("step", "editor");
      params.set("mappingId", selectedMappingId);
    }

    const query = params.toString();
    router.replace(query ? `/importar?${query}` : "/importar");
  }, [router, selectedMappingId, selectedSpreadsheetId, selectedTemplateId, step]);

  const mappedCount = useMemo(
    () => Object.values(mapping).filter((value) => value && value !== "__ignore__").length,
    [mapping]
  );

  async function handleUpload() {
    if (!file) {
      toast.error("Selecione um arquivo .xlsx.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await api.upload<SpreadsheetSummary>("/planilha/upload", formData);
      setUploadDialogOpen(false);
      setFile(null);
      setSelectedSpreadsheetId(uploaded.id);
      toast.success("Planilha importada com sucesso.");
      await loadBase();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a planilha.");
    } finally {
      setUploading(false);
    }
  }

  function handleStartMapping(spreadsheetId: string) {
    setSelectedSpreadsheetId(spreadsheetId);
    setStep("mapping");
    setSelectedMappingId("");
  }

  function handleContinueFlow(flow: SavedImportFlowSummary) {
    setSelectedSpreadsheetId(flow.spreadsheet_id);
    setSelectedTemplateId(flow.template_id);
    setSelectedMappingId(flow.mapping_id);
    setStep("editor");
  }

  function handleReviewFlowMapping(flow: SavedImportFlowSummary) {
    setSelectedSpreadsheetId(flow.spreadsheet_id);
    setSelectedTemplateId(flow.template_id);
    setSelectedMappingId(flow.mapping_id);
    setStep("mapping");
  }

  async function handleSaveMapping() {
    if (!selectedSpreadsheetId || !selectedTemplateId) {
      toast.error("Selecione uma planilha e um modelo.");
      return;
    }

    setSaving(true);

    try {
      const cleanedMap = Object.fromEntries(
        Object.entries(mapping).filter(([, field]) => field && field !== "__ignore__")
      );

      const saved = await api.post<{ id: string }>("/mapeamento/salvar", {
        spreadsheet_id: selectedSpreadsheetId,
        template_id: selectedTemplateId,
        map: cleanedMap
      });

      setSelectedMappingId(saved.id);
      setStep("editor");
      toast.success("Mapeamento salvo.");
      await loadBase();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o mapeamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSpreadsheet(spreadsheetId: string) {
    setDeletingId(spreadsheetId);

    try {
      await api.post(`/planilha/${spreadsheetId}/delete`);
      if (selectedSpreadsheetId === spreadsheetId) {
        setSelectedSpreadsheetId("");
      }
      if (spreadsheetToDelete?.id === spreadsheetId) {
        setSpreadsheetToDelete(null);
      }
      setDeleteDialogOpen(false);
      toast.success("Planilha removida.");
      await loadBase();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir a planilha.");
    } finally {
      setDeletingId("");
    }
  }

  async function handleDeleteFlow(mappingId: string) {
    setDeletingFlowId(mappingId);

    try {
      await api.delete(`/mapeamento/${mappingId}`);

      if (selectedMappingId === mappingId) {
        setSelectedMappingId("");
        setEditorContext(null);
        setStep("upload");
      }

      if (flowToDelete?.mapping_id === mappingId) {
        setFlowToDelete(null);
      }

      setDeleteFlowDialogOpen(false);
      toast.success("Fluxo salvo removido.");
      await loadBase();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir o fluxo salvo.");
    } finally {
      setDeletingFlowId("");
    }
  }

  const headerAction =
    step === "upload" ? (
      <Button onClick={() => setUploadDialogOpen(true)}>
        <Upload className="h-4 w-4" />
        Upload planilha
      </Button>
    ) : null;

  return (
    <AuthGuard>
      <AppShell
        title="Importar"
        description="Fluxo unico de importacao, mapeamento e revisao final dos laudos."
        actions={headerAction}
      >
        <div className="space-y-6">
          {step !== "upload" ? (
            <div className="flex justify-start">
              <Button
                variant="secondary"
                onClick={() => {
                  setStep("upload");
                  setEditorContext(null);
                }}
              >
                Voltar para importar
              </Button>
            </div>
          ) : null}

          <Stepper step={step} />

          <Dialog
            open={uploadDialogOpen}
            onOpenChange={(open) => {
              setUploadDialogOpen(open);
              if (!open) {
                setFile(null);
              }
            }}
          >
            <DialogContent className="max-w-2xl rounded-[32px]">
              <DialogHeader>
                <DialogTitle>Upload de planilha</DialogTitle>
                <DialogDescription>Envie um arquivo `.xlsx` para adiciona-lo a lista e depois mapear quando quiser.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <FileDropzone
                  accept={{ "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }}
                  files={file ? [file] : []}
                  onFilesChange={(files) => setFile(files[0] || null)}
                  title="Arraste o arquivo .xlsx ou clique para selecionar"
                  description="A planilha sera validada e listada na tabela principal."
                  helperText="Upload de um arquivo por vez"
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setUploadDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpload} loading={uploading}>
                  Enviar planilha
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open && !deletingId) {
                setSpreadsheetToDelete(null);
              }
            }}
          >
            <DialogContent className="max-w-md rounded-[28px]">
              <DialogHeader>
                <DialogTitle>Excluir planilha</DialogTitle>
                <DialogDescription>Essa acao remove a planilha, os mapeamentos e os rascunhos ligados a ela.</DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">Arquivo</p>
                <p className="mt-1 break-all font-medium text-zinc-950">{spreadsheetToDelete?.file_path.split("/").pop()}</p>
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setSpreadsheetToDelete(null);
                  }}
                  disabled={Boolean(deletingId)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  loading={Boolean(deletingId)}
                  onClick={() => {
                    if (spreadsheetToDelete) {
                      void handleDeleteSpreadsheet(spreadsheetToDelete.id);
                    }
                  }}
                >
                  Confirmar exclusao
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={deleteFlowDialogOpen}
            onOpenChange={(open) => {
              setDeleteFlowDialogOpen(open);
              if (!open && !deletingFlowId) {
                setFlowToDelete(null);
              }
            }}
          >
            <DialogContent className="max-w-md rounded-[28px]">
              <DialogHeader>
                <DialogTitle>Excluir fluxo salvo</DialogTitle>
                <DialogDescription>Essa acao remove o mapeamento salvo e o rascunho do editor, sem apagar a planilha.</DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="font-medium text-zinc-950">{flowToDelete?.spreadsheet_name}</p>
                <p className="mt-1 text-sm text-zinc-500">{flowToDelete?.template_name}</p>
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDeleteFlowDialogOpen(false);
                    setFlowToDelete(null);
                  }}
                  disabled={Boolean(deletingFlowId)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  loading={Boolean(deletingFlowId)}
                  onClick={() => {
                    if (flowToDelete) {
                      void handleDeleteFlow(flowToDelete.mapping_id);
                    }
                  }}
                >
                  Excluir fluxo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {loadingBase ? (
            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <Skeleton className="h-[420px] rounded-3xl" />
              <Skeleton className="h-[420px] rounded-3xl" />
            </div>
          ) : null}

          {!loadingBase && step === "upload" ? (
            <div className="space-y-6">
              <Card className="overflow-hidden rounded-3xl border-zinc-200/80 bg-white/85">
                <CardHeader className="border-b border-zinc-200/80">
                  <CardTitle>Planilhas importadas</CardTitle>
                  <CardDescription>Lista simples das planilhas com acoes diretas.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {spreadsheets.length ? (
                    <Table>
                      <TableHeader className="bg-zinc-50">
                        <TableRow>
                          <TableHead>Nome do arquivo</TableHead>
                          <TableHead className="hidden sm:table-cell">Importado em</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {spreadsheets.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                                  <FileSpreadsheet className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-zinc-950">{item.file_path.split("/").pop()}</p>
                                  <p className="text-xs text-zinc-500 sm:hidden">{formatDate(item.created_at)}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-zinc-600 sm:table-cell">{formatDate(item.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col justify-end gap-2 sm:flex-row">
                                <Button size="sm" onClick={() => handleStartMapping(item.id)}>
                                  Mapear
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  loading={deletingId === item.id}
                                  onClick={() => {
                                    setSpreadsheetToDelete(item);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex min-h-[280px] flex-col items-center justify-center p-10 text-center">
                      <p className="text-lg font-semibold text-zinc-950">Nenhuma planilha importada</p>
                      <p className="mt-2 max-w-md text-sm text-zinc-500">Use o botao de upload para enviar a primeira planilha.</p>
                      <Button className="mt-6" onClick={() => setUploadDialogOpen(true)}>
                        <Upload className="h-4 w-4" />
                        Upload planilha
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-3xl border-zinc-200/80 bg-white/85">
                <CardHeader className="border-b border-zinc-200/80">
                  <CardTitle>Fluxos salvos</CardTitle>
                  <CardDescription>Retome um editor iniciado ou revise o mapeamento de uma combinacao planilha + modelo.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {savedFlows.length ? (
                    <Table>
                      <TableHeader className="bg-zinc-50">
                        <TableRow>
                          <TableHead>Fluxo</TableHead>
                          <TableHead className="hidden lg:table-cell">Atualizado em</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {savedFlows.map((flow) => (
                          <TableRow key={flow.mapping_id}>
                            <TableCell>
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-zinc-950">{flow.spreadsheet_name}</p>
                                  {flow.has_draft ? <Badge variant="secondary">Com rascunho</Badge> : null}
                                  <Badge variant="secondary">{flow.row_count} registros</Badge>
                                </div>
                                <p className="text-sm text-zinc-500">{flow.template_name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-zinc-600 lg:table-cell">{formatDateTime(flow.updated_at)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col justify-end gap-2 sm:flex-row">
                                <Button size="sm" onClick={() => handleContinueFlow(flow)}>
                                  <FilePenLine className="h-4 w-4" />
                                  Continuar
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => handleReviewFlowMapping(flow)}>
                                  Revisar mapeamento
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  loading={deletingFlowId === flow.mapping_id}
                                  onClick={() => {
                                    setFlowToDelete(flow);
                                    setDeleteFlowDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir fluxo
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex min-h-[220px] flex-col items-center justify-center p-10 text-center">
                      <p className="text-lg font-semibold text-zinc-950">Nenhum fluxo salvo ainda</p>
                      <p className="mt-2 max-w-md text-sm text-zinc-500">
                        Salve um mapeamento para liberar o passo 3 do editor e continuar depois deste mesmo ponto.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {!loadingBase && step === "mapping" ? (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
                  <CardHeader className="border-b border-zinc-200/80">
                    <CardTitle>Passo 2. Mapeamento</CardTitle>
                    <CardDescription>Escolha o modelo e confirme como cada coluna alimenta o laudo.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Planilha ativa</Label>
                      <Select value={selectedSpreadsheetId} onValueChange={setSelectedSpreadsheetId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma planilha" />
                        </SelectTrigger>
                        <SelectContent>
                          {spreadsheets.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.file_path.split("/").pop()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
                  <CardHeader className="border-b border-zinc-200/80">
                    <CardTitle>Colunas da planilha</CardTitle>
                    <CardDescription>Cada coluna pode ser mapeada para um campo do modelo ou ignorada.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {spreadsheet?.columns.length ? (
                      spreadsheet.columns.map((column) => {
                        const isSuggested = Boolean(
                          suggestedMap[column] &&
                            mapping[column] === suggestedMap[column] &&
                            savedMap[column] !== suggestedMap[column]
                        );

                        return (
                          <div
                            key={column}
                            className={cn(
                              "grid gap-3 rounded-2xl border px-4 py-4 md:grid-cols-[0.9fr_1.1fr] md:items-center",
                              isSuggested ? "border-blue-200 bg-blue-50/70" : "border-zinc-200 bg-zinc-50"
                            )}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-950">{column}</p>
                                {isSuggested ? <Badge variant="blue">Sugestao automatica</Badge> : null}
                              </div>
                              <p className="text-sm text-zinc-500">
                                {mapping[column] && mapping[column] !== "__ignore__"
                                  ? `Mapeada para ${mapping[column]}`
                                  : "Sem destino definido"}
                              </p>
                            </div>

                            <Select
                              value={mapping[column] || "__ignore__"}
                              onValueChange={(value) =>
                                setMapping((current) => ({
                                  ...current,
                                  [column]: value
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um campo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">Ignorar</SelectItem>
                                {(template?.fields || []).map((field) => (
                                  <SelectItem key={field} value={field}>
                                    {field}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-zinc-500">Selecione uma planilha para mapear as colunas.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
                  <CardHeader className="border-b border-zinc-200/80">
                    <CardTitle>Resumo do modelo</CardTitle>
                    <CardDescription>Campos disponiveis para o laudo selecionado.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-6">
                    {template ? (
                      <>
                        <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                            <Database className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">{template.name}</p>
                            <p className="mt-1 text-sm text-zinc-500">{template.fields.length} campos disponiveis</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {template.fields.map((field) => (
                            <Badge key={field} variant="secondary" className="px-3 py-1">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                        Nenhum modelo selecionado. Crie um modelo em{" "}
                        <Link href="/modelos" className="font-medium text-zinc-950 underline underline-offset-4">
                          /modelos
                        </Link>
                        .
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
                  <CardHeader className="border-b border-zinc-200/80">
                    <CardTitle>Resumo do mapeamento</CardTitle>
                    <CardDescription>Revise as associacoes antes de abrir o editor.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-sm text-zinc-500">Colunas mapeadas</p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950">{mappedCount}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-sm text-zinc-500">Sugestoes aceitas</p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950">
                          {
                            Object.keys(suggestedMap).filter((column) => mapping[column] === suggestedMap[column] && suggestedMap[column] !== "__ignore__")
                              .length
                          }
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-medium text-zinc-950">Preenchimento inteligente</p>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">
                        Destacamos visualmente as associacoes vindas das sugestoes automaticas. Ajuste o que precisar antes de seguir para o editor.
                      </p>
                    </div>

                    <Button className="w-full" onClick={handleSaveMapping} loading={saving}>
                      Salvar mapeamento e ir para o Editor
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {!loadingBase && step === "editor" ? (
            loadingEditor ? (
              <div className="grid gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
                <Skeleton className="h-[780px] rounded-[32px]" />
                <Skeleton className="h-[780px] rounded-[32px]" />
              </div>
            ) : editorContext ? (
              <ImportEditorStep
                context={editorContext}
                onBackToMapping={() => {
                  setStep("mapping");
                }}
              />
            ) : null
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
