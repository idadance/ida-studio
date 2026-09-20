-- CreateEnum
CREATE TYPE "PhotoOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'REFUNDED');

-- CreateTable
CREATE TABLE "PhotoOrder" (
    "id" TEXT NOT NULL,
    "studioCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "dancerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "paymentMethod" "TicketPaymentMethod" NOT NULL,
    "status" "PhotoOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shopifyOrderId" TEXT,
    "shopifyOrderNumber" TEXT,
    "checkNumber" TEXT,
    "checkReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoOrderItem" (
    "id" TEXT NOT NULL,
    "photoOrderId" TEXT NOT NULL,
    "photoNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoOrder_studioCode_idx" ON "PhotoOrder"("studioCode");

-- CreateIndex
CREATE INDEX "PhotoOrder_customerEmail_idx" ON "PhotoOrder"("customerEmail");

-- CreateIndex
CREATE INDEX "PhotoOrder_status_idx" ON "PhotoOrder"("status");

-- CreateIndex
CREATE INDEX "PhotoOrder_shopifyOrderId_idx" ON "PhotoOrder"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "PhotoOrderItem_photoNumber_idx" ON "PhotoOrderItem"("photoNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoOrderItem_photoOrderId_photoNumber_key" ON "PhotoOrderItem"("photoOrderId", "photoNumber");

-- AddForeignKey
ALTER TABLE "PhotoOrderItem" ADD CONSTRAINT "PhotoOrderItem_photoOrderId_fkey" FOREIGN KEY ("photoOrderId") REFERENCES "PhotoOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
