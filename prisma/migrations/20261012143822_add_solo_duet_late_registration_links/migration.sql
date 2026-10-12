-- CreateTable
CREATE TABLE "SoloDuetLateRegistrationLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "familyName" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloDuetLateRegistrationLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoloDuetLateRegistrationLink_token_key" ON "SoloDuetLateRegistrationLink"("token");

-- CreateIndex
CREATE INDEX "SoloDuetLateRegistrationLink_token_idx" ON "SoloDuetLateRegistrationLink"("token");

-- CreateIndex
CREATE INDEX "SoloDuetLateRegistrationLink_usedAt_idx" ON "SoloDuetLateRegistrationLink"("usedAt");
