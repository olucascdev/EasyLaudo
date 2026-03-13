"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

type AuthGuardProps = {
  children: ReactNode;
};

type AuthContextValue = {
  user: User | null;
};

const AuthContext = createContext<AuthContextValue>({ user: null });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get<User>("/auth/me")
      .then((loadedUser) => {
        if (!cancelled) {
          setUser(loadedUser);
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
      <div className="flex min-h-screen bg-zinc-950">
        <aside className="hidden h-screen w-[240px] shrink-0 border-r border-white/10 bg-zinc-950 px-4 py-5 xl:flex xl:flex-col">
          <Skeleton className="h-12 rounded-2xl bg-white/10" />
          <div className="mt-8 space-y-2">
            <Skeleton className="h-11 rounded-xl bg-white/10" />
            <Skeleton className="h-11 rounded-xl bg-white/10" />
            <Skeleton className="h-11 rounded-xl bg-white/10" />
          </div>
          <div className="mt-auto">
            <Skeleton className="h-20 rounded-2xl bg-white/10" />
          </div>
        </aside>
        <div className="flex flex-1 flex-col bg-zinc-50 px-8 py-6">
          <Skeleton className="h-20 rounded-3xl" />
          <div className="mt-6 grid flex-1 gap-6 xl:grid-cols-3">
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}
