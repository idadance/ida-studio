-- CreateTable
CREATE TABLE "PhotoBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "photoOrderId" TEXT NOT NULL,
    "photoNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoBatch_batchNumber_key" ON "PhotoBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "PhotoBatch_sentAt_idx" ON "PhotoBatch"("sentAt");

-- CreateIndex
CREATE INDEX "PhotoBatchItem_photoOrderId_idx" ON "PhotoBatchItem"("photoOrderId");

-- CreateIndex
CREATE INDEX "PhotoBatchItem_photoNumber_idx" ON "PhotoBatchItem"("photoNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoBatchItem_batchId_photoOrderId_photoNumber_key" ON "PhotoBatchItem"("batchId", "photoOrderId", "photoNumber");

-- AddForeignKey
ALTER TABLE "PhotoBatchItem" ADD CONSTRAINT "PhotoBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PhotoBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
