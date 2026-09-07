-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "preferredLocation" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherAvailability_teacherId_idx" ON "TeacherAvailability"("teacherId");

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
