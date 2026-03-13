import { ImportWorkflowPage } from "@/components/pages/import-workflow";

export default function ImportarPage({
  searchParams
}: {
  searchParams?: {
    step?: string;
    spreadsheetId?: string;
    templateId?: string;
    mappingId?: string;
  };
}) {
  const step = searchParams?.step;

  return (
    <ImportWorkflowPage
      initialStep={step === "mapping" || step === "editor" ? step : "upload"}
      initialSpreadsheetId={searchParams?.spreadsheetId}
      initialTemplateId={searchParams?.templateId}
      initialMappingId={searchParams?.mappingId}
    />
  );
}
