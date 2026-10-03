-- CreateEnum
CREATE TYPE "WorkshopTeamSize" AS ENUM ('SOLO', 'HELPER', 'TEAM');

-- AlterTable
ALTER TABLE "workshops" ADD COLUMN     "teamSize" "WorkshopTeamSize",
ADD COLUMN     "town" TEXT;
