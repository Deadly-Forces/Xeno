import { faker } from "@faker-js/faker";
import { CampaignStatus, Channel, MessageStatus, PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { hash } from "argon2";
import { scoreCustomer } from "../lib/decisioning/model";

const localEnv = resolve(process.cwd(), ".env.local");
config({ path: existsSync(localEnv) ? localEnv : resolve(process.cwd(), "../../.env") });

const prisma = new PrismaClient();
const cities = ["New York", "Austin", "Chicago", "Seattle", "Miami"] as const;
const ageGroups = ["18-25", "26-40", "41+"] as const;
const genders = ["female", "male", "non-binary"] as const;
const tags = ["vip", "repeat-buyer", "new", "at-risk", "discount-seeker", "coffee-lover", "beauty", "fashion"] as const;
const products = [
  "Linen Overshirt", "Everyday Tee", "Wide-Leg Jeans", "Canvas Tote", "Running Cap", "Merino Sweater", "Silk Scarf",
  "Vitamin C Serum", "Mineral Sunscreen", "Hydrating Cleanser", "Night Cream", "Lip Tint", "Body Oil", "Clay Mask",
  "Ethiopia Natural Coffee", "Colombia Espresso", "House Blend", "Cold Brew Concentrate", "Ceramic Dripper", "Coffee Filters", "Travel Tumbler"
] as const;

function orderItems(): Array<{ product: string; quantity: number; unitPrice: number }> {
  return faker.helpers.arrayElements(products, { min: 1, max: 2 }).map((product) => ({
    product,
    quantity: 1,
    unitPrice: Number(faker.commerce.price({ min: 10, max: 20 }))
  }));
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development" && process.env.FORCE_SEED !== "true") {
    throw new Error("Seed blocked outside development. Set FORCE_SEED=true to run explicitly.");
  }

  faker.seed(240612);
  const organization = await prisma.organization.upsert({ where: { slug: "xeno" }, update: { name: "Xeno Demo Workspace" }, create: { id: "org_xeno_default", slug: "xeno", name: "Xeno Demo Workspace" } });
  await prisma.auditLog.deleteMany();
  await prisma.receiptEvent.deleteMany();
  await prisma.conversionEvent.deleteMany();
  await prisma.campaignMessage.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.appUser.deleteMany();

  const demoPasswordHash = await hash(process.env.DEMO_PASSWORD ?? "password", { type: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await prisma.appUser.createMany({ data: [
    { organizationId: organization.id, email: "admin@example.com", name: "Avery Admin", passwordHash: demoPasswordHash, role: "ADMIN" },
    { organizationId: organization.id, email: "marketer@example.com", name: "Alex Marketer", passwordHash: demoPasswordHash, role: "MARKETER" },
    { organizationId: organization.id, email: "analyst@example.com", name: "Sam Analyst", passwordHash: demoPasswordHash, role: "ANALYST" }
  ] });
  await prisma.providerRateCard.deleteMany({ where: { organizationId: organization.id } });
  await prisma.providerRateCard.createMany({ data: [
    { organizationId: organization.id, provider: "xeno-simulator", channel: "EMAIL", countryCode: "US", currency: "USD", unitCost: 0.001, effectiveFrom: new Date("2026-01-01") },
    { organizationId: organization.id, provider: "xeno-simulator", channel: "SMS", countryCode: "US", currency: "USD", unitCost: 0.0079, effectiveFrom: new Date("2026-01-01") },
    { organizationId: organization.id, provider: "xeno-simulator", channel: "WHATSAPP", countryCode: "US", currency: "USD", unitCost: 0.015, effectiveFrom: new Date("2026-01-01") },
    { organizationId: organization.id, provider: "xeno-simulator", channel: "RCS", countryCode: "US", currency: "USD", unitCost: 0.012, effectiveFrom: new Date("2026-01-01") }
  ] });

  for (let index = 0; index < 500; index += 1) {
    let orderCount = faker.number.int({ min: 1, max: 50 });
    const lastOrderAt = faker.date.recent({ days: 548 });
    let generatedOrders = Array.from({ length: orderCount }, () => {
      const items = orderItems();
      return {
        items,
        totalAmount: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        status: "PAID",
        createdAt: faker.date.between({
          from: new Date(lastOrderAt.getTime() - 548 * 86_400_000),
          to: lastOrderAt
        })
      };
    });
    if (index === 0) {
      orderCount = 1;
      generatedOrders = [{ items: [{ product: products[0], quantity: 1, unitPrice: 10 }], totalAmount: 10, status: "PAID", createdAt: lastOrderAt }];
    }
    if (index === 1) {
      orderCount = 50;
      generatedOrders = Array.from({ length: orderCount }, (_, orderIndex) => ({
        items: [{ product: products[7], quantity: 1, unitPrice: 40 }],
        totalAmount: 40,
        status: "PAID",
        createdAt: orderIndex === 0 ? lastOrderAt : faker.date.between({ from: new Date(lastOrderAt.getTime() - 548 * 86_400_000), to: lastOrderAt })
      }));
    }
    generatedOrders[0] = { ...generatedOrders[0]!, createdAt: lastOrderAt };
    const totalOrderValue = generatedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const preferredChannel = faker.helpers.weightedArrayElement([
      { value: Channel.WHATSAPP, weight: 4 }, { value: Channel.EMAIL, weight: 3 },
      { value: Channel.SMS, weight: 2 }, { value: Channel.RCS, weight: 1 }
    ]);

    await prisma.customer.create({
      data: {
        externalId: `CUST-${String(index + 1).padStart(4, "0")}`,
        organizationId: organization.id,
        name: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phone: faker.phone.number({ style: "international" }),
        tags: faker.helpers.arrayElements(tags, { min: 1, max: 3 }),
        city: faker.helpers.arrayElement(cities),
        ageGroup: faker.helpers.arrayElement(ageGroups),
        gender: faker.helpers.arrayElement(genders),
        lastOrderAt,
        totalOrderValue,
        totalOrders: orderCount,
        channelPreference: preferredChannel,
        consentStatus: index % 25 === 0 ? "OPTED_OUT" : "OPTED_IN",
        consentUpdatedAt: new Date(),
        suppressedAt: index % 25 === 0 ? new Date() : null,
        suppressionReason: index % 25 === 0 ? "DEMO_UNSUBSCRIBE" : null,
        maxMessagesPerWeek: index % 10 === 0 ? 1 : 3,
        orders: { create: generatedOrders }
      }
    });
  }

  const highValueCount = await prisma.customer.count({ where: { totalOrderValue: { gt: 500 } } });
  const atRiskBefore = new Date(Date.now() - 90 * 86_400_000);
  const atRiskCount = await prisma.customer.count({ where: { lastOrderAt: { lt: atRiskBefore } } });
  const whatsappCount = await prisma.customer.count({ where: { totalOrders: { gt: 2 }, channelPreference: Channel.WHATSAPP } });
  const segments = await Promise.all([
    prisma.segment.create({ data: { organizationId: organization.id, name: "High Value", description: "Customers with lifetime spend above $500", filterRules: { operator: "AND", rules: [{ field: "totalOrderValue", operator: "gt", value: 500 }] }, customerCount: highValueCount, createdBy: "human" } }),
    prisma.segment.create({ data: { organizationId: organization.id, name: "At Risk", description: "No purchase in the last 90 days", filterRules: { operator: "AND", rules: [{ field: "lastOrderAt", operator: "lt", value: atRiskBefore.toISOString() }] }, customerCount: atRiskCount, createdBy: "ai" } }),
    prisma.segment.create({ data: { organizationId: organization.id, name: "WhatsApp Regulars", description: "Repeat customers who prefer WhatsApp", filterRules: { operator: "AND", rules: [{ field: "totalOrders", operator: "gt", value: 2 }, { field: "channel_preference", operator: "eq", value: "WHATSAPP" }] }, customerCount: whatsappCount, createdBy: "human" } })
  ]);

  const customers = await prisma.customer.findMany({ take: 180, select: { id: true, name: true, totalOrderValue: true, totalOrders: true, lastOrderAt: true, channelPreference: true } });
  const campaignStates = [CampaignStatus.COMPLETED, CampaignStatus.RUNNING, CampaignStatus.DRAFT] as const;
  for (let index = 0; index < campaignStates.length; index += 1) {
    const campaign = await prisma.campaign.create({
      data: {
        name: ["VIP Early Access", "Win Back Summer", "Coffee Refill Reminder"][index]!,
        organizationId: organization.id,
        segmentId: segments[index]!.id,
        channel: [Channel.WHATSAPP, Channel.SMS, Channel.EMAIL][index]!,
        messageTemplate: "Hi {{name}}, we picked something special for you.",
        status: campaignStates[index]!,
        aiGenerated: index === 1
      }
    });
    const experiment = index === 0 ? await prisma.campaignExperiment.create({ data: {
      campaignId: campaign.id,
      hypothesis: "A benefit-led personalized message increases conversion rate versus the standard offer.",
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 86_400_000),
      completedAt: new Date(),
      variants: { create: [
        { name: "Control", kind: "CONTROL", messageTemplate: campaign.messageTemplate },
        { name: "AI treatment", kind: "TREATMENT", messageTemplate: "Hi {{name}}, your purchase history suggests this early-access offer is a strong fit." }
      ] }
    }, include: { variants: true } }) : null;
    if (campaign.status === CampaignStatus.DRAFT) continue;
    const cohort = customers.slice(index * 60, index * 60 + 60);
    for (let customerIndex = 0; customerIndex < cohort.length; customerIndex += 1) {
      const customer = cohort[customerIndex]!;
      const decision = scoreCustomer(customer);
      const variant = experiment?.variants.find((item) => item.kind === (customerIndex % 2 === 0 ? "CONTROL" : "TREATMENT"));
      const message = await prisma.campaignMessage.create({ data: {
        campaignId: campaign.id,
        customerId: customer.id,
        personalizedMessage: `Hi ${customer.name}, we picked something special for you.`,
        status: customerIndex < 9 ? MessageStatus.CLICKED : customerIndex < 18 ? MessageStatus.READ : customerIndex < 36 ? MessageStatus.OPENED : customerIndex < 54 ? MessageStatus.DELIVERED : MessageStatus.FAILED,
        sentAt: new Date(),
        deliveredAt: customerIndex < 54 ? new Date() : null,
        openedAt: customerIndex < 36 ? new Date() : null,
        readAt: customerIndex < 18 ? new Date() : null,
        clickedAt: customerIndex < 9 ? new Date() : null,
        externalMessageId: faker.string.uuid()
        ,variantId: variant?.id ?? null
        ,decisionScore: decision.decisionScore
        ,expectedRevenue: decision.expectedRevenue
        ,churnRisk: decision.churnRisk
        ,recommendedSendHour: decision.recommendedSendHour
        ,recommendationReasons: decision.reasons
      }, select: { id: true } });
      const converted = experiment ? (variant?.kind === "TREATMENT" ? customerIndex < 16 : customerIndex < 4) : customerIndex < 6;
      if (converted) {
        const order = await prisma.order.findFirst({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, select: { id: true, totalAmount: true } });
        if (order) await prisma.conversionEvent.create({ data: { campaignMessageId: message.id, customerId: customer.id, orderId: order.id, revenue: order.totalAmount } });
      }
    }
  }
}

main().finally(async () => prisma.$disconnect());
