import { WorkflowEditorLoader } from "@/components/workflow-editor/WorkflowEditorLoader";

export default async function WorkflowEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="h-screen w-screen">
      <WorkflowEditorLoader workflowId={id} />
    </div>
  );
}
