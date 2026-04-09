"use client";

import { useEffect, useState } from "react";
import { Download, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { LgpdExportPayload, LgpdTransparency } from "@/lib/types";

function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PrivacidadePage() {
  const router = useRouter();
  const [transparency, setTransparency] = useState<LgpdTransparency | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get<LgpdTransparency>("/lgpd/transparencia")
      .then(setTransparency)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar dados de privacidade.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function exportMyData() {
    setExporting(true);

    try {
      const payload = await api.get<LgpdExportPayload>("/lgpd/me/export");
      const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadJsonFile(`easylaudo_exportacao_lgpd_${now}.json`, payload);
      toast.success("Exportacao LGPD gerada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar seus dados.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteMyData() {
    const confirmation = window.prompt("Para confirmar, digite EXCLUIR");
    if (confirmation !== "EXCLUIR") {
      toast.error("Confirmacao invalida. Nenhuma acao foi executada.");
      return;
    }

    setDeleting(true);

    try {
      await api.delete<{ deleted: boolean }>("/lgpd/me");
      toast.success("Conta removida com sucesso.");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir sua conta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell
        title="Privacidade"
        description="Transparencia LGPD, politica de retencao e direitos do titular no seu workspace."
      >
        <div className="space-y-6">
          <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
            <CardHeader className="border-b border-zinc-200/80">
              <CardTitle>Tratamento de dados</CardTitle>
              <CardDescription>Visao clara das finalidades e do uso com terceiros.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {loading ? (
                <p className="text-sm text-zinc-500">Carregando configuracoes de privacidade...</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {transparency?.processing_purposes.map((purpose) => (
                      <Badge key={purpose} variant="secondary" className="px-3 py-1">
                        {purpose}
                      </Badge>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      <p className="text-sm font-medium text-zinc-950">Uso com terceiros</p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      Provedor: {transparency?.third_party_processing.provider || "N/A"} - IA habilitada: {" "}
                      {transparency?.third_party_processing.ai_extraction_enabled ? "true" : "false"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
              <CardHeader className="border-b border-zinc-200/80">
                <CardTitle>Politica de retencao</CardTitle>
                <CardDescription>Prazos aplicados automaticamente aos seus dados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  <p>Rascunhos do editor: {transparency?.retention_policy.editor_drafts_days ?? "--"} dias</p>
                  <p>Planilhas: {transparency?.retention_policy.spreadsheets_days ?? "--"} dias</p>
                  <p>Laudos: {transparency?.retention_policy.reports_days ?? "--"} dias</p>
                  <p>Arquivos temporarios: {transparency?.retention_policy.temporary_files_days ?? "--"} dias</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-zinc-200/80 bg-white/85">
              <CardHeader className="border-b border-zinc-200/80">
                <CardTitle>Direitos do titular</CardTitle>
                <CardDescription>Exporte seus dados ou solicite eliminacao completa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <Button onClick={exportMyData} loading={exporting} className="w-full">
                  <Download className="h-4 w-4" />
                  Exportar meus dados (JSON)
                </Button>
                <Button variant="destructive" onClick={deleteMyData} loading={deleting} className="w-full">
                  <Trash2 className="h-4 w-4" />
                  Excluir minha conta e dados
                </Button>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-700" />
                    <p className="text-sm font-medium text-amber-900">Acao irreversivel</p>
                  </div>
                  <p className="mt-2 text-sm text-amber-800">
                    A exclusao remove dados de conta, planilhas, mapeamentos, rascunhos e laudos vinculados.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
