-- CreateEnum
CREATE TYPE "SixersAdjustmentStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'CANCELED');

-- CreateTable
CREATE TABLE "SixersReservationAdjustment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "originalTicketTierId" TEXT,
    "originalQuantity" INTEGER NOT NULL,
    "newTicketTierId" TEXT NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "status" "SixersAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "shopifyDraftOrderId" TEXT,
    "shopifyOrderId" TEXT,
    "shopifyOrderNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SixersReservationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SixersReservationAdjustment_shopifyDraftOrderId_key" ON "SixersReservationAdjustment"("shopifyDraftOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SixersReservationAdjustment_shopifyOrderId_key" ON "SixersReservationAdjustment"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "SixersReservationAdjustment_reservationId_idx" ON "SixersReservationAdjustment"("reservationId");

-- CreateIndex
CREATE INDEX "SixersReservationAdjustment_newTicketTierId_status_idx" ON "SixersReservationAdjustment"("newTicketTierId", "status");

-- AddForeignKey
ALTER TABLE "SixersReservationAdjustment" ADD CONSTRAINT "SixersReservationAdjustment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "EventReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
