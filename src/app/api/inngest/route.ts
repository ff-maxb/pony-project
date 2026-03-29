import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeWorkflow } from "@/inngest/functions/execute-workflow";
import { cronTriggerCheck } from "@/inngest/functions/cron-workflows";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executeWorkflow, cronTriggerCheck],
});
