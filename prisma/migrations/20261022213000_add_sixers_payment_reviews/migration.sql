-- Sixers payment review records

CREATE TABLE "SixersPaymentReview" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyOrderNumber" TEXT,
    "shop" TEXT NOT NULL,
    "reservationId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SixersPaymentReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SixersPaymentReview_status_idx" ON "SixersPaymentReview"("status");
CREATE INDEX "SixersPaymentReview_reservationId_idx" ON "SixersPaymentReview"("reservationId");
CREATE UNIQUE INDEX "SixersPaymentReview_shop_shopifyOrderId_key" ON "SixersPaymentReview"("shop", "shopifyOrderId");
