"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileOutput,
  FileText,
  FileUp,
  LayoutDashboard,
  LogOut,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn, getUserDisplayName } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, matches: ["/dashboard"] },
  { href: "/modelos", label: "Modelos", icon: FileText, matches: ["/modelos"] },
  { href: "/importar", label: "Importar", icon: FileUp, matches: ["/importar", "/mapeamento"] },
  { href: "/extrair", label: "Extrair", icon: FileOutput, matches: ["/extrair"] },
  { href: "/privacidade", label: "Privacidade", icon: ShieldCheck, matches: ["/privacidade"] }
];

type AppShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
};

export function AppShell({ title, description, actions, contentClassName, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = useMemo(() => getUserDisplayName(user?.email), [user?.email]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await api.post("/auth/logout");
      toast.success("Sessao encerrada.");
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sair.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex min-h-screen">
        <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-white/10 bg-zinc-950 px-4 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-950">
                <span className="font-mono text-sm font-semibold">EL</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">EasyLaudo</p>
                <p className="text-xs text-zinc-400">Workspace clinico</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navigation.map((item) => {
              const active = item.matches.some((match) => pathname.startsWith(match));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white",
                    active && "bg-white/10 text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">{displayName}</p>
            <p className="mt-1 text-xs text-zinc-400">{user?.email}</p>
            <Button className="mt-4 w-full justify-center" variant="secondary" loading={loggingOut} onClick={handleLogout}>
              {!loggingOut ? <LogOut className="h-4 w-4" /> : null}
              Sair
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col bg-[radial-gradient(circle_at_top_right,rgba(24,24,27,0.08),transparent_18%),linear-gradient(180deg,#fafafa_0%,#f4f4f5_100%)]">
          <header className="border-b border-zinc-200/80 bg-zinc-50/80 px-8 py-6 backdrop-blur">
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-3xl">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-zinc-400">EasyLaudo</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
                <p className="mt-2 text-sm text-zinc-500">{description}</p>
              </div>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
          </header>

          <main className={cn("flex-1 px-8 py-6", contentClassName)}>{children}</main>
        </div>
      </div>
    </div>
  );
}
