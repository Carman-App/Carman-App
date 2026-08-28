-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('TOO_EXPENSIVE', 'MISSING_FEATURE', 'SWITCHED_COMPETITOR', 'NO_LONGER_NEEDED', 'TECHNICAL_ISSUES', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkshopVerificationAction" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RestrictionCapability" AS ENUM ('INVITES', 'INVOICING', 'PHOTO_UPLOAD', 'ESTIMATES', 'MESSAGING');

-- CreateEnum
CREATE TYPE "DisputeKind" AS ENUM ('INVOICE', 'ESTIMATE', 'JOB', 'VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AbuseReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DisclosureRequestType" AS ENUM ('POLICE', 'INSURER', 'REGULATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PHONE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BILLING', 'TECHNICAL', 'ACCOUNT', 'ABUSE', 'FEATURE_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "TicketMessageDeliveryState" AS ENUM ('SENT', 'QUEUED', 'NO_PROVIDER', 'FAILED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('MOBILE_PUSH_REQUEST', 'ASSERTED');

-- CreateEnum
CREATE TYPE "ConsentSessionStatus" AS ENUM ('REQUESTED', 'GRANTED', 'ACTIVE', 'EXPIRED', 'DENIED', 'ENDED');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "MessageClass" AS ENUM ('MARKETING', 'TRANSACTIONAL', 'PRODUCT_UPDATE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'TEST_SENT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignRecipientState" AS ENUM ('QUEUED', 'SENT', 'NO_PROVIDER', 'SUPPRESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('USER_OPTED_OUT', 'BOUNCED', 'ADMIN_SET');

-- CreateEnum
CREATE TYPE "BannerSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FailedPaymentStatus" AS ENUM ('RETRYING', 'RESOLVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RefundCreditType" AS ENUM ('REFUND', 'CREDIT');

-- CreateEnum
CREATE TYPE "RefundCreditStatus" AS ENUM ('REQUESTED', 'APPROVED', 'EXECUTED', 'DENIED');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('STARTED', 'TRIAL_CONVERTED', 'UPGRADED', 'DOWNGRADED', 'CANCELLED', 'REACTIVATED', 'PAYMENT_FAILED', 'REFUNDED', 'TRIAL_EXTENDED', 'FREE_PERIOD_GRANTED');

-- AlterTable
ALTER TABLE "admin_users" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "originalFileKey" TEXT,
ADD COLUMN     "takedownAt" TIMESTAMP(3),
ADD COLUMN     "takedownByAdminId" TEXT,
ADD COLUMN     "takedownReason" TEXT;

-- AlterTable
ALTER TABLE "garage_members" ADD COLUMN     "invitedByAccountId" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedByAdminId" TEXT,
ADD COLUMN     "removedReason" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancellationNote" TEXT,
ADD COLUMN     "cancellationReason" "CancellationReason",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethodBrand" TEXT,
ADD COLUMN     "paymentMethodLast4" TEXT,
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workshops" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBadge" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "two_person_approvals" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedByAdminId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "executionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_person_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_transfers" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fromGarageId" TEXT,
    "fromAccountId" TEXT,
    "toGarageId" TEXT,
    "toAccountId" TEXT,
    "handoverCode" TEXT,
    "itemsTransferred" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_verifications" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "action" "WorkshopVerificationAction" NOT NULL,
    "checkedItems" JSONB,
    "documentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_contact_logs" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "accountId" TEXT,
    "channel" TEXT NOT NULL,
    "outcomeNote" TEXT NOT NULL,
    "performedByAdminId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_status_events" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByAccountId" TEXT,

    CONSTRAINT "job_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "kind" "DisputeKind" NOT NULL,
    "jobId" TEXT,
    "vehicleId" TEXT,
    "workshopId" TEXT,
    "invoiceId" TEXT,
    "estimateId" TEXT,
    "raisedByAccountId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedByAdminId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_reports" (
    "id" TEXT NOT NULL,
    "reportedAccountId" TEXT NOT NULL,
    "reportedEntityType" TEXT,
    "reportedEntityId" TEXT,
    "reporterAccountId" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "AbuseReportStatus" NOT NULL DEFAULT 'OPEN',
    "actionTaken" TEXT,
    "decidedByAdminId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_restrictions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "capability" "RestrictionCapability" NOT NULL,
    "reason" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3) NOT NULL,
    "liftedAt" TIMESTAMP(3),
    "liftedByAdminId" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disclosure_requests" (
    "id" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterOrg" TEXT NOT NULL,
    "requestType" "DisclosureRequestType" NOT NULL,
    "legalAuthority" TEXT NOT NULL,
    "whatWasDisclosed" TEXT NOT NULL,
    "relatedAccountId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "approvedByAdminId" TEXT NOT NULL,
    "userNotified" BOOLEAN NOT NULL DEFAULT false,
    "userNotifiedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disclosure_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "fromPlanId" TEXT,
    "toPlanId" TEXT,
    "amountCents" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "metadata" JSONB,
    "performedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reasonCode" TEXT,
    "status" "FailedPaymentStatus" NOT NULL DEFAULT 'RETRYING',
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "userNotifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_credits" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "RefundCreditType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "full" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "status" "RefundCreditStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedByAdminId" TEXT NOT NULL,
    "approvalId" TEXT,
    "executedAt" TIMESTAMP(3),
    "executionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rateToReportingCurrency" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "TicketChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "category" "TicketCategory",
    "assignedAdminId" TEXT,
    "attachedCountry" TEXT,
    "attachedPlan" TEXT,
    "attachedPaymentState" TEXT,
    "resolutionNote" TEXT,
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "direction" "TicketMessageDirection" NOT NULL,
    "channel" "TicketChannel" NOT NULL,
    "body" TEXT NOT NULL,
    "sentByAdminId" TEXT,
    "deliveryState" "TicketMessageDeliveryState" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "requestedByAdminId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentMethod" "ConsentMethod" NOT NULL,
    "consentGrantedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "status" "ConsentSessionStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,

    CONSTRAINT "consent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "messageClass" "MessageClass" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "testSentAt" TIMESTAMP(3),
    "testSentToAdminId" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "recipientCountAtSend" INTEGER,
    "suppressedCountAtSend" INTEGER,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "deliveryState" "CampaignRecipientState" NOT NULL DEFAULT 'QUEUED',
    "suppressedReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_suppressions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "CampaignChannel",
    "messageClass" "MessageClass",
    "reason" "SuppressionReason" NOT NULL,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedByAdminId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whats_new_notes" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whats_new_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whats_new_views" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "whats_new_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "BannerSeverity" NOT NULL DEFAULT 'INFO',
    "audience" JSONB,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "clearedAt" TIMESTAMP(3),
    "clearedByAdminId" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_person_approvals_entityType_entityId_idx" ON "two_person_approvals"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "two_person_approvals_status_idx" ON "two_person_approvals"("status");

-- CreateIndex
CREATE INDEX "vehicle_transfers_vehicleId_idx" ON "vehicle_transfers"("vehicleId");

-- CreateIndex
CREATE INDEX "workshop_verifications_workshopId_idx" ON "workshop_verifications"("workshopId");

-- CreateIndex
CREATE INDEX "workshop_contact_logs_workshopId_idx" ON "workshop_contact_logs"("workshopId");

-- CreateIndex
CREATE INDEX "job_status_events_jobId_idx" ON "job_status_events"("jobId");

-- CreateIndex
CREATE INDEX "job_status_events_toStatus_idx" ON "job_status_events"("toStatus");

-- CreateIndex
CREATE INDEX "disputes_jobId_idx" ON "disputes"("jobId");

-- CreateIndex
CREATE INDEX "disputes_vehicleId_idx" ON "disputes"("vehicleId");

-- CreateIndex
CREATE INDEX "disputes_workshopId_idx" ON "disputes"("workshopId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "abuse_reports_reportedAccountId_idx" ON "abuse_reports"("reportedAccountId");

-- CreateIndex
CREATE INDEX "abuse_reports_reporterAccountId_idx" ON "abuse_reports"("reporterAccountId");

-- CreateIndex
CREATE INDEX "abuse_reports_status_idx" ON "abuse_reports"("status");

-- CreateIndex
CREATE INDEX "capability_restrictions_accountId_idx" ON "capability_restrictions"("accountId");

-- CreateIndex
CREATE INDEX "disclosure_requests_relatedAccountId_idx" ON "disclosure_requests"("relatedAccountId");

-- CreateIndex
CREATE INDEX "subscription_events_subscriptionId_idx" ON "subscription_events"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_events_type_idx" ON "subscription_events"("type");

-- CreateIndex
CREATE INDEX "subscription_events_occurredAt_idx" ON "subscription_events"("occurredAt");

-- CreateIndex
CREATE INDEX "failed_payments_subscriptionId_idx" ON "failed_payments"("subscriptionId");

-- CreateIndex
CREATE INDEX "failed_payments_status_idx" ON "failed_payments"("status");

-- CreateIndex
CREATE INDEX "refund_credits_subscriptionId_idx" ON "refund_credits"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_currency_key" ON "fx_rates"("currency");

-- CreateIndex
CREATE INDEX "tickets_accountId_idx" ON "tickets"("accountId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_createdAt_idx" ON "tickets"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "consent_sessions_accountId_idx" ON "consent_sessions"("accountId");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaignId_idx" ON "campaign_recipients"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_recipients_accountId_idx" ON "campaign_recipients"("accountId");

-- CreateIndex
CREATE INDEX "message_suppressions_accountId_idx" ON "message_suppressions"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_language_key" ON "notification_templates"("key", "language");

-- CreateIndex
CREATE UNIQUE INDEX "whats_new_views_noteId_accountId_key" ON "whats_new_views"("noteId", "accountId");

-- AddForeignKey
ALTER TABLE "vehicle_transfers" ADD CONSTRAINT "vehicle_transfers_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_verifications" ADD CONSTRAINT "workshop_verifications_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_contact_logs" ADD CONSTRAINT "workshop_contact_logs_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_status_events" ADD CONSTRAINT "job_status_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reportedAccountId_fkey" FOREIGN KEY ("reportedAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporterAccountId_fkey" FOREIGN KEY ("reporterAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_restrictions" ADD CONSTRAINT "capability_restrictions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_payments" ADD CONSTRAINT "failed_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_credits" ADD CONSTRAINT "refund_credits_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_sessions" ADD CONSTRAINT "consent_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_suppressions" ADD CONSTRAINT "message_suppressions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whats_new_views" ADD CONSTRAINT "whats_new_views_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "whats_new_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whats_new_views" ADD CONSTRAINT "whats_new_views_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
