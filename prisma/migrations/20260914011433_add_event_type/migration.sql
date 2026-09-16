-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('STANDARD', 'SOLO_DUET');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "type" "EventType" NOT NULL DEFAULT 'STANDARD';
