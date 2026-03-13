"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/70 bg-white/80 shadow-panel backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-[linear-gradient(180deg,rgba(16,59,53,0.98),rgba(20,96,81,0.95),rgba(248,112,96,0.92))] p-8 text-white md:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.5em] text-white/60">EasyLaudo</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Laudos clinicos saem do Word e Excel sem virar retrabalho.
          </h1>
          <p className="mt-5 max-w-md text-base text-white/78">
            Importe planilhas, aplique modelos DOCX, revise no editor e volte para XLSX quando precisar auditar.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              "Modelos DOCX com {{campos}}",
              "Geracao individual e em lote",
              "Extracao reversa para XLSX"
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/15 bg-white/10 p-4 text-sm text-white/80">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 md:p-10">
          <div className="mb-8 flex gap-2 rounded-full bg-mist p-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "login" ? "bg-pine text-white" : "text-ink/70"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "register" ? "bg-pine text-white" : "text-ink/70"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink/75">Email</label>
              <input className="panel-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink/75">Senha</label>
              <input
                className="panel-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            <button type="submit" disabled={loading} className="panel-button w-full py-3">
              {loading ? "Processando..." : mode === "login" ? "Entrar na plataforma" : "Criar conta e entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

