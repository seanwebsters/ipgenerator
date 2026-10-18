/*
  Warnings:

  - You are about to alter the column `estCostUsd` on the `Opportunity` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(12,4)`.

*/
-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "estBasis" TEXT,
ADD COLUMN     "runId" TEXT,
ALTER COLUMN "estCostUsd" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "StudioSettings" ADD COLUMN     "flywheelEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flywheelIntervalMin" INTEGER NOT NULL DEFAULT 1440;

-- AlterTable
ALTER TABLE "WorldTitle" ADD COLUMN     "playContent" JSONB;
