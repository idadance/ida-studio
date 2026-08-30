/*
  Warnings:

  - Added the required column `performanceId` to the `TicketOrder` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TicketOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "digitalVideo" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ticketSubtotal" REAL NOT NULL DEFAULT 0,
    "videoSubtotal" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "shopifyOrderId" TEXT,
    "shopifyOrderNumber" TEXT,
    "checkedInCount" INTEGER NOT NULL DEFAULT 0,
    "showId" TEXT NOT NULL,
    "performanceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketOrder_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketOrder_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TicketOrder" ("checkedInCount", "createdAt", "customerEmail", "customerName", "digitalVideo", "id", "paymentMethod", "quantity", "shopifyOrderId", "shopifyOrderNumber", "showId", "status", "ticketSubtotal", "totalAmount", "updatedAt", "videoSubtotal") SELECT "checkedInCount", "createdAt", "customerEmail", "customerName", "digitalVideo", "id", "paymentMethod", "quantity", "shopifyOrderId", "shopifyOrderNumber", "showId", "status", "ticketSubtotal", "totalAmount", "updatedAt", "videoSubtotal" FROM "TicketOrder";
DROP TABLE "TicketOrder";
ALTER TABLE "new_TicketOrder" RENAME TO "TicketOrder";
CREATE INDEX "TicketOrder_showId_idx" ON "TicketOrder"("showId");
CREATE INDEX "TicketOrder_performanceId_idx" ON "TicketOrder"("performanceId");
CREATE INDEX "TicketOrder_customerEmail_idx" ON "TicketOrder"("customerEmail");
CREATE INDEX "TicketOrder_status_idx" ON "TicketOrder"("status");
CREATE INDEX "TicketOrder_shopifyOrderId_idx" ON "TicketOrder"("shopifyOrderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
