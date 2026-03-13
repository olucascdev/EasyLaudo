"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { User } from "@/lib/types";

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get<User>("/auth/me")
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled && pathname !== "/login") {
          router.replace("/login");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-full border border-pine/15 bg-white px-5 py-3 font-mono text-xs uppercase tracking-[0.35em] text-pine/60">
          Carregando sessao
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
