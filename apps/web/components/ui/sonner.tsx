"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-zinc-200 !bg-white !text-zinc-950 !shadow-lg",
          title: "!text-sm !font-medium",
          description: "!text-sm !text-zinc-500"
        }
      }}
    />
  );
}
