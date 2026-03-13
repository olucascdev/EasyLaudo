"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Play, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { FileDropzone } from "@/components/file-dropzone";
import { StatusBadge } from "@/components/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ExtractionResult, TemplateSummary } from "@/lib/types";
import { downloadBlob } from "@/lib/workflow";

export default function ExtrairPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [manualFields, setManualFields] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api
      .get<TemplateSummary[]>("/modelo/list")
      .then(setTemplates)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao carregar os modelos."))
      .finally(() => setLoading(false));
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

  const queue = useMemo(() => {
    const resultMap = new Map(results.map((result) => [result.filename, result.status]));

    return files.map((file) => ({
      name: file.name,
      status: processing ? "processando" : resultMap.get(file.name) || "aguardando"
    }));
  }, [files, processing, results]);

  async function handleProcess() {
    if (!files.length) {
      toast.error("Selecione ao menos um arquivo .docx.");
      return;
    }

    setProcessing(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("fields", JSON.stringify(effectiveFields));
      const extracted = await api.upload<ExtractionResult[]>("/extracao/processar", formData);
      setResults(extracted);
      toast.success("Arquivos processados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao processar os arquivos.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleExport() {
    setExporting(true);

    try {
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
      toast.success("Planilha exportada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar a planilha.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Extrair"
        description="Envie laudos DOCX, revise os dados extraidos e exporte a consolidacao final para .xlsx."
        actions={
          <Button onClick={handleProcess} loading={processing}>
            <Play className="h-4 w-4" />
            Processar arquivos
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
              <CardHeader className="border-b border-zinc-200/80">
                <CardTitle>Upload de laudos</CardTitle>
                <CardDescription>Arraste um ou mais arquivos .docx para iniciar a extracao.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <FileDropzone
                  accept={{ "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }}
                  files={files}
                  onFilesChange={setFiles}
                  title="Arraste arquivos .docx aqui ou clique para selecionar"
                  description="O processamento pode usar o template selecionado ou a lista manual de campos."
                  helperText="Multiplos arquivos suportados"
                  multiple
                />

                <div className="space-y-3">
                  {queue.length ? (
                    queue.map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <p className="text-sm font-medium text-zinc-950">{item.name}</p>
                        <StatusBadge status={item.status} />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">Nenhum arquivo adicionado ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
              <CardHeader className="border-b border-zinc-200/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>Configuracao da extracao</CardTitle>
                    <CardDescription>Use um template salvo ou informe os campos manualmente.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {loading ? <Skeleton className="h-40 rounded-3xl" /> : null}

                {!loading ? (
                  <>
                    <div className="space-y-2">
                      <Label>Modelo de referencia</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem template</SelectItem>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Campos manuais</Label>
                      <Textarea
                        placeholder="nome, data_atendimento, pressao_arterial"
                        value={manualFields}
                        onChange={(event) => setManualFields(event.target.value)}
                      />
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-zinc-700" />
                        <p className="text-sm font-medium text-zinc-950">Campos ativos</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {effectiveFields.length ? (
                          effectiveFields.map((field) => (
                            <Badge key={field} variant="secondary" className="px-3 py-1">
                              {field}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-zinc-500">Nenhum campo manual definido.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
            <CardHeader className="border-b border-zinc-200/80">
              <CardTitle>Tabela de revisao</CardTitle>
              <CardDescription>Edite qualquer celula antes da exportacao final.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {results.length ? (
                <>
                  <div className="overflow-hidden rounded-2xl border border-zinc-200">
                    <Table>
                      <TableHeader className="bg-zinc-50">
                        <TableRow>
                          <TableHead>Origem</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Arquivo</TableHead>
                          {columns.map((column) => (
                            <TableHead key={column}>{column}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result, rowIndex) => (
                          <TableRow key={`${result.filename}-${rowIndex}`}>
                            <TableCell>
                              <Badge variant={result.method.toLowerCase().includes("ia") ? "violet" : "blue"}>
                                {result.method.toLowerCase().includes("ia") ? "Via IA" : "Template"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={result.status} />
                            </TableCell>
                            <TableCell className="font-medium text-zinc-950">{result.filename}</TableCell>
                            {columns.map((column) => (
                              <TableCell key={column}>
                                <input
                                  className="w-full min-w-40 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
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
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end border-t border-zinc-200 pt-4">
                    <Button onClick={handleExport} loading={exporting}>
                      Exportar .xlsx
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center">
                  <p className="text-sm font-medium text-zinc-950">Nenhum laudo processado ainda.</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Depois do processamento, a tabela aparece aqui com colunas dinamicas e edicao inline.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
