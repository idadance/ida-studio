-- CreateTable
CREATE TABLE "EventAttendee" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAttendee_reservationId_idx" ON "EventAttendee"("reservationId");

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "EventReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
