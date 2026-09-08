-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "location" TEXT,
    "capacity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "creditCardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "checkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReservation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "paymentMethod" "TicketPaymentMethod" NOT NULL,
    "status" "EventReservationStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shopifyOrderId" TEXT,
    "shopifyOrderNumber" TEXT,
    "checkNumber" TEXT,
    "checkReceivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventReservation_eventId_idx" ON "EventReservation"("eventId");

-- CreateIndex
CREATE INDEX "EventReservation_customerEmail_idx" ON "EventReservation"("customerEmail");

-- CreateIndex
CREATE INDEX "EventReservation_status_idx" ON "EventReservation"("status");

-- CreateIndex
CREATE INDEX "EventReservation_shopifyOrderId_idx" ON "EventReservation"("shopifyOrderId");

-- AddForeignKey
ALTER TABLE "EventReservation" ADD CONSTRAINT "EventReservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
