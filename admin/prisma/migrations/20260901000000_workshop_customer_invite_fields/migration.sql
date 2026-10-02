-- AlterTable
-- Adds the invite-to-Carma path for a workshop's "customer on file"
-- (WorkshopCustomer). Additive/nullable only — no backfill needed, no
-- existing column changed.
--   email               — needed to match a customer against an existing
--                          Carma User (keyed by email) when inviting them.
--   invitedAt           — when a workshop last sent an invite (set whether
--                          or not a matching account existed yet).
--   invitedByAccountId  — who sent it (actor id, per this schema's
--                          existing plain-id actor-column convention).
ALTER TABLE "workshop_customers" ADD COLUMN "email" TEXT;
ALTER TABLE "workshop_customers" ADD COLUMN "invitedAt" TIMESTAMP(3);
ALTER TABLE "workshop_customers" ADD COLUMN "invitedByAccountId" TEXT;
