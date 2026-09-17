/*
  Update Solo/Duet registration structure while preserving
  any existing registration records.
*/

-- DropForeignKey
ALTER TABLE "SoloDuetRegistration"
DROP CONSTRAINT "SoloDuetRegistration_teacherId_fkey";

-- AlterTable
ALTER TABLE "SoloDuetRegistration"
DROP COLUMN "paymentPercent",
ADD COLUMN "grade" TEXT,
ADD COLUMN "paymentResponsibility" TEXT,
ADD COLUMN "shopifyOrderId" TEXT,
ADD COLUMN "shopifyOrderNumber" TEXT,
ADD COLUMN "studioCode" TEXT,
ADD COLUMN "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "teacherId" DROP NOT NULL,
ALTER COLUMN "paymentMethod" DROP NOT NULL,
ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

-- Give any existing test registrations safe legacy values
UPDATE "SoloDuetRegistration"
SET
  "grade" = 'Unknown',
  "studioCode" = 'UNKNOWN',
  "paymentResponsibility" = 'LEGACY'
WHERE
  "grade" IS NULL
  OR "studioCode" IS NULL
  OR "paymentResponsibility" IS NULL;

-- Now make the new fields required
ALTER TABLE "SoloDuetRegistration"
ALTER COLUMN "grade" SET NOT NULL,
ALTER COLUMN "studioCode" SET NOT NULL,
ALTER COLUMN "paymentResponsibility" SET NOT NULL;

-- CreateTable
CREATE TABLE "SoloDuetRegistrationAvailability" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "availabilityId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "timeSlot" TEXT NOT NULL,
  "preferredLocation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SoloDuetRegistrationAvailability_pkey"
    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoloDuetRegistrationAvailability_registrationId_idx"
ON "SoloDuetRegistrationAvailability"("registrationId");

-- CreateIndex
CREATE INDEX "SoloDuetRegistrationAvailability_availabilityId_idx"
ON "SoloDuetRegistrationAvailability"("availabilityId");

-- CreateIndex
CREATE INDEX "SoloDuetRegistration_teacherId_idx"
ON "SoloDuetRegistration"("teacherId");

-- CreateIndex
CREATE INDEX "SoloDuetRegistration_genreId_idx"
ON "SoloDuetRegistration"("genreId");

-- CreateIndex
CREATE INDEX "SoloDuetRegistration_studioCode_idx"
ON "SoloDuetRegistration"("studioCode");

-- CreateIndex
CREATE INDEX "SoloDuetRegistration_status_idx"
ON "SoloDuetRegistration"("status");

-- CreateIndex
CREATE INDEX "SoloDuetRegistration_shopifyOrderId_idx"
ON "SoloDuetRegistration"("shopifyOrderId");

-- AddForeignKey
ALTER TABLE "SoloDuetRegistration"
ADD CONSTRAINT "SoloDuetRegistration_teacherId_fkey"
FOREIGN KEY ("teacherId")
REFERENCES "Teacher"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoloDuetRegistrationAvailability"
ADD CONSTRAINT "SoloDuetRegistrationAvailability_registrationId_fkey"
FOREIGN KEY ("registrationId")
REFERENCES "SoloDuetRegistration"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;