-- CreateEnum
CREATE TYPE "SignupSource" AS ENUM ('INVITE', 'MECHANIC_LINK', 'CAMPAIGN', 'STORE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "ReportChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'LINK', 'DIRECT_DOWNLOAD');

-- CreateEnum
CREATE TYPE "CurrencySymbolPlacement" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "DistanceUnit" AS ENUM ('KM', 'MI');

-- CreateEnum
CREATE TYPE "VolumeUnit" AS ENUM ('LITRE', 'GALLON');

-- CreateEnum
CREATE TYPE "ConfigObjectType" AS ENUM ('COUNTRY', 'PLAN_PRICE', 'LIST', 'FEATURE_FLAG', 'SUBSCRIPTION_RULES');

-- CreateEnum
CREATE TYPE "ConfigVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REVERTED');

-- CreateEnum
CREATE TYPE "VehicleModelSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('REQUESTED', 'GENERATED', 'DOWNLOADED');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "chasedEngagementAt" TIMESTAMP(3),
ADD COLUMN     "chasedEngagementByAdminId" TEXT,
ADD COLUMN     "signupSource" "SignupSource" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "fileSizeBytes" INTEGER;

-- AlterTable
ALTER TABLE "expense_records" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fuel_records" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "odometer_readings" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "trialDays" INTEGER;

-- AlterTable
ALTER TABLE "repair_records" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "report_recipients" ADD COLUMN     "channel" "ReportChannel" NOT NULL DEFAULT 'EMAIL';

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "format" "ReportFormat" NOT NULL DEFAULT 'PDF';

-- AlterTable
ALTER TABLE "service_records" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "lockedCurrency" TEXT,
ADD COLUMN     "lockedPriceCents" INTEGER;

-- CreateTable
CREATE TABLE "sync_errors" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "deviceInfo" TEXT,
    "operation" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "sync_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "currencySymbolPlacement" "CurrencySymbolPlacement" NOT NULL DEFAULT 'BEFORE',
    "distanceUnit" "DistanceUnit" NOT NULL DEFAULT 'KM',
    "volumeUnit" "VolumeUnit" NOT NULL DEFAULT 'LITRE',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "flagEmoji" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_lists" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_list_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "config_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_submitted_vehicle_models" (
    "id" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "submittedByAccountId" TEXT,
    "status" "VehicleModelSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "mergedIntoMake" TEXT,
    "mergedIntoModel" TEXT,
    "reviewNote" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_submitted_vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "audience" JSONB,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_exposures" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "exposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flag_exposures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_versions" (
    "id" TEXT NOT NULL,
    "objectType" "ConfigObjectType" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ConfigVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "accountsTouchedCount" INTEGER,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByAdminId" TEXT,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_rules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'global',
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "dunningScheduleDays" INTEGER[] DEFAULT ARRAY[1, 3, 7]::INTEGER[],
    "defaultSeatLimit" INTEGER,
    "updatedByAdminId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "requestedByAdminId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'GENERATED',
    "recordCounts" JSONB,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_consents" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "privacy_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_rules" (
    "id" TEXT NOT NULL,
    "dataClass" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "description" TEXT,
    "updatedByAdminId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_purge_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordsRemoved" INTEGER NOT NULL,
    "notes" TEXT,
    "performedByAdminId" TEXT,

    CONSTRAINT "retention_purge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_errors_accountId_idx" ON "sync_errors"("accountId");

-- CreateIndex
CREATE INDEX "sync_errors_occurredAt_idx" ON "sync_errors"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "plan_prices_planId_currency_key" ON "plan_prices"("planId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "config_lists_key_key" ON "config_lists"("key");

-- CreateIndex
CREATE UNIQUE INDEX "config_list_items_listId_code_key" ON "config_list_items"("listId", "code");

-- CreateIndex
CREATE INDEX "user_submitted_vehicle_models_status_idx" ON "user_submitted_vehicle_models"("status");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_exposures_flagId_accountId_key" ON "feature_flag_exposures"("flagId", "accountId");

-- CreateIndex
CREATE INDEX "config_versions_objectType_objectKey_idx" ON "config_versions"("objectType", "objectKey");

-- CreateIndex
CREATE INDEX "config_versions_status_idx" ON "config_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_rules_key_key" ON "subscription_rules"("key");

-- CreateIndex
CREATE INDEX "data_export_requests_accountId_idx" ON "data_export_requests"("accountId");

-- CreateIndex
CREATE INDEX "privacy_consents_accountId_idx" ON "privacy_consents"("accountId");

-- CreateIndex
CREATE INDEX "privacy_consents_purpose_idx" ON "privacy_consents"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "retention_rules_dataClass_key" ON "retention_rules"("dataClass");

-- AddForeignKey
ALTER TABLE "sync_errors" ADD CONSTRAINT "sync_errors_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_list_items" ADD CONSTRAINT "config_list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "config_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_exposures" ADD CONSTRAINT "feature_flag_exposures_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_exposures" ADD CONSTRAINT "feature_flag_exposures_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_consents" ADD CONSTRAINT "privacy_consents_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_purge_logs" ADD CONSTRAINT "retention_purge_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "retention_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
