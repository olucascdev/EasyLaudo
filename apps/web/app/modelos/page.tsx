"use client";

import { FormEvent, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SectionCard } from "@/components/section-card";
import { api } from "@/lib/api";
import { TemplateSummary } from "@/lib/types";

export default function ModelosPage() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function loadTemplates() {
    api
      .get<TemplateSummary[]>("/modelo/list")
      .then(setTemplates)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Falha ao carregar."));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Informe um nome para o modelo.");
      return;
    }
    if (!file) {
      setError("Selecione um arquivo DOCX.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("file", file);
      const created = await api.upload<TemplateSummary>("/modelo/upload", formData);
      setDetectedFields(created.fields);
      setName("");
      setFile(null);
      loadTemplates();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Falha ao enviar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(templateId: string) {
    await api.delete(`/modelo/${templateId}`);
    loadTemplates();
  }

  return (
    <AuthGuard>
      <AppShell
        title="Modelos de laudo"
        description="Suba templates DOCX, detecte os marcadores dinamicos e mantenha uma biblioteca enxuta de modelos reutilizaveis."
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="Novo modelo" subtitle="O arquivo precisa usar o padrao {{campo}} para os dados variaveis.">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink/70">Nome do modelo</label>
                <input className="panel-input" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink/70">Arquivo DOCX</label>
                <input
                  className="panel-input"
                  type="file"
                  accept=".docx"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </div>
              {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
              <button type="submit" disabled={loading} className="panel-button">
                {loading ? "Enviando..." : "Salvar modelo"}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Campos detectados" subtitle="Conferencia rapida logo apos o upload do modelo.">
            {detectedFields.length ? (
              <div className="flex flex-wrap gap-2">
                {detectedFields.map((field) => (
                  <span key={field} className="rounded-full bg-tide px-3 py-2 text-sm font-semibold text-pine">
                    {field}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink/65">Faça o upload de um modelo para ver os campos extraidos.</p>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Modelos salvos" subtitle="Biblioteca atual da conta com opcao de excluir.">
          <div className="space-y-3">
            {templates.length ? (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col gap-4 rounded-3xl border border-ink/10 bg-mist/70 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold">{template.name}</p>
                    <p className="mt-2 text-sm text-ink/60">
                      {template.fields.length ? template.fields.join(" • ") : "Nenhum campo detectado"}
                    </p>
                  </div>
                  <button type="button" onClick={() => handleDelete(template.id)} className="panel-button-secondary">
                    Excluir
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink/65">Nenhum modelo cadastrado.</p>
            )}
          </div>
        </SectionCard>
      </AppShell>
    </AuthGuard>
  );
}
