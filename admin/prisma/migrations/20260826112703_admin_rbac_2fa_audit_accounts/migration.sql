/*
  Warnings:

  - Added the required column `updatedAt` to the `admin_users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'SUPPORT', 'FINANCE', 'READ');

-- CreateEnum
CREATE TYPE "SuspensionReason" AS ENUM ('FRAUD_SUSPECTED', 'PAYMENT_DISPUTE', 'ABUSE_REPORTED', 'TOS_VIOLATION', 'USER_REQUESTED', 'OTHER');

-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('SELF', 'ADMIN');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "chasedNoVehicleAt" TIMESTAMP(3),
ADD COLUMN     "chasedNoVehicleByAdminId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByAdminId" TEXT,
ADD COLUMN     "lastApiRequestAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoAccountId" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedByAdminId" TEXT,
ADD COLUMN     "suspendedNote" TEXT,
ADD COLUMN     "suspendedReason" "SuspensionReason";

-- AlterTable
-- Note: updatedAt gets a DEFAULT CURRENT_TIMESTAMP (not in Prisma's generated
-- SQL) purely so this ALTER succeeds against the already-seeded admin_users
-- row; Prisma's @updatedAt keeps setting it going forward at the app layer.
ALTER TABLE "admin_users" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'OWNER',
ADD COLUMN     "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "afterData" JSONB,
ADD COLUMN     "beforeData" JSONB,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "targetAccountId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedByAdminId" TEXT,
ADD COLUMN     "emailVerifiedSource" "VerificationSource";

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isNewLocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_pulse_preferences" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "metricKeys" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_pulse_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_merges" (
    "id" TEXT NOT NULL,
    "primaryAccountId" TEXT NOT NULL,
    "secondaryAccountId" TEXT NOT NULL,
    "movedRefs" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "performedByAdminId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),
    "revertedByAdminId" TEXT,

    CONSTRAINT "account_merges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_sessions_adminUserId_idx" ON "admin_sessions"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_pulse_preferences_adminUserId_key" ON "admin_pulse_preferences"("adminUserId");

-- CreateIndex
CREATE INDEX "account_merges_primaryAccountId_idx" ON "account_merges"("primaryAccountId");

-- CreateIndex
CREATE INDEX "account_merges_secondaryAccountId_idx" ON "account_merges"("secondaryAccountId");

-- CreateIndex
CREATE INDEX "accounts_deletedAt_idx" ON "accounts"("deletedAt");

-- CreateIndex
CREATE INDEX "accounts_suspendedAt_idx" ON "accounts"("suspendedAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetAccountId_idx" ON "audit_logs"("targetAccountId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_pulse_preferences" ADD CONSTRAINT "admin_pulse_preferences_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AUD-01: "Unalterable log ... Append-only, not editable by anyone including
-- OWNER." This is enforced in application code (no update/delete function is
-- ever written against audit_logs) AND, belt-and-suspenders, at the database
-- level here: a trigger rejects any UPDATE or DELETE on this table outright,
-- regardless of which role/connection issues it. Postgres triggers fire for
-- superuser-issued DML too (only session_replication_role = replica would
-- skip it, which this app never sets), so this holds even against a direct
-- psql session using the app's own connection role.
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
