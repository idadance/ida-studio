ALTER TABLE "Reservation"
ADD COLUMN "extraTicketRequestId" TEXT;

CREATE UNIQUE INDEX "Reservation_extraTicketRequestId_key"
ON "Reservation"("extraTicketRequestId");
