-- AlterTable: POS bypass batch metadata
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "remark" VARCHAR(255);
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "bypass_by_inventory_id" VARCHAR(255);
