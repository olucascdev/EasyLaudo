import { ImportWorkflowPage } from "@/components/pages/import-workflow";

export default function ImportarPage({
  searchParams
}: {
  searchParams?: {
    step?: string;
  };
}) {
  return <ImportWorkflowPage initialStep={searchParams?.step === "mapping" ? "mapping" : "upload"} />;
}
