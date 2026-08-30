-- CreateTable
CREATE TABLE "BoxOfficeSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketPrice" REAL NOT NULL DEFAULT 15.00,
    "digitalVideo" BOOLEAN NOT NULL DEFAULT false,
    "digitalVideoPrice" REAL NOT NULL DEFAULT 15.00,
    "creditCardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "checkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketLimitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ticketLimit" INTEGER NOT NULL DEFAULT 4,
    "salesOpen" BOOLEAN NOT NULL DEFAULT false,
    "showId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoxOfficeSettings_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BoxOfficeSettings_showId_key" ON "BoxOfficeSettings"("showId");
