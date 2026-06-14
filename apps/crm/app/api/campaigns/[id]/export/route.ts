import { db } from "../../../../../lib/core/db";
import { isResponse, requireRole } from "../../../../../lib/auth/rbac";

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  let actor; try { actor = await requireRole("ANALYST"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const campaign = await db.campaign.findFirst({ where: { id, organizationId: actor.organizationId }, select: { name: true } });
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
  const messages = await db.campaignMessage.findMany({
    where: { campaignId: id },
    orderBy: { id: "asc" },
    select: { status: true, personalizedMessage: true, sentAt: true, deliveredAt: true, openedAt: true, readAt: true, clickedAt: true, failureReason: true, customer: { select: { externalId: true, name: true, email: true, phone: true } } }
  });
  const rows = [
    ["externalId", "name", "email", "phone", "status", "message", "sentAt", "deliveredAt", "openedAt", "readAt", "clickedAt", "failureReason"],
    ...messages.map((message) => [message.customer.externalId, message.customer.name, message.customer.email, message.customer.phone, message.status, message.personalizedMessage, message.sentAt?.toISOString() ?? null, message.deliveredAt?.toISOString() ?? null, message.openedAt?.toISOString() ?? null, message.readAt?.toISOString() ?? null, message.clickedAt?.toISOString() ?? null, message.failureReason])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const filename = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "campaign";
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}.csv"` } });
}
