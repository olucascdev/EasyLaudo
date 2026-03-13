import type { PropsWithChildren, ReactNode } from "react";

type SectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}>;

export function SectionCard({ title, subtitle, actions, className, children }: SectionCardProps) {
  return (
    <section
      className={`rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-panel backdrop-blur ${className || ""}`}
    >
      <div className="mb-5 flex flex-col gap-3 border-b border-ink/10 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-pine/55">{title}</p>
          {subtitle ? <h2 className="mt-2 text-sm text-ink/70">{subtitle}</h2> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
