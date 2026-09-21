-- CreateTable
CREATE TABLE "SoloDuetScheduledRehearsal" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "studioCalendar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoloDuetScheduledRehearsal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoloDuetScheduledRehearsal_registrationId_idx" ON "SoloDuetScheduledRehearsal"("registrationId");

-- CreateIndex
CREATE INDEX "SoloDuetScheduledRehearsal_teacherId_idx" ON "SoloDuetScheduledRehearsal"("teacherId");

-- CreateIndex
CREATE INDEX "SoloDuetScheduledRehearsal_startTime_idx" ON "SoloDuetScheduledRehearsal"("startTime");

-- AddForeignKey
ALTER TABLE "SoloDuetScheduledRehearsal" ADD CONSTRAINT "SoloDuetScheduledRehearsal_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "SoloDuetRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoloDuetScheduledRehearsal" ADD CONSTRAINT "SoloDuetScheduledRehearsal_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
