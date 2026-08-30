/*
  Warnings:

  - A unique constraint covering the columns `[ticketCode]` on the table `TicketOrder` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TicketOrder" ADD COLUMN     "ticketCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TicketOrder_ticketCode_key" ON "TicketOrder"("ticketCode");
