-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BoxOfficeSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketPrice" REAL NOT NULL DEFAULT 15.00,
    "digitalVideo" BOOLEAN NOT NULL DEFAULT false,
    "digitalVideoPrice" REAL NOT NULL DEFAULT 15.00,
    "creditCardFeePercent" REAL NOT NULL DEFAULT 2.6,
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
INSERT INTO "new_BoxOfficeSettings" ("checkEnabled", "createdAt", "creditCardEnabled", "digitalVideo", "digitalVideoPrice", "id", "salesOpen", "showId", "ticketLimit", "ticketLimitEnabled", "ticketPrice", "updatedAt") SELECT "checkEnabled", "createdAt", "creditCardEnabled", "digitalVideo", "digitalVideoPrice", "id", "salesOpen", "showId", "ticketLimit", "ticketLimitEnabled", "ticketPrice", "updatedAt" FROM "BoxOfficeSettings";
DROP TABLE "BoxOfficeSettings";
ALTER TABLE "new_BoxOfficeSettings" RENAME TO "BoxOfficeSettings";
CREATE UNIQUE INDEX "BoxOfficeSettings_showId_key" ON "BoxOfficeSettings"("showId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
