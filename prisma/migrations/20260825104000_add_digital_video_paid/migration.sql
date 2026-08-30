ALTER TABLE "Reservation"
ADD COLUMN "digitalVideoPaid" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Reservation"
SET "digitalVideoPaid" = true
WHERE "digitalVideo" = true
  AND "status" = 'CONFIRMED'
  AND EXISTS (
    SELECT 1
    FROM "TicketOrder"
    WHERE "TicketOrder"."reservationId" = "Reservation"."id"
      AND "TicketOrder"."digitalVideo" = true
      AND "TicketOrder"."videoSubtotal" > 0
  );