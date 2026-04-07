import cron, { ScheduledTask } from "node-cron";
import { appDb } from "@/db";
import { db } from "@/config/db";
import { workflows } from "@/db/schema/workflows.schema";
import { users } from "@/schema/users.schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { executeWorkflow } from "./engine";

const scheduledTasks = new Map<string, ScheduledTask>();

export async function registerWorkflow(workflowId: string, cronSchedule: string, ownerId: string) {
  // Unregister if already exists
  unregisterWorkflow(workflowId);

  if (!cron.validate(cronSchedule)) {
    console.error(`Invalid cron expression for workflow ${workflowId}: ${cronSchedule}`);
    return;
  }

  const task = cron.schedule(cronSchedule, async () => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, ownerId));
      if (!user) {
        console.error(`Owner ${ownerId} not found for workflow ${workflowId}`);
        return;
      }
      await executeWorkflow(workflowId, "schedule", user as any);
      console.log(`Scheduled workflow ${workflowId} executed successfully`);
    } catch (error: any) {
      console.error(`Scheduled workflow ${workflowId} failed:`, error.message);
    }
  });

  scheduledTasks.set(workflowId, task);
}

export function unregisterWorkflow(workflowId: string) {
  const existing = scheduledTasks.get(workflowId);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(workflowId);
  }
}

export async function loadAllScheduledWorkflows() {
  const enabledWorkflows = await appDb
    .select()
    .from(workflows)
    .where(and(eq(workflows.enabled, true), isNotNull(workflows.cronSchedule)));

  for (const w of enabledWorkflows) {
    if (w.cronSchedule) {
      await registerWorkflow(w.id, w.cronSchedule, w.ownerId);
    }
  }

  console.log(`Loaded ${enabledWorkflows.length} scheduled workflows`);
}
