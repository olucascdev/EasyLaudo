"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Database, FileSpreadsheet, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { FileDropzone } from "@/components/file-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { MappingLookup, SpreadsheetSummary, TemplateSummary } from "@/lib/types";
import { mergeWorkflowState, readWorkflowState } from "@/lib/workflow";
import { cn, formatDate } from "@/lib/utils";

type WorkflowStep = "upload" | "mapping";

type ImportWorkflowProps = {
  initialStep?: WorkflowStep;
};

function Stepper({ step }: { step: WorkflowStep }) {
  const steps: Array<{ key: WorkflowStep; title: string; description: string }> = [
    {
      key: "upload",
      title: "Upload",
      description: "Importe a planilha e valide o preview."
    },
    {
      key: "mapping",
      title: "Mapeamento",
      description: "Associe colunas aos campos do modelo."
    }
  ];

  return (
    <Card className="border-zinc-200/80 bg-white/80">
      <CardContent className="grid gap-4 p-4 md:grid-cols-2">
        {steps.map((item, index) => {
          const active = item.key === step;
          const complete = step === "mapping" && item.key === "upload";

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

export function ImportWorkflowPage({ initialStep = "upload" }: ImportWorkflowProps) {
  const router = useRouter();
  const [step, setStep] = useState<WorkflowStep>(initialStep);
  const [file, setFile] = useState<File | null>(null);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetSummary | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [suggestedMap, setSuggestedMap] = useState<Record<string, string>>({});
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [loadingBase, setLoadingBase] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadBase() {
      try {
        const [loadedTemplates, loadedSpreadsheets] = await Promise.all([
          api.get<TemplateSummary[]>("/modelo/list"),
          api.get<SpreadsheetSummary[]>("/planilha/list")
        ]);

        const workflow = readWorkflowState();
        const nextSpreadsheetId = workflow.spreadsheetId || loadedSpreadsheets[0]?.id || "";
        const nextTemplateId = workflow.templateId || loadedTemplates[0]?.id || "";

        setTemplates(loadedTemplates);
        setSpreadsheets(loadedSpreadsheets);
        setSelectedSpreadsheetId(nextSpreadsheetId);
        setSelectedTemplateId(nextTemplateId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar o fluxo.");
      } finally {
        setLoadingBase(false);
      }
    }

    loadBase();
  }, []);

  useEffect(() => {
    if (!selectedSpreadsheetId) {
      setSpreadsheet(null);
      return;
    }

    api
      .get<SpreadsheetSummary>(`/planilha/${selectedSpreadsheetId}`)
      .then((loadedSpreadsheet) => {
        setSpreadsheet(loadedSpreadsheet);
        mergeWorkflowState({ spreadsheetId: loadedSpreadsheet.id });
      })
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
      .then((loadedTemplate) => {
        setTemplate(loadedTemplate);
        mergeWorkflowState({ templateId: loadedTemplate.id });
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar o modelo.");
      });
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!selectedSpreadsheetId || !selectedTemplateId) {
      setMapping({});
      setSuggestedMap({});
      setSavedMap({});
      return;
    }

    api
      .get<MappingLookup>(`/mapeamento/buscar?spreadsheet_id=${selectedSpreadsheetId}&template_id=${selectedTemplateId}`)
      .then((loadedMapping) => {
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
  }, [selectedSpreadsheetId, selectedTemplateId]);

  useEffect(() => {
    if (initialStep === "mapping" && spreadsheet) {
      setStep("mapping");
    }
  }, [initialStep, spreadsheet]);

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
      setSpreadsheet(uploaded);
      setSelectedSpreadsheetId(uploaded.id);
      setSpreadsheets((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
      mergeWorkflowState({ spreadsheetId: uploaded.id });
      toast.success("Planilha importada com sucesso.");
      setStep("mapping");
      router.replace("/importar?step=mapping");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a planilha.");
    } finally {
      setUploading(false);
    }
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

      toast.success("Mapeamento salvo.");
      router.push("/editor");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o mapeamento.");
    } finally {
      setSaving(false);
    }
  }

  const headerAction =
    step === "upload" ? (
      <Button onClick={() => (spreadsheet ? setStep("mapping") : handleUpload())} loading={uploading}>
        {spreadsheet ? "Continuar para mapeamento" : "Importar planilha"}
      </Button>
    ) : (
      <Button onClick={handleSaveMapping} loading={saving}>
        Salvar mapeamento e ir para o Editor
      </Button>
    );

  return (
    <AuthGuard>
      <AppShell
        title="Importar"
        description="Carregue a planilha, valide o preview e associe cada coluna aos campos do modelo antes de abrir o editor."
        actions={headerAction}
      >
        <div className="space-y-6">
          <Stepper step={step} />

          {loadingBase ? (
            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <Skeleton className="h-[420px] rounded-3xl" />
              <Skeleton className="h-[420px] rounded-3xl" />
            </div>
          ) : null}

          {!loadingBase && step === "upload" ? (
            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <Card className="overflow-hidden rounded-3xl border-zinc-200/80 bg-white/85">
                <CardHeader className="border-b border-zinc-200/80">
                  <CardTitle>Passo 1. Upload da planilha</CardTitle>
                  <CardDescription>Arraste seu arquivo .xlsx aqui ou clique para selecionar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <FileDropzone
                    accept={{ "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }}
                    files={file ? [file] : []}
                    onFilesChange={(files) => setFile(files[0] || null)}
                    title="Arraste seu arquivo .xlsx aqui ou clique para selecionar"
                    description="Importamos as primeiras 5 linhas para validar o layout antes do mapeamento."
                    helperText="Suporte a um arquivo por vez"
                  />

                  {spreadsheet ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{spreadsheet.columns.length} colunas detectadas</Badge>
                        <Badge variant="secondary">{spreadsheet.row_count} pacientes encontrados</Badge>
                        <Badge variant="outline">{formatDate(spreadsheet.created_at)}</Badge>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-zinc-200">
                        <Table>
                          <TableHeader className="bg-zinc-50">
                            <TableRow>
                              {spreadsheet.columns.map((column) => (
                                <TableHead key={column}>{column}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(spreadsheet.preview || []).slice(0, 5).map((row, index) => (
                              <TableRow key={`preview-${index}`}>
                                {spreadsheet.columns.map((column) => (
                                  <TableCell key={`${index}-${column}`} className="text-zinc-600">
                                    {row[column] || "-"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <Button className="w-full sm:w-auto" onClick={() => {
                        setStep("mapping");
                        router.replace("/importar?step=mapping");
                      }}>
                        Continuar para mapeamento
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
                <CardHeader className="border-b border-zinc-200/80">
                  <CardTitle>Planilhas recentes</CardTitle>
                  <CardDescription>Retome um upload anterior sem repetir a importacao.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {spreadsheets.length ? (
                    spreadsheets.map((item) => {
                      const active = selectedSpreadsheetId === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedSpreadsheetId(item.id);
                            setStep("upload");
                          }}
                          className={cn(
                            "w-full rounded-2xl border px-4 py-4 text-left transition",
                            active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-zinc-50 hover:border-zinc-400"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{item.file_path.split("/").pop()}</p>
                              <p className={cn("mt-1 text-sm", active ? "text-zinc-300" : "text-zinc-500")}>
                                {item.row_count} linhas
                              </p>
                            </div>
                            <FileSpreadsheet className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-zinc-400")} />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-zinc-500">Nenhuma planilha enviada ainda.</p>
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
                        Destacamos visualmente as associacoes vindas das sugestoes automaticas. Ajuste o que precisar antes de salvar.
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
        </div>
      </AppShell>
    </AuthGuard>
  );
}
