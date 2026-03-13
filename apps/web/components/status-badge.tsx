import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

const palette: Record<string, "success" | "warning" | "destructive" | "violet" | "blue" | "secondary"> = {
  gerado: "success",
  extraido: "success",
  pendente: "warning",
  aguardando: "warning",
  processando: "secondary",
  erro: "destructive",
  ok: "success",
  ia: "violet",
  template: "blue"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={palette[status.toLowerCase()] || "secondary"}>{status}</Badge>;
}
