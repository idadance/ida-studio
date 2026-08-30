-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "checkNumber" TEXT,
ADD COLUMN     "checkReceivedAt" TIMESTAMP(3),
ADD COLUMN     "depositedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "ticketsSentAt" TIMESTAMP(3);
