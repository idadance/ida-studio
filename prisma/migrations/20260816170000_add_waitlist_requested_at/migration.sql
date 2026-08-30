ALTER TABLE "WaitlistEntry"
ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "WaitlistEntry_requestedAt_idx"
ON "WaitlistEntry"("requestedAt");
