import { redirect } from "next/navigation";

export default function MapeamentoPage() {
  redirect("/importar?step=mapping");
}
