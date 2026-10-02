-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "sourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reminders_sourceKey_key" ON "reminders"("sourceKey");
