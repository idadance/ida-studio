-- CreateTable
CREATE TABLE "RehearsalEntry" (
    "id" TEXT NOT NULL,
    "studentFirstName" TEXT NOT NULL,
    "studentLastName" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "rehearsalsNeeded" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RehearsalEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RehearsalEntry" ADD CONSTRAINT "RehearsalEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalEntry" ADD CONSTRAINT "RehearsalEntry_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
