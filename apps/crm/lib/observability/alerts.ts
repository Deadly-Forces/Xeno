import type { Prisma } from "@prisma/client";
import { db } from "../core/db";
import { env } from "../core/env";

export async function createOperationalAlert(organizationId: string, severity: "info" | "warning" | "critical", source: string, title: string, details?: Prisma.InputJsonValue): Promise<void> {
  const alert = await db.operationalAlert.create({ data: { organizationId, severity, source, title, ...(details !== undefined ? { details } : {}) } });
  if (!env.ALERT_WEBHOOK_URL) return;
  try {
    const response = await fetch(env.ALERT_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: alert.id, severity, source, title, details, createdAt: alert.createdAt }) });
    if (response.ok) await db.operationalAlert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } });
  } catch (error) { console.error(JSON.stringify({ level: "error", event: "alert_notification_failed", alertId: alert.id, error: error instanceof Error ? error.message : "unknown" })); }
}
