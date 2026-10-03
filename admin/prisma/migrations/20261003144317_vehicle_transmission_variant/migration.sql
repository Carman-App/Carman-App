-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC', 'SEMI_AUTO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Powertrain" ADD VALUE 'PLUG_IN_HYBRID';
ALTER TYPE "Powertrain" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "transmission" "Transmission",
ADD COLUMN     "variant" TEXT;
