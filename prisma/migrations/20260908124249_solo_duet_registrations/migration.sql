-- CreateTable
CREATE TABLE "SoloDuetRegistration" (
    "id" TEXT NOT NULL,
    "studentFirstName" TEXT NOT NULL,
    "studentLastName" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "partnerFirstName" TEXT,
    "partnerLastName" TEXT,
    "teacherId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "paymentPercent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoloDuetRegistration_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SoloDuetRegistration" ADD CONSTRAINT "SoloDuetRegistration_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoloDuetRegistration" ADD CONSTRAINT "SoloDuetRegistration_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
