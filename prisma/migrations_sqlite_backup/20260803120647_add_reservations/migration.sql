-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "digitalVideo" BOOLEAN NOT NULL DEFAULT false,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "shopifyOrderId" TEXT,
    "shopifyOrderNumber" TEXT,
    "performanceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "reservationId" TEXT,
    "showId" TEXT NOT NULL,
    "performanceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketOrder_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketOrder_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TicketOrder" ("checkedInCount", "createdAt", "customerEmail", "customerName", "digitalVideo", "id", "paymentMethod", "performanceId", "quantity", "shopifyOrderId", "shopifyOrderNumber", "showId", "status", "ticketSubtotal", "totalAmount", "updatedAt", "videoSubtotal") SELECT "checkedInCount", "createdAt", "customerEmail", "customerName", "digitalVideo", "id", "paymentMethod", "performanceId", "quantity", "shopifyOrderId", "shopifyOrderNumber", "showId", "status", "ticketSubtotal", "totalAmount", "updatedAt", "videoSubtotal" FROM "TicketOrder";
DROP TABLE "TicketOrder";
ALTER TABLE "new_TicketOrder" RENAME TO "TicketOrder";
CREATE INDEX "TicketOrder_showId_idx" ON "TicketOrder"("showId");
CREATE INDEX "TicketOrder_performanceId_idx" ON "TicketOrder"("performanceId");
CREATE INDEX "TicketOrder_customerEmail_idx" ON "TicketOrder"("customerEmail");
CREATE INDEX "TicketOrder_status_idx" ON "TicketOrder"("status");
CREATE INDEX "TicketOrder_shopifyOrderId_idx" ON "TicketOrder"("shopifyOrderId");
CREATE INDEX "TicketOrder_reservationId_idx" ON "TicketOrder"("reservationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Reservation_customerEmail_idx" ON "Reservation"("customerEmail");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_shopifyOrderId_idx" ON "Reservation"("shopifyOrderId");
