-- AlterTable
ALTER TABLE "pos" ADD COLUMN IF NOT EXISTS "enforce_batch_sku_validation" BOOLEAN NOT NULL DEFAULT true;
