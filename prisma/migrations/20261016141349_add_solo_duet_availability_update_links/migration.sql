-- CreateTable
CREATE TABLE "SoloDuetAvailabilityUpdateLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloDuetAvailabilityUpdateLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoloDuetAvailabilityUpdateLink_token_key" ON "SoloDuetAvailabilityUpdateLink"("token");

-- CreateIndex
CREATE INDEX "SoloDuetAvailabilityUpdateLink_token_idx" ON "SoloDuetAvailabilityUpdateLink"("token");

-- CreateIndex
CREATE INDEX "SoloDuetAvailabilityUpdateLink_registrationId_idx" ON "SoloDuetAvailabilityUpdateLink"("registrationId");

-- CreateIndex
CREATE INDEX "SoloDuetAvailabilityUpdateLink_usedAt_idx" ON "SoloDuetAvailabilityUpdateLink"("usedAt");

-- AddForeignKey
ALTER TABLE "SoloDuetAvailabilityUpdateLink" ADD CONSTRAINT "SoloDuetAvailabilityUpdateLink_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "SoloDuetRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
