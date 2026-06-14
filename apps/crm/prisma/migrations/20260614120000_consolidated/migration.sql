-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'RCS');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'OPENED', 'READ', 'CLICKED');

-- CreateEnum
CREATE TYPE "SegmentCreator" AS ENUM ('ai', 'human');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MARKETER', 'ANALYST');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VariantKind" AS ENUM ('CONTROL', 'TREATMENT');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MARKETER',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "organizationId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tags" TEXT[],
    "city" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOrderAt" TIMESTAMP(3),
    "totalOrderValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "channel_preference" "Channel" NOT NULL,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "consentUpdatedAt" TIMESTAMP(3),
    "suppressedAt" TIMESTAMP(3),
    "suppressionReason" TEXT,
    "maxMessagesPerWeek" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "filterRules" JSONB NOT NULL,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" "SegmentCreator" NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "targetingMode" TEXT NOT NULL DEFAULT 'ALL',
    "targetPercentage" INTEGER NOT NULL DEFAULT 100,
    "useRecommendedChannel" BOOLEAN NOT NULL DEFAULT false,
    "useRecommendedSendTime" BOOLEAN NOT NULL DEFAULT false,
    "holdoutPercentage" INTEGER NOT NULL DEFAULT 0,
    "maxBudget" DECIMAL(12,2),
    "failureRateThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "minimumConversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "guardrailPaused" BOOLEAN NOT NULL DEFAULT false,
    "guardrailReason" TEXT,
    "chaosEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chaosFailureRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chaosLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "chaosDuplicateCallbacks" BOOLEAN NOT NULL DEFAULT false,
    "chaosOutOfOrderCallbacks" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignExperiment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "controlAllocation" INTEGER NOT NULL DEFAULT 50,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "VariantKind" NOT NULL,
    "messageTemplate" TEXT NOT NULL,

    CONSTRAINT "CampaignVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "personalizedMessage" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "externalMessageId" TEXT,
    "variantId" TEXT,
    "decisionScore" DOUBLE PRECISION,
    "expectedRevenue" DECIMAL(12,2),
    "churnRisk" DOUBLE PRECISION,
    "recommendedSendHour" INTEGER,
    "actualChannel" "Channel",
    "scheduledFor" TIMESTAMP(3),
    "recommendationReasons" JSONB,
    "isHoldout" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CampaignMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptEvent" (
    "id" TEXT NOT NULL,
    "campaignMessageId" TEXT NOT NULL,
    "event" "MessageStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL,
    "campaignMessageId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "modelVersionId" TEXT,
    "features" JSONB NOT NULL,
    "label" BOOLEAN,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "coefficients" JSONB NOT NULL,
    "calibration" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelDriftReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "populationSize" INTEGER NOT NULL,
    "featureDrift" JSONB NOT NULL,
    "scoreDrift" DOUBLE PRECISION NOT NULL,
    "alert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelDriftReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderRateCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unitCost" DECIMAL(12,6) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "ProviderRateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryCostEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignMessageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(12,6) NOT NULL,
    "totalCost" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryCostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" JSONB,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "AppUser_organizationId_idx" ON "AppUser"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_organizationId_email_key" ON "AppUser"("organizationId", "email");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_organizationId_lastOrderAt_idx" ON "Customer"("organizationId", "lastOrderAt");

-- CreateIndex
CREATE INDEX "Customer_totalOrderValue_idx" ON "Customer"("totalOrderValue");

-- CreateIndex
CREATE INDEX "Customer_city_idx" ON "Customer"("city");

-- CreateIndex
CREATE INDEX "Customer_channel_preference_idx" ON "Customer"("channel_preference");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_externalId_key" ON "Customer"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_email_key" ON "Customer"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_phone_key" ON "Customer"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_customerId_externalOrderId_key" ON "Order"("customerId", "externalOrderId");

-- CreateIndex
CREATE INDEX "Segment_organizationId_createdAt_idx" ON "Segment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_organizationId_createdAt_idx" ON "Campaign"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_segmentId_idx" ON "Campaign"("segmentId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignExperiment_campaignId_key" ON "CampaignExperiment"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignExperiment_status_idx" ON "CampaignExperiment"("status");

-- CreateIndex
CREATE INDEX "CampaignVariant_experimentId_idx" ON "CampaignVariant"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignVariant_experimentId_kind_key" ON "CampaignVariant"("experimentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMessage_externalMessageId_key" ON "CampaignMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "CampaignMessage_campaignId_idx" ON "CampaignMessage"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMessage_status_idx" ON "CampaignMessage"("status");

-- CreateIndex
CREATE INDEX "CampaignMessage_externalMessageId_idx" ON "CampaignMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "CampaignMessage_variantId_idx" ON "CampaignMessage"("variantId");

-- CreateIndex
CREATE INDEX "CampaignMessage_campaignId_decisionScore_idx" ON "CampaignMessage"("campaignId", "decisionScore");

-- CreateIndex
CREATE INDEX "CampaignMessage_campaignId_isHoldout_idx" ON "CampaignMessage"("campaignId", "isHoldout");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMessage_campaignId_customerId_key" ON "CampaignMessage"("campaignId", "customerId");

-- CreateIndex
CREATE INDEX "ReceiptEvent_campaignMessageId_idx" ON "ReceiptEvent"("campaignMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptEvent_campaignMessageId_event_key" ON "ReceiptEvent"("campaignMessageId", "event");

-- CreateIndex
CREATE INDEX "ConversionEvent_customerId_idx" ON "ConversionEvent"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_campaignMessageId_orderId_key" ON "ConversionEvent"("campaignMessageId", "orderId");

-- CreateIndex
CREATE INDEX "FeatureSnapshot_organizationId_capturedAt_idx" ON "FeatureSnapshot"("organizationId", "capturedAt");

-- CreateIndex
CREATE INDEX "FeatureSnapshot_customerId_capturedAt_idx" ON "FeatureSnapshot"("customerId", "capturedAt");

-- CreateIndex
CREATE INDEX "ModelVersion_organizationId_active_idx" ON "ModelVersion"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_organizationId_name_version_key" ON "ModelVersion"("organizationId", "name", "version");

-- CreateIndex
CREATE INDEX "ModelDriftReport_organizationId_createdAt_idx" ON "ModelDriftReport"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderRateCard_organizationId_channel_effectiveFrom_idx" ON "ProviderRateCard"("organizationId", "channel", "effectiveFrom");

-- CreateIndex
CREATE INDEX "DeliveryCostEvent_organizationId_createdAt_idx" ON "DeliveryCostEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryCostEvent_campaignMessageId_provider_key" ON "DeliveryCostEvent"("campaignMessageId", "provider");

-- CreateIndex
CREATE INDEX "OperationalAlert_organizationId_status_createdAt_idx" ON "OperationalAlert"("organizationId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExperiment" ADD CONSTRAINT "CampaignExperiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignVariant" ADD CONSTRAINT "CampaignVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "CampaignExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CampaignVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptEvent" ADD CONSTRAINT "ReceiptEvent_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureSnapshot" ADD CONSTRAINT "FeatureSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureSnapshot" ADD CONSTRAINT "FeatureSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureSnapshot" ADD CONSTRAINT "FeatureSnapshot_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelDriftReport" ADD CONSTRAINT "ModelDriftReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelDriftReport" ADD CONSTRAINT "ModelDriftReport_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRateCard" ADD CONSTRAINT "ProviderRateCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCostEvent" ADD CONSTRAINT "DeliveryCostEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCostEvent" ADD CONSTRAINT "DeliveryCostEvent_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
