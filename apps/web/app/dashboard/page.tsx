"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileClock, Files, FolderKanban, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { DashboardOverview } from "@/lib/types";
import { downloadBlob } from "@/lib/workflow";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");

  useEffect(() => {
    api
      .get<DashboardOverview>("/dashboard/overview")
      .then(setOverview)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao carregar o dashboard."))
      .finally(() => setLoading(false));
  }, []);

  async function downloadReport(reportId: string) {
    setDownloadingId(reportId);

    try {
      const { blob, filename } = await api.blob(`/laudo/${reportId}/download`);
      downloadBlob(blob, filename || "laudo.docx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar o laudo.");
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Dashboard"
        description="Visao operacional do workspace com geracoes recentes, uploads e acesso rapido aos principais fluxos."
        actions={
          <Button asChild>
            <Link href="/importar">
              Nova importacao
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-4 xl:grid-cols-4">
          {[
            {
              label: "Gerados",
              value: overview?.report_counts.gerado ?? 0,
              description: "Laudos concluidos",
              icon: Files
            },
            {
              label: "Pendentes",
              value: overview?.report_counts.pendente ?? 0,
              description: "Itens em fila",
              icon: FileClock
            },
            {
              label: "Erros",
              value: overview?.report_counts.erro ?? 0,
              description: "Falhas recentes",
              icon: FolderKanban
            },
            {
              label: "Modelos",
              value: overview?.templates.length ?? 0,
              description: "Biblioteca ativa",
              icon: UploadCloud
            }
          ].map((item) => (
            <Card key={item.label} className="rounded-3xl border-zinc-200/80 bg-white/85">
              <CardContent className="flex items-start justify-between p-6">
                <div>
                  <p className="text-sm text-zinc-500">{item.label}</p>
                  <p className="mt-3 text-4xl font-semibold text-zinc-950">{loading ? "--" : item.value}</p>
                  <p className="mt-2 text-sm text-zinc-500">{item.description}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                  <item.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
            <CardHeader className="border-b border-zinc-200/80">
              <CardTitle>Laudos recentes</CardTitle>
              <CardDescription>Ultimas geracoes com download direto do arquivo final.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 rounded-2xl" />
                  <Skeleton className="h-14 rounded-2xl" />
                  <Skeleton className="h-14 rounded-2xl" />
                </div>
              ) : overview?.reports.length ? (
                <div className="overflow-hidden rounded-2xl border border-zinc-200">
                  <Table>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-right">Acao</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.reports.slice(0, 8).map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-zinc-950">
                                {report.patient_data.nome || report.patient_data.paciente || "Paciente sem nome"}
                              </p>
                              <p className="text-sm text-zinc-500">{report.file_path?.split("/").pop() || "Sem arquivo"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={report.status} />
                          </TableCell>
                          <TableCell className="text-zinc-500">{formatDateTime(report.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={downloadingId === report.id}
                              onClick={() => downloadReport(report.id)}
                              disabled={!report.file_path}
                            >
                              Baixar DOCX
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Nenhum laudo gerado ainda.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
            <CardHeader className="border-b border-zinc-200/80">
              <CardTitle>Atalhos</CardTitle>
              <CardDescription>Entradas mais comuns do fluxo principal.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-6">
              {[
                { href: "/modelos", label: "Gerenciar modelos", description: "Suba e organize templates DOCX." },
                { href: "/importar", label: "Importar planilha", description: "Envie um .xlsx e revise o preview." },
                { href: "/editor", label: "Abrir editor", description: "Ajuste pacientes e gere documentos." },
                { href: "/extrair", label: "Extrair para XLSX", description: "Revisao de laudos processados." }
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 transition hover:border-zinc-400 hover:bg-white"
                >
                  <p className="text-sm font-semibold text-zinc-950">{item.label}</p>
                  <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
            <CardHeader className="border-b border-zinc-200/80">
              <CardTitle>Planilhas recentes</CardTitle>
              <CardDescription>Uploads com contagem de pacientes e colunas detectadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {loading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : overview?.spreadsheets.length ? (
                overview.spreadsheets.slice(0, 4).map((sheet) => (
                  <div key={sheet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-950">{sheet.file_path.split("/").pop()}</p>
                      <Badge variant="secondary">{sheet.row_count} pacientes</Badge>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">{formatDate(sheet.created_at)}</p>
                    <p className="mt-3 text-sm text-zinc-500">{sheet.columns.slice(0, 4).join(" · ")}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Nenhuma planilha enviada ainda.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
            <CardHeader className="border-b border-zinc-200/80">
              <CardTitle>Modelos recentes</CardTitle>
              <CardDescription>Templates ativos para novas geracoes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {loading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </>
              ) : overview?.templates.length ? (
                overview.templates.slice(0, 4).map((template) => (
                  <div key={template.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-950">{template.name}</p>
                      <Badge variant="secondary">{template.fields.length} campos</Badge>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">{formatDate(template.created_at)}</p>
                    <p className="mt-3 text-sm text-zinc-500">
                      {template.fields.slice(0, 4).join(" · ") || "Sem campos detectados"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Nenhum modelo salvo ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
