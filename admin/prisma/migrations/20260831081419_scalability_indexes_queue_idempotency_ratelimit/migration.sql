-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdempotencyKeyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "result" JSONB,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "accountId" TEXT,
    "requestHash" TEXT,
    "status" "IdempotencyKeyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "background_jobs_dedupeKey_key" ON "background_jobs"("dedupeKey");

-- CreateIndex
CREATE INDEX "background_jobs_status_runAt_idx" ON "background_jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "background_jobs_type_idx" ON "background_jobs"("type");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_buckets_bucketKey_key" ON "rate_limit_buckets"("bucketKey");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");

-- CreateIndex
CREATE INDEX "access_grants_vehicleId_revokedAt_idx" ON "access_grants"("vehicleId", "revokedAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetAccountId_createdAt_idx" ON "audit_logs"("targetAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "documents_vehicleId_deletedAt_idx" ON "documents"("vehicleId", "deletedAt");

-- CreateIndex
CREATE INDEX "estimates_workshopId_status_idx" ON "estimates"("workshopId", "status");

-- CreateIndex
CREATE INDEX "expense_records_vehicleId_date_idx" ON "expense_records"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "expense_records_vehicleId_deletedAt_idx" ON "expense_records"("vehicleId", "deletedAt");

-- CreateIndex
CREATE INDEX "fuel_records_vehicleId_date_idx" ON "fuel_records"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "fuel_records_vehicleId_deletedAt_idx" ON "fuel_records"("vehicleId", "deletedAt");

-- CreateIndex
CREATE INDEX "invoices_workshopId_status_idx" ON "invoices"("workshopId", "status");

-- CreateIndex
CREATE INDEX "jobs_workshopId_status_idx" ON "jobs"("workshopId", "status");

-- CreateIndex
CREATE INDEX "notifications_accountId_createdAt_idx" ON "notifications"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_accountId_readAt_idx" ON "notifications"("accountId", "readAt");

-- CreateIndex
CREATE INDEX "odometer_readings_vehicleId_date_idx" ON "odometer_readings"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");

-- CreateIndex
CREATE INDEX "repair_records_vehicleId_date_idx" ON "repair_records"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "repair_records_vehicleId_deletedAt_idx" ON "repair_records"("vehicleId", "deletedAt");

-- CreateIndex
CREATE INDEX "service_records_vehicleId_date_idx" ON "service_records"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "service_records_vehicleId_deletedAt_idx" ON "service_records"("vehicleId", "deletedAt");
