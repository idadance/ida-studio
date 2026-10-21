-- Add PayPal as a supported ticket payment method
ALTER TYPE "TicketPaymentMethod" ADD VALUE 'PAYPAL';

-- Identify which organization owns each performance
CREATE TYPE "TicketOrganization" AS ENUM ('IDA', 'GENERATIONS');

ALTER TABLE "Performance"
ADD COLUMN "organization" "TicketOrganization" NOT NULL DEFAULT 'IDA';

-- Store PayPal transaction identifiers on reservations
ALTER TABLE "Reservation"
ADD COLUMN "paypalOrderId" TEXT,
ADD COLUMN "paypalCaptureId" TEXT;

CREATE UNIQUE INDEX "Reservation_paypalOrderId_key"
ON "Reservation"("paypalOrderId");

CREATE INDEX "Reservation_paypalCaptureId_idx"
ON "Reservation"("paypalCaptureId");
