/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Studio` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Studio_name_key";

-- AlterTable
ALTER TABLE "Studio" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Studio_code_key" ON "Studio"("code");
