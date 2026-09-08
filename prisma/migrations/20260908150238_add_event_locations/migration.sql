/*
  Warnings:

  - You are about to drop the column `capacity` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `EventReservation` table. All the data in the column will be lost.
  - Added the required column `eventLocationId` to the `EventReservation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EventReservation" DROP CONSTRAINT "EventReservation_eventId_fkey";

-- DropIndex
DROP INDEX "EventReservation_eventId_idx";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "capacity",
DROP COLUMN "location",
DROP COLUMN "price";

-- AlterTable
ALTER TABLE "EventReservation" DROP COLUMN "eventId",
ADD COLUMN     "eventLocationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "EventLocation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studioCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventLocation_eventId_idx" ON "EventLocation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventLocation_eventId_studioCode_key" ON "EventLocation"("eventId", "studioCode");

-- CreateIndex
CREATE INDEX "EventReservation_eventLocationId_idx" ON "EventReservation"("eventLocationId");

-- AddForeignKey
ALTER TABLE "EventLocation" ADD CONSTRAINT "EventLocation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReservation" ADD CONSTRAINT "EventReservation_eventLocationId_fkey" FOREIGN KEY ("eventLocationId") REFERENCES "EventLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
