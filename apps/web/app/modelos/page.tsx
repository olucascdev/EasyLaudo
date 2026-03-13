"use client";

import { useEffect, useRef, useState } from "react";
import { PenLine, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { FileDropzone } from "@/components/file-dropzone";
import { TemplateFieldEditor } from "@/components/template-field-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { TemplateProcessResult, TemplateSummary } from "@/lib/types";
import { mergeWorkflowState } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";

type ModalMode = "create" | "edit";

type TemplateEditorDocument = {
  file_path: string;
  text: string;
  detected_fields: string[];
};

export default function ModelosPage() {
  const router = useRouter();
  const uploadRequestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editorDocument, setEditorDocument] = useState<TemplateEditorDocument | null>(null);
  const [confirmedFields, setConfirmedFields] = useState<string[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [loadingEditorId, setLoadingEditorId] = useState("");

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

  async function discardDraft(filePath?: string) {
    if (!filePath) {
      return;
    }

    try {
      await api.delete(`/modelo/rascunho?file_path=${encodeURIComponent(filePath)}`);
    } catch {}
  }

  function resetModalState() {
    uploadRequestId.current += 1;
    setModalMode("create");
    setEditingTemplateId("");
    setName("");
    setFile(null);
    setEditorDocument(null);
    setConfirmedFields([]);
    setProcessing(false);
    setSaving(false);
    setLoadingEditorId("");
  }

  function handleDialogChange(nextOpen: boolean) {
    if (!nextOpen) {
      const draftToDiscard = modalMode === "create" ? editorDocument?.file_path : undefined;
      setOpen(false);
      resetModalState();
      void discardDraft(draftToDiscard);
      return;
    }

    setOpen(true);
  }

  function openCreateModal() {
    resetModalState();
    setModalMode("create");
    setOpen(true);
  }

  async function processSelectedFile(selectedFile: File, previousDraftPath?: string) {
    const requestId = ++uploadRequestId.current;
    setProcessing(true);
    setEditorDocument(null);
    setConfirmedFields([]);

    if (previousDraftPath) {
      void discardDraft(previousDraftPath);
    }

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const processed = await api.upload<TemplateProcessResult>("/modelo/processar-upload", formData);

      if (requestId !== uploadRequestId.current) {
        void discardDraft(processed.file_path);
        return;
      }

      setEditorDocument({
        file_path: processed.file_path,
        text: processed.text,
        detected_fields: processed.detected_fields
      });
      setConfirmedFields(processed.detected_fields);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao processar o documento.");
    } finally {
      if (requestId === uploadRequestId.current) {
        setProcessing(false);
      }
    }
  }

  function handleFilesChange(files: File[]) {
    const nextFile = files[0] || null;
    const previousDraftPath = editorDocument?.file_path;

    setFile(nextFile);

    if (!nextFile) {
      setEditorDocument(null);
      setConfirmedFields([]);
      void discardDraft(previousDraftPath);
      return;
    }

    void processSelectedFile(nextFile, previousDraftPath);
  }

  async function handleSave() {
    if (!editorDocument) {
      return;
    }

    if (modalMode === "create" && !name.trim()) {
      toast.error("Informe um nome para o modelo.");
      return;
    }

    if (!confirmedFields.length) {
      toast.error("Confirme ao menos um campo antes de salvar.");
      return;
    }

    setSaving(true);

    try {
      if (modalMode === "create") {
        const created = await api.post<TemplateSummary>("/modelo", {
          name: name.trim(),
          file_path: editorDocument.file_path,
          fields: confirmedFields
        });

        setTemplates((current) => [created, ...current]);
        mergeWorkflowState({ templateId: created.id });
        toast.success("Modelo salvo.");
      } else {
        const updated = await api.put<TemplateSummary>(`/modelo/${editingTemplateId}/campos`, {
          fields: confirmedFields
        });

        setTemplates((current) =>
          current.map((template) => (template.id === updated.id ? { ...template, fields: updated.fields } : template))
        );
        toast.success("Campos do modelo atualizados.");
      }

      setOpen(false);
      resetModalState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o modelo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(templateId: string) {
    setLoadingEditorId(templateId);

    try {
      const template = await api.get<TemplateSummary>(`/modelo/${templateId}`);
      setModalMode("edit");
      setEditingTemplateId(template.id);
      setName(template.name);
      setFile(null);
      setEditorDocument({
        file_path: template.file_path,
        text: template.text || "",
        detected_fields: template.detected_fields || []
      });
      setConfirmedFields(template.fields);
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar o editor de campos.");
    } finally {
      setLoadingEditorId("");
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

  const canSave = modalMode === "create" ? Boolean(name.trim() && confirmedFields.length) : confirmedFields.length > 0;

  return (
    <AuthGuard>
      <AppShell
        title="Modelos"
        description="Biblioteca de templates DOCX usados na geracao dos laudos. Agora todo upload passa por revisao obrigatoria dos campos antes do salvamento."
        actions={
          <>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Novo Modelo
            </Button>

            <Dialog open={open} onOpenChange={handleDialogChange}>
              <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden rounded-[32px] p-0">
                <div className="flex max-h-[92vh] flex-col">
                  <DialogHeader className="border-b border-zinc-200 px-6 py-5">
                    <DialogTitle>{modalMode === "edit" ? "Editar campos" : "Novo Modelo"}</DialogTitle>
                    <DialogDescription>
                      {modalMode === "edit"
                        ? "Revise os campos confirmados deste modelo e salve sem reenviar o DOCX."
                        : editorDocument
                          ? "A lista final de campos precisa ser confirmada antes do salvamento do modelo."
                          : "Envie um .docx para processar o texto e abrir o editor de campos antes de salvar."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {modalMode === "create" && !editorDocument ? (
                      <div className="space-y-5">
                        <FileDropzone
                          accept={{ "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }}
                          files={file ? [file] : []}
                          onFilesChange={handleFilesChange}
                          title="Arraste o arquivo .docx ou clique para selecionar"
                          description="Depois do processamento, o editor de campos abre automaticamente para revisao obrigatoria."
                          helperText="Upload de um arquivo por vez"
                        />

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                          {processing
                            ? "Processando o documento, detectando marcadores e preparando o editor."
                            : "O salvamento so sera liberado depois que a lista final de campos for confirmada."}
                        </div>
                      </div>
                    ) : editorDocument ? (
                      <div className="space-y-5">
                        {modalMode === "edit" ? (
                          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <p className="text-sm font-semibold text-zinc-950">{name}</p>
                            <p className="mt-1 text-sm text-zinc-500">
                              {confirmedFields.length} campos atuais confirmados
                            </p>
                          </div>
                        ) : null}

                        <TemplateFieldEditor
                          text={editorDocument.text}
                          detectedFields={editorDocument.detected_fields}
                          fields={confirmedFields}
                          onFieldsChange={setConfirmedFields}
                        />

                        {modalMode === "create" ? (
                          <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
                            <div className="space-y-2">
                              <Label htmlFor="template-name">Nome do modelo</Label>
                              <Input
                                id="template-name"
                                placeholder="Ex: Laudo cardiologico"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Skeleton className="h-16 rounded-2xl" />
                        <Skeleton className="h-[420px] rounded-[28px]" />
                      </div>
                    )}
                  </div>

                  <DialogFooter className="border-t border-zinc-200 px-6 py-5">
                    <Button variant="secondary" onClick={() => handleDialogChange(false)}>
                      Fechar
                    </Button>
                    {editorDocument ? (
                      <Button onClick={handleSave} loading={saving} disabled={!canSave}>
                        {modalMode === "edit" ? "Salvar campos" : "Salvar modelo"}
                      </Button>
                    ) : null}
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </>
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
                      <p className="text-sm text-zinc-500">Nenhum campo confirmado.</p>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Button
                      onClick={() => {
                        mergeWorkflowState({ templateId: template.id });
                        toast.success(`Modelo ${template.name} selecionado.`);
                        router.push("/importar?step=mapping");
                      }}
                    >
                      Usar
                    </Button>
                    <Button
                      variant="secondary"
                      loading={loadingEditorId === template.id}
                      onClick={() => handleEdit(template.id)}
                    >
                      <PenLine className="h-4 w-4" />
                      Editar campos
                    </Button>
                    <Button
                      variant="destructive"
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
                Comece subindo um template DOCX, revise os campos detectados no editor e confirme a lista final antes de salvar.
              </p>
              <Button className="mt-6" onClick={openCreateModal}>
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
