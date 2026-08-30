-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM (
  'WAITING',
  'OFFERED',
  'CLAIMED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT,
  "account" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "showId" TEXT NOT NULL,
  "offeredAt" TIMESTAMP(3),
  "offerExpiresAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_showId_idx"
ON "WaitlistEntry"("showId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx"
ON "WaitlistEntry"("status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_customerEmail_idx"
ON "WaitlistEntry"("customerEmail");

-- CreateIndex
CREATE INDEX "WaitlistEntry_account_idx"
ON "WaitlistEntry"("account");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx"
ON "WaitlistEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "WaitlistEntry"
ADD CONSTRAINT "WaitlistEntry_showId_fkey"
FOREIGN KEY ("showId")
REFERENCES "Show"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;