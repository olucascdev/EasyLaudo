"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { FileDropzone } from "@/components/file-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { TemplateSummary } from "@/lib/types";
import { mergeWorkflowState } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";

export default function ModelosPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [savedTemplate, setSavedTemplate] = useState<TemplateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  function loadTemplates() {
    api
      .get<TemplateSummary[]>("/modelo/list")
      .then(setTemplates)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao carregar os modelos."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Informe um nome para o modelo.");
      return;
    }
    if (!file) {
      toast.error("Selecione um arquivo DOCX.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("file", file);
      const created = await api.upload<TemplateSummary>("/modelo/upload", formData);
      setSavedTemplate(created);
      mergeWorkflowState({ templateId: created.id });
      loadTemplates();
      toast.success("Modelo salvo.");
    } catch (submissionError) {
      toast.error(submissionError instanceof Error ? submissionError.message : "Falha ao salvar o modelo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(templateId: string) {
    if (!window.confirm("Excluir este modelo?")) {
      return;
    }

    setDeletingId(templateId);

    try {
      await api.delete(`/modelo/${templateId}`);
      setTemplates((current) => current.filter((item) => item.id !== templateId));
      toast.success("Modelo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir o modelo.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Modelos"
        description="Biblioteca de templates DOCX usados na geracao dos laudos. Mantenha poucos modelos, bem nomeados e reutilizaveis."
        actions={
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) {
                setName("");
                setFile(null);
                setSavedTemplate(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Novo Modelo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl rounded-[28px]">
              <DialogHeader>
                <DialogTitle>{savedTemplate ? "Modelo salvo" : "Novo Modelo"}</DialogTitle>
                <DialogDescription>
                  {savedTemplate
                    ? "Os campos abaixo foram detectados no upload e o modelo ja esta pronto para uso."
                    : "Envie um .docx com marcadores no formato {{campo}}."}
                </DialogDescription>
              </DialogHeader>

              {savedTemplate ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-semibold text-zinc-950">{savedTemplate.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {savedTemplate.fields.length} campos detectados em {formatDate(savedTemplate.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {savedTemplate.fields.length ? (
                      savedTemplate.fields.map((field) => (
                        <Badge key={field} variant="secondary" className="px-3 py-1">
                          {field}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">Nenhum marcador foi encontrado no documento.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Nome do modelo</Label>
                    <Input
                      id="template-name"
                      placeholder="Ex: Laudo cardiologico"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>

                  <FileDropzone
                    accept={{ "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }}
                    files={file ? [file] : []}
                    onFilesChange={(files) => setFile(files[0] || null)}
                    title="Arraste o arquivo .docx ou clique para selecionar"
                    description="Depois do salvamento exibimos os campos detectados e atualizamos a biblioteca."
                    helperText="Upload de um arquivo por vez"
                  />
                </div>
              )}

              <DialogFooter>
                {savedTemplate ? (
                  <>
                    <Button variant="secondary" onClick={() => setOpen(false)}>
                      Fechar
                    </Button>
                    <Button
                      onClick={() => {
                        setOpen(false);
                        router.push("/importar?step=mapping");
                      }}
                    >
                      Usar este modelo
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleSubmit} loading={submitting}>
                    Salvar modelo
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {loading ? (
          <div className="grid gap-6 xl:grid-cols-3">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        ) : templates.length ? (
          <div className="grid gap-6 xl:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="rounded-3xl border-zinc-200/80 bg-white/85">
                <CardHeader className="border-b border-zinc-200/80">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{template.name}</CardTitle>
                      <CardDescription>{formatDate(template.created_at)}</CardDescription>
                    </div>
                    <Badge variant="secondary">{template.fields.length} campos</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="flex flex-wrap gap-2">
                    {template.fields.length ? (
                      template.fields.map((field) => (
                        <Badge key={field} variant="outline" className="px-3 py-1">
                          {field}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">Nenhum campo detectado.</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        mergeWorkflowState({ templateId: template.id });
                        toast.success(`Modelo ${template.name} selecionado.`);
                        router.push("/importar?step=mapping");
                      }}
                    >
                      Usar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      loading={deletingId === template.id}
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Deletar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-3xl border-dashed border-zinc-300 bg-white/80">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
              <p className="text-lg font-semibold text-zinc-950">Nenhum modelo salvo</p>
              <p className="mt-2 max-w-md text-sm text-zinc-500">
                Comece subindo um template DOCX com marcadores no formato {"{{campo}}"}. A biblioteca fica organizada em cards e pronta para reutilizacao.
              </p>
              <Button className="mt-6" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Novo Modelo
              </Button>
            </CardContent>
          </Card>
        )}
      </AppShell>
    </AuthGuard>
  );
}
