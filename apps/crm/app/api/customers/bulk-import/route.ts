import { parse } from "csv-parse/sync";
import { z } from "zod";
import { db } from "../../../../lib/db";
import { apiError } from "../../../../lib/http";
import { audit } from "../../../../lib/audit";
import { isResponse, requireRole } from "../../../../lib/rbac";

const importedOrder = z.object({ items: z.array(z.object({ product: z.string().trim().min(1), quantity: z.coerce.number().int().positive(), unitPrice: z.coerce.number().nonnegative() })), totalAmount: z.coerce.number().nonnegative(), status: z.string().trim().min(1), createdAt: z.coerce.date() });
const importedCustomer = z.object({ externalId: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(200), email: z.string().email().nullable().optional(), phone: z.string().trim().max(30).nullable().optional(), tags: z.array(z.string().trim().max(50)).default([]), city: z.string().trim().min(1).max(100), ageGroup: z.string().trim().min(1).max(30), gender: z.string().trim().min(1).max(30), channelPreference: z.enum(["WHATSAPP", "SMS", "EMAIL", "RCS"]), orders: z.array(importedOrder).default([]) });

function normalizeCsv(records: Array<Record<string, string>>): unknown[] {
  return records.map((record) => ({
    ...record,
    email: record.email || null,
    phone: record.phone || null,
    tags: record.tags ? record.tags.split(/[|,]/).map((tag) => tag.trim()).filter(Boolean) : [],
    orders: record.orders ? JSON.parse(record.orders) as unknown : []
  }));
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("ADMIN");
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 10 * 1024 * 1024) return Response.json({ error: "Payload exceeds 10MB" }, { status: 413 });
    const contentType = request.headers.get("content-type") ?? "";
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 10 * 1024 * 1024) return Response.json({ error: "Payload exceeds 10MB" }, { status: 413 });
    const decoded: unknown = contentType.includes("text/csv") ? normalizeCsv(parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>) : JSON.parse(raw);
    const customers = z.array(importedCustomer).max(10_000).parse(decoded);
    for (const customer of customers) {
      const totalOrderValue = customer.orders.reduce((sum, order) => sum + order.totalAmount, 0);
      const lastOrderAt = customer.orders.reduce<Date | null>((latest, order) => !latest || order.createdAt > latest ? order.createdAt : latest, null);
      await db.$transaction(async (transaction) => {
        const persisted = await transaction.customer.upsert({
          where: { organizationId_externalId: { organizationId: actor.organizationId, externalId: customer.externalId } },
          update: { name: customer.name, email: customer.email ?? null, phone: customer.phone ?? null, tags: customer.tags, city: customer.city, ageGroup: customer.ageGroup, gender: customer.gender, channelPreference: customer.channelPreference, totalOrderValue, totalOrders: customer.orders.length, lastOrderAt },
          create: { organizationId: actor.organizationId, externalId: customer.externalId, name: customer.name, email: customer.email ?? null, phone: customer.phone ?? null, tags: customer.tags, city: customer.city, ageGroup: customer.ageGroup, gender: customer.gender, channelPreference: customer.channelPreference, consentStatus: "OPTED_IN", consentUpdatedAt: new Date(), totalOrderValue, totalOrders: customer.orders.length, lastOrderAt },
          select: { id: true }
        });
        await transaction.order.deleteMany({ where: { customerId: persisted.id } });
        if (customer.orders.length > 0) {
          await transaction.order.createMany({ data: customer.orders.map((order) => ({ ...order, customerId: persisted.id })) });
        }
      });
    }
    await audit(actor, "customer.bulk_import", "Customer", undefined, { imported: customers.length });
    return Response.json({ imported: customers.length });
  } catch (error) { return isResponse(error) ? error : apiError(error); }
}
