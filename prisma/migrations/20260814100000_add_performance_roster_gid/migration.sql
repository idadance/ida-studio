ALTER TABLE "Performance"
ADD COLUMN "rosterSheetGid" TEXT;

UPDATE "Performance"
SET "rosterSheetGid" = '0'
WHERE "name" = 'Performance Intensive';