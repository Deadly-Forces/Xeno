CREATE TYPE "ConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'UNKNOWN');
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
INSERT INTO "Organization" ("id", "slug", "name") VALUES ('org_xeno_default', 'xeno', 'Xeno Demo Workspace');

ALTER TABLE "AppUser" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Segment" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "organizationId" TEXT;

UPDATE "AppUser" SET "organizationId" = 'org_xeno_default';
UPDATE "AuditLog" SET "organizationId" = 'org_xeno_default';
UPDATE "Customer" SET "organizationId" = 'org_xeno_default';
UPDATE "Segment" SET "organizationId" = 'org_xeno_default';
UPDATE "Campaign" SET "organizationId" = 'org_xeno_default';

ALTER TABLE "AppUser" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Segment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Customer"
  ADD COLUMN "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "consentUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "suppressedAt" TIMESTAMP(3),
  ADD COLUMN "suppressionReason" TEXT,
  ADD COLUMN "maxMessagesPerWeek" INTEGER NOT NULL DEFAULT 3;

UPDATE "Customer" SET "consentStatus" = 'OPTED_IN', "consentUpdatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "Order" ADD COLUMN "externalOrderId" TEXT;
ALTER TABLE "Campaign"
  ADD COLUMN "targetingMode" TEXT NOT NULL DEFAULT 'ALL',
  ADD COLUMN "targetPercentage" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "useRecommendedChannel" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "useRecommendedSendTime" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CampaignMessage"
  ADD COLUMN "actualChannel" "Channel",
  ADD COLUMN "scheduledFor" TIMESTAMP(3);

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

CREATE UNIQUE INDEX "AppUser_organizationId_email_key" ON "AppUser"("organizationId", "email");
DROP INDEX "AppUser_email_key";
CREATE INDEX "AppUser_organizationId_idx" ON "AppUser"("organizationId");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE UNIQUE INDEX "Customer_organizationId_externalId_key" ON "Customer"("organizationId", "externalId");
CREATE UNIQUE INDEX "Customer_organizationId_email_key" ON "Customer"("organizationId", "email");
CREATE UNIQUE INDEX "Customer_organizationId_phone_key" ON "Customer"("organizationId", "phone");
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_externalId_key";
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_email_key";
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_phone_key";
CREATE INDEX "Customer_organizationId_lastOrderAt_idx" ON "Customer"("organizationId", "lastOrderAt");
CREATE UNIQUE INDEX "Order_customerId_externalOrderId_key" ON "Order"("customerId", "externalOrderId");
CREATE INDEX "Segment_organizationId_createdAt_idx" ON "Segment"("organizationId", "createdAt");
CREATE INDEX "Campaign_organizationId_createdAt_idx" ON "Campaign"("organizationId", "createdAt");
CREATE UNIQUE INDEX "ModelVersion_organizationId_name_version_key" ON "ModelVersion"("organizationId", "name", "version");
CREATE INDEX "ModelVersion_organizationId_active_idx" ON "ModelVersion"("organizationId", "active");
CREATE INDEX "FeatureSnapshot_organizationId_capturedAt_idx" ON "FeatureSnapshot"("organizationId", "capturedAt");
CREATE INDEX "FeatureSnapshot_customerId_capturedAt_idx" ON "FeatureSnapshot"("customerId", "capturedAt");
CREATE INDEX "ModelDriftReport_organizationId_createdAt_idx" ON "ModelDriftReport"("organizationId", "createdAt");
CREATE INDEX "ProviderRateCard_organizationId_channel_effectiveFrom_idx" ON "ProviderRateCard"("organizationId", "channel", "effectiveFrom");
CREATE UNIQUE INDEX "DeliveryCostEvent_campaignMessageId_provider_key" ON "DeliveryCostEvent"("campaignMessageId", "provider");
CREATE INDEX "DeliveryCostEvent_organizationId_createdAt_idx" ON "DeliveryCostEvent"("organizationId", "createdAt");
CREATE INDEX "OperationalAlert_organizationId_status_createdAt_idx" ON "OperationalAlert"("organizationId", "status", "createdAt");

ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureSnapshot" ADD CONSTRAINT "FeatureSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureSnapshot" ADD CONSTRAINT "FeatureSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureSnapshot" ADD CONSTRAINT "FeatureSnapshot_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModelDriftReport" ADD CONSTRAINT "ModelDriftReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelDriftReport" ADD CONSTRAINT "ModelDriftReport_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderRateCard" ADD CONSTRAINT "ProviderRateCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryCostEvent" ADD CONSTRAINT "DeliveryCostEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryCostEvent" ADD CONSTRAINT "DeliveryCostEvent_campaignMessageId_fkey" FOREIGN KEY ("campaignMessageId") REFERENCES "CampaignMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
