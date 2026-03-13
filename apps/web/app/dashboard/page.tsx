"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { DashboardOverview } from "@/lib/types";
import { downloadBlob } from "@/lib/workflow";

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<DashboardOverview>("/dashboard/overview")
      .then(setOverview)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Falha ao carregar."));
  }, []);

  async function downloadReport(reportId: string) {
    const { blob, filename } = await api.blob(`/laudo/${reportId}/download`);
    downloadBlob(blob, filename || "laudo.docx");
  }

  return (
    <AuthGuard>
      <AppShell
        title="Painel operacional"
        description="Acompanhe os laudos gerados, encontre os ultimos arquivos e retome cada etapa do fluxo sem sair do painel."
      >
        {error ? <p className="rounded-3xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p> : null}

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Gerados", value: overview?.report_counts.gerado ?? 0 },
            { label: "Pendentes", value: overview?.report_counts.pendente ?? 0 },
            { label: "Erros", value: overview?.report_counts.erro ?? 0 }
          ].map((item) => (
            <div key={item.label} className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-panel">
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-pine/55">{item.label}</p>
              <p className="mt-3 text-4xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <SectionCard title="Laudos recentes" subtitle="Ultimas geracoes com download direto do DOCX.">
            <div className="space-y-3">
              {overview?.reports.length ? (
                overview.reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col gap-4 rounded-3xl border border-ink/10 bg-mist/70 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold text-ink">
                        {report.patient_data.nome || report.patient_data.paciente || "Paciente sem nome"}
                      </p>
                      <p className="mt-1 text-sm text-ink/60">{new Date(report.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={report.status} />
                      {report.file_path ? (
                        <button type="button" onClick={() => downloadReport(report.id)} className="panel-button-secondary">
                          Baixar DOCX
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/65">Nenhum laudo gerado ainda.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Atalhos" subtitle="Entradas mais comuns do fluxo do MVP.">
            <div className="grid gap-3">
              {[
                { href: "/modelos", label: "Subir novo modelo DOCX" },
                { href: "/importar", label: "Importar planilha XLSX" },
                { href: "/mapeamento", label: "Revisar mapeamento" },
                { href: "/editor", label: "Abrir editor principal" },
                { href: "/extrair", label: "Extrair laudos para planilha" }
              ].map((item) => (
                <Link key={item.href} href={item.href} className="rounded-3xl border border-ink/10 bg-white px-4 py-4 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine">
                  {item.label}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Planilhas recentes" subtitle="Uploads recentes com contagem e colunas detectadas.">
            <div className="space-y-3">
              {overview?.spreadsheets.length ? (
                overview.spreadsheets.map((sheet) => (
                  <div key={sheet.id} className="rounded-3xl border border-ink/10 bg-mist/65 p-4">
                    <p className="text-sm font-semibold">{sheet.file_path.split("/").pop()}</p>
                    <p className="mt-1 text-sm text-ink/65">{sheet.row_count} linhas</p>
                    <p className="mt-2 text-xs text-ink/55">{sheet.columns.slice(0, 5).join(" • ")}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/65">Nenhuma planilha enviada ainda.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Modelos recentes" subtitle="Ultimos templates ativos no workspace da conta.">
            <div className="space-y-3">
              {overview?.templates.length ? (
                overview.templates.map((template) => (
                  <div key={template.id} className="rounded-3xl border border-ink/10 bg-mist/65 p-4">
                    <p className="text-sm font-semibold">{template.name}</p>
                    <p className="mt-2 text-xs text-ink/55">{template.fields.join(" • ") || "Sem campos detectados"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/65">Nenhum modelo salvo ainda.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

