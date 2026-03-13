"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/api";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/modelos", label: "Modelos" },
  { href: "/importar", label: "Importar" },
  { href: "/mapeamento", label: "Mapeamento" },
  { href: "/editor", label: "Editor" },
  { href: "/extrair", label: "Extrair" }
];

type AppShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AppShell({ title, description, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api.post("/auth/logout");
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-8 overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(16,59,53,0.95),rgba(9,89,77,0.92),rgba(226,169,59,0.88))] p-6 text-mist shadow-panel">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.45em] text-white/70">EasyLaudo</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">{description}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </header>

      <nav className="mb-8 flex flex-wrap gap-3">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-pine text-white" : "bg-white/80 text-ink hover:bg-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="space-y-6">{children}</main>
    </div>
  );
}
