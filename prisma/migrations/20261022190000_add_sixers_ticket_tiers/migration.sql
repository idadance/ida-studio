-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'TICKET_SALE';

-- AlterTable
ALTER TABLE "EventReservation" ADD COLUMN     "ticketTierId" TEXT;

-- CreateTable
CREATE TABLE "EventTicketTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL,
    "fwCreditVariantId" TEXT,
    "fwCheckVariantId" TEXT,
    "pmCreditVariantId" TEXT,
    "pmCheckVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTicketTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventTicketTier_eventId_idx" ON "EventTicketTier"("eventId");

-- CreateIndex
CREATE INDEX "EventTicketTier_eventId_price_idx" ON "EventTicketTier"("eventId", "price");

-- CreateIndex
CREATE INDEX "EventReservation_ticketTierId_idx" ON "EventReservation"("ticketTierId");

-- AddForeignKey
ALTER TABLE "EventTicketTier" ADD CONSTRAINT "EventTicketTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReservation" ADD CONSTRAINT "EventReservation_ticketTierId_fkey" FOREIGN KEY ("ticketTierId") REFERENCES "EventTicketTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventReservation"
ADD COLUMN "checkoutRequestId" TEXT;

CREATE UNIQUE INDEX "EventReservation_checkoutRequestId_key"
ON "EventReservation"("checkoutRequestId");

ALTER TABLE "EventReservation" ADD COLUMN "shopifyDraftStatus" TEXT;
ALTER TABLE "EventReservation" ADD COLUMN "shopifyDraftOrderId" TEXT;