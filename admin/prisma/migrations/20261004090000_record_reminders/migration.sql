-- AlterEnum
ALTER TYPE "ReminderKind" ADD VALUE 'PAYMENT_DUE';
ALTER TYPE "ReminderKind" ADD VALUE 'WARRANTY_END';

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "remindAt" TIMESTAMP(3),
ADD COLUMN     "repeatMonths" INTEGER;

-- CreateIndex
CREATE INDEX "reminders_remindAt_idx" ON "reminders"("remindAt");
