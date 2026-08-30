/*
  Warnings:

  - You are about to drop the column `fwCheckVideoVariantId` on the `Show` table. All the data in the column will be lost.
  - You are about to drop the column `fwCreditVideoVariantId` on the `Show` table. All the data in the column will be lost.
  - You are about to drop the column `pmCheckVideoVariantId` on the `Show` table. All the data in the column will be lost.
  - You are about to drop the column `pmCreditVideoVariantId` on the `Show` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Show" DROP COLUMN "fwCheckVideoVariantId",
DROP COLUMN "fwCreditVideoVariantId",
DROP COLUMN "pmCheckVideoVariantId",
DROP COLUMN "pmCreditVideoVariantId";
