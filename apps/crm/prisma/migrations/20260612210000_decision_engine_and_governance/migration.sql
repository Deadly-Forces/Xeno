CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MARKETER', 'ANALYST');
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED');
CREATE TYPE "VariantKind" AS ENUM ('CONTROL', 'TREATMENT');

CREATE TABLE "AppUser" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'MARKETER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "CampaignVariant" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "VariantKind" NOT NULL,
  "messageTemplate" TEXT NOT NULL,
  CONSTRAINT "CampaignVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignMessage"
  ADD COLUMN "variantId" TEXT,
  ADD COLUMN "decisionScore" DOUBLE PRECISION,
  ADD COLUMN "expectedRevenue" DECIMAL(12,2),
  ADD COLUMN "churnRisk" DOUBLE PRECISION,
  ADD COLUMN "recommendedSendHour" INTEGER,
  ADD COLUMN "recommendationReasons" JSONB;

CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");
CREATE UNIQUE INDEX "CampaignExperiment_campaignId_key" ON "CampaignExperiment"("campaignId");
CREATE UNIQUE INDEX "CampaignVariant_experimentId_kind_key" ON "CampaignVariant"("experimentId", "kind");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "CampaignExperiment_status_idx" ON "CampaignExperiment"("status");
CREATE INDEX "CampaignVariant_experimentId_idx" ON "CampaignVariant"("experimentId");
CREATE INDEX "CampaignMessage_variantId_idx" ON "CampaignMessage"("variantId");
CREATE INDEX "CampaignMessage_campaignId_decisionScore_idx" ON "CampaignMessage"("campaignId", "decisionScore");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignExperiment" ADD CONSTRAINT "CampaignExperiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignVariant" ADD CONSTRAINT "CampaignVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "CampaignExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CampaignVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
