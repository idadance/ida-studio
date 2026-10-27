/*
  Warnings:

  - A unique constraint covering the columns `[resultingReservationId]` on the table `SixersReservationAdjustment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SixersReservationAdjustment" ADD COLUMN     "resultingReservationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SixersReservationAdjustment_resultingReservationId_key" ON "SixersReservationAdjustment"("resultingReservationId");
