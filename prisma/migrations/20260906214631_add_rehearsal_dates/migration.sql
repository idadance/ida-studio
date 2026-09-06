-- CreateTable
CREATE TABLE "RehearsalDate" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RehearsalDate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RehearsalDate" ADD CONSTRAINT "RehearsalDate_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
