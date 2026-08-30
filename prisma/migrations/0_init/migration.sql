-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerformanceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TicketPaymentMethod" AS ENUM ('CREDIT_CARD', 'CHECK');

-- CreateEnum
CREATE TYPE "TicketOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "status" "PerformanceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL DEFAULT 250,
    "performanceId" TEXT NOT NULL,
    "shopifyCheckTicketVariantId" TEXT,
    "shopifyCreditTicketVariantId" TEXT,
    "shopifyCheckVideoVariantId" TEXT,
    "shopifyCreditVideoVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxOfficeSettings" (
    "id" TEXT NOT NULL,
    "ticketPrice" DOUBLE PRECISION NOT NULL DEFAULT 15.00,
    "digitalVideo" BOOLEAN NOT NULL DEFAULT false,
    "digitalVideoPrice" DOUBLE PRECISION NOT NULL DEFAULT 15.00,
    "creditCardFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 2.6,
    "creditCardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "checkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketLimitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ticketLimit" INTEGER NOT NULL DEFAULT 4,
    "salesOpen" BOOLEAN NOT NULL DEFAULT false,
    "showId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoxOfficeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "paymentMethod" "TicketPaymentMethod" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "digitalVideo" BOOLEAN NOT NULL DEFAULT false,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shopifyOrderId" TEXT,
    "shopifyOrderNumber" TEXT,
    "performanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketOrder" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "digitalVideo" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "TicketPaymentMethod" NOT NULL,
    "status" "TicketOrderStatus" NOT NULL DEFAULT 'PENDING',
    "ticketSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "videoSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shopifyOrderId" TEXT,
    "shopifyOrderNumber" TEXT,
    "checkedInCount" INTEGER NOT NULL DEFAULT 0,
    "reservationId" TEXT,
    "showId" TEXT NOT NULL,
    "performanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoxOfficeSettings_showId_key" ON "BoxOfficeSettings"("showId");

-- CreateIndex
CREATE INDEX "Reservation_customerEmail_idx" ON "Reservation"("customerEmail");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_shopifyOrderId_idx" ON "Reservation"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "TicketOrder_showId_idx" ON "TicketOrder"("showId");

-- CreateIndex
CREATE INDEX "TicketOrder_performanceId_idx" ON "TicketOrder"("performanceId");

-- CreateIndex
CREATE INDEX "TicketOrder_customerEmail_idx" ON "TicketOrder"("customerEmail");

-- CreateIndex
CREATE INDEX "TicketOrder_status_idx" ON "TicketOrder"("status");

-- CreateIndex
CREATE INDEX "TicketOrder_shopifyOrderId_idx" ON "TicketOrder"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "TicketOrder_reservationId_idx" ON "TicketOrder"("reservationId");

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxOfficeSettings" ADD CONSTRAINT "BoxOfficeSettings_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketOrder" ADD CONSTRAINT "TicketOrder_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

