type StatusBadgeProps = {
  status: string;
};

const palette: Record<string, string> = {
  gerado: "bg-emerald-100 text-emerald-700",
  pendente: "bg-amber-100 text-amber-700",
  erro: "bg-red-100 text-red-700",
  ok: "bg-emerald-100 text-emerald-700",
  ia: "bg-sky-100 text-sky-700"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
        palette[status] || "bg-stone-100 text-stone-700"
      }`}
    >
      {status}
    </span>
  );
}

