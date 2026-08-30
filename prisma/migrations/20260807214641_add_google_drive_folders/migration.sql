-- AlterTable
ALTER TABLE "Performance" ADD COLUMN     "driveCustomersFolderId" TEXT,
ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "driveVideosFolderId" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "driveFolderId" TEXT;
