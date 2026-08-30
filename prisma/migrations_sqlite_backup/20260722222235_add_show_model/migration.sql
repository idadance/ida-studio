-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME,
    "capacity" INTEGER NOT NULL DEFAULT 250,
    "performanceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Show_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
