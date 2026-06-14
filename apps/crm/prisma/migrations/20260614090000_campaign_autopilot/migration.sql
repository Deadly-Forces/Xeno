ALTER TABLE "Campaign"
  ADD COLUMN "holdoutPercentage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxBudget" DECIMAL(12,2),
  ADD COLUMN "failureRateThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  ADD COLUMN "minimumConversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "guardrailPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guardrailReason" TEXT,
  ADD COLUMN "chaosEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "chaosFailureRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "chaosLatencyMs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chaosDuplicateCallbacks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "chaosOutOfOrderCallbacks" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CampaignMessage"
  ADD COLUMN "isHoldout" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CampaignMessage_campaignId_isHoldout_idx" ON "CampaignMessage"("campaignId", "isHoldout");
