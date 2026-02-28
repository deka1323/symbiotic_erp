/*
  Warnings:

  - A unique constraint covering the columns `[receive_order_id,sku_id,batch_id]` on the table `ro_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[inventory_id,sku_id,batch_id]` on the table `stocks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[transfer_order_id,sku_id,batch_id]` on the table `to_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `batch_id` to the `ro_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `batch_id` to the `stocks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `batch_id` to the `to_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "receive_orders" DROP CONSTRAINT "receive_orders_transfer_order_id_fkey";

-- DropForeignKey
ALTER TABLE "transfer_orders" DROP CONSTRAINT "transfer_orders_purchase_order_id_fkey";

-- DropIndex
DROP INDEX "ro_items_receive_order_id_sku_id_key";

-- DropIndex
DROP INDEX "stocks_inventory_id_sku_id_key";

-- DropIndex
DROP INDEX "to_items_transfer_order_id_sku_id_key";

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "created_by_id" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "created_by_id" TEXT;

-- AlterTable
ALTER TABLE "receive_orders" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "to_inventory_id" TEXT,
ALTER COLUMN "transfer_order_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ro_items" ADD COLUMN     "batch_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "stock_history" ADD COLUMN     "batch_id" TEXT;

-- AlterTable
ALTER TABLE "stocks" ADD COLUMN     "batch_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "to_items" ADD COLUMN     "batch_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transfer_orders" ADD COLUMN     "created_by_id" TEXT,
ALTER COLUMN "purchase_order_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "batches_created_by_id_idx" ON "batches"("created_by_id");

-- CreateIndex
CREATE INDEX "purchase_orders_created_by_id_idx" ON "purchase_orders"("created_by_id");

-- CreateIndex
CREATE INDEX "receive_orders_to_inventory_id_idx" ON "receive_orders"("to_inventory_id");

-- CreateIndex
CREATE INDEX "receive_orders_created_by_id_idx" ON "receive_orders"("created_by_id");

-- CreateIndex
CREATE INDEX "ro_items_batch_id_idx" ON "ro_items"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "ro_items_receive_order_id_sku_id_batch_id_key" ON "ro_items"("receive_order_id", "sku_id", "batch_id");

-- CreateIndex
CREATE INDEX "stock_history_batch_id_idx" ON "stock_history"("batch_id");

-- CreateIndex
CREATE INDEX "stocks_batch_id_idx" ON "stocks"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_inventory_id_sku_id_batch_id_key" ON "stocks"("inventory_id", "sku_id", "batch_id");

-- CreateIndex
CREATE INDEX "to_items_batch_id_idx" ON "to_items"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "to_items_transfer_order_id_sku_id_batch_id_key" ON "to_items"("transfer_order_id", "sku_id", "batch_id");

-- CreateIndex
CREATE INDEX "transfer_orders_created_by_id_idx" ON "transfer_orders"("created_by_id");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "to_items" ADD CONSTRAINT "to_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receive_orders" ADD CONSTRAINT "receive_orders_transfer_order_id_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "transfer_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receive_orders" ADD CONSTRAINT "receive_orders_to_inventory_id_fkey" FOREIGN KEY ("to_inventory_id") REFERENCES "inventories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receive_orders" ADD CONSTRAINT "receive_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ro_items" ADD CONSTRAINT "ro_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
