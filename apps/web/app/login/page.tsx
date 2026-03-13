"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSpreadsheet, ScanText, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post(mode === "login" ? "/auth/login" : "/auth/register", {
        email,
        password
      });
      router.replace("/dashboard");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Falha ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden rounded-[32px] border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_28%),linear-gradient(180deg,#18181b_0%,#09090b_100%)] text-white shadow-none">
          <CardContent className="flex h-full flex-col justify-between p-8 md:p-10">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-950">
                  <span className="font-mono text-xs font-semibold">EL</span>
                </div>
                <span className="text-sm font-medium text-zinc-200">EasyLaudo</span>
              </div>

              <h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight tracking-tight">
                Laudos, planilhas e revisao visual no mesmo fluxo.
              </h1>
              <p className="mt-5 max-w-lg text-base text-zinc-400">
                Importe modelos DOCX, mapeie colunas do Excel, revise paciente por paciente e exporte tudo com menos retrabalho.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: FileSpreadsheet,
                  title: "Importe .xlsx",
                  description: "Preview das primeiras linhas e mapeamento controlado."
                },
                {
                  icon: Sparkles,
                  title: "Edite no app",
                  description: "Campos atualizados em tempo real com preview do laudo."
                },
                {
                  icon: ScanText,
                  title: "Volte para XLSX",
                  description: "Extracao reversa para auditoria e revisao clinica."
                }
              ].map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                    <item.icon className="h-5 w-5 text-zinc-100" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm text-zinc-400">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-zinc-200/80 bg-white">
          <CardContent className="p-8 md:p-10">
            <div className="max-w-md">
              <p className="text-sm font-medium text-zinc-500">Acesso ao workspace</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                {mode === "login" ? "Entrar" : "Criar conta"}
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                {mode === "login"
                  ? "Use sua conta para continuar o fluxo atual."
                  : "Crie uma conta para salvar modelos, importacoes e extracoes."}
              </p>
            </div>

            <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)} className="mt-8">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar conta</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

              <Button type="submit" className="w-full" loading={loading}>
                {mode === "login" ? "Entrar na plataforma" : "Criar conta e entrar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
