-- CreateTable
CREATE TABLE "TicketOrder" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketOrder_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TicketOrder_showId_idx" ON "TicketOrder"("showId");

-- CreateIndex
CREATE INDEX "TicketOrder_customerEmail_idx" ON "TicketOrder"("customerEmail");

-- CreateIndex
CREATE INDEX "TicketOrder_status_idx" ON "TicketOrder"("status");

-- CreateIndex
CREATE INDEX "TicketOrder_shopifyOrderId_idx" ON "TicketOrder"("shopifyOrderId");
