-- AlterTable
ALTER TABLE "DcaOrder" ADD COLUMN "address" TEXT;
ALTER TABLE "DcaOrder" ADD COLUMN "duration" INTEGER;
ALTER TABLE "DcaOrder" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "DcaOrder" ADD COLUMN "interval" INTEGER;

-- AlterTable
ALTER TABLE "LimitOrder" ADD COLUMN "address" TEXT;
