-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('PRODUCTION', 'HUB', 'STORE');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('CREATED', 'IN_TRANSIT', 'FULFILLED');

-- CreateEnum
CREATE TYPE "TOStatus" AS ENUM ('CREATED', 'FULFILLED');

-- CreateTable
CREATE TABLE "inventories" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "InventoryType" NOT NULL,
    "address" TEXT,
    "contact" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "unit" VARCHAR(50) NOT NULL DEFAULT 'packets',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "department" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "batchId" VARCHAR(50) NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "production_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_history" (
    "id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_quantity" INTEGER NOT NULL,
    "new_quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" VARCHAR(100) NOT NULL,
    "from_inventory_id" TEXT NOT NULL,
    "to_inventory_id" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'CREATED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "requested_quantity" INTEGER NOT NULL,

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_orders" (
    "id" TEXT NOT NULL,
    "toNumber" VARCHAR(100) NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "TOStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "to_items" (
    "id" TEXT NOT NULL,
    "transfer_order_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "sent_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER,

    CONSTRAINT "to_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receive_orders" (
    "id" TEXT NOT NULL,
    "roNumber" VARCHAR(100) NOT NULL,
    "transfer_order_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receive_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ro_items" (
    "id" TEXT NOT NULL,
    "receive_order_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "received_quantity" INTEGER NOT NULL,

    CONSTRAINT "ro_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_inventories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventories_code_key" ON "inventories"("code");

-- CreateIndex
CREATE INDEX "inventories_code_idx" ON "inventories"("code");

-- CreateIndex
CREATE INDEX "inventories_type_idx" ON "inventories"("type");

-- CreateIndex
CREATE UNIQUE INDEX "skus_code_key" ON "skus"("code");

-- CreateIndex
CREATE INDEX "skus_code_idx" ON "skus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_code_key" ON "employees"("code");

-- CreateIndex
CREATE INDEX "employees_code_idx" ON "employees"("code");

-- CreateIndex
CREATE UNIQUE INDEX "batches_batchId_key" ON "batches"("batchId");

-- CreateIndex
CREATE INDEX "batches_batchId_idx" ON "batches"("batchId");

-- CreateIndex
CREATE INDEX "batches_inventory_id_idx" ON "batches"("inventory_id");

-- CreateIndex
CREATE INDEX "batches_production_date_idx" ON "batches"("production_date");

-- CreateIndex
CREATE INDEX "batch_items_batch_id_idx" ON "batch_items"("batch_id");

-- CreateIndex
CREATE INDEX "batch_items_sku_id_idx" ON "batch_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_batch_id_sku_id_key" ON "batch_items"("batch_id", "sku_id");

-- CreateIndex
CREATE INDEX "stocks_inventory_id_idx" ON "stocks"("inventory_id");

-- CreateIndex
CREATE INDEX "stocks_sku_id_idx" ON "stocks"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_inventory_id_sku_id_key" ON "stocks"("inventory_id", "sku_id");

-- CreateIndex
CREATE INDEX "stock_history_inventory_id_idx" ON "stock_history"("inventory_id");

-- CreateIndex
CREATE INDEX "stock_history_sku_id_idx" ON "stock_history"("sku_id");

-- CreateIndex
CREATE INDEX "stock_history_user_id_idx" ON "stock_history"("user_id");

-- CreateIndex
CREATE INDEX "stock_history_created_at_idx" ON "stock_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_poNumber_idx" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_from_inventory_id_idx" ON "purchase_orders"("from_inventory_id");

-- CreateIndex
CREATE INDEX "purchase_orders_to_inventory_id_idx" ON "purchase_orders"("to_inventory_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "po_items_purchase_order_id_idx" ON "po_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "po_items_sku_id_idx" ON "po_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "po_items_purchase_order_id_sku_id_key" ON "po_items"("purchase_order_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_orders_toNumber_key" ON "transfer_orders"("toNumber");

-- CreateIndex
CREATE INDEX "transfer_orders_toNumber_idx" ON "transfer_orders"("toNumber");

-- CreateIndex
CREATE INDEX "transfer_orders_purchase_order_id_idx" ON "transfer_orders"("purchase_order_id");

-- CreateIndex
CREATE INDEX "transfer_orders_employee_id_idx" ON "transfer_orders"("employee_id");

-- CreateIndex
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders"("status");

-- CreateIndex
CREATE INDEX "to_items_transfer_order_id_idx" ON "to_items"("transfer_order_id");

-- CreateIndex
CREATE INDEX "to_items_sku_id_idx" ON "to_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "to_items_transfer_order_id_sku_id_key" ON "to_items"("transfer_order_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "receive_orders_roNumber_key" ON "receive_orders"("roNumber");

-- CreateIndex
CREATE UNIQUE INDEX "receive_orders_transfer_order_id_key" ON "receive_orders"("transfer_order_id");

-- CreateIndex
CREATE INDEX "receive_orders_roNumber_idx" ON "receive_orders"("roNumber");

-- CreateIndex
CREATE INDEX "receive_orders_transfer_order_id_idx" ON "receive_orders"("transfer_order_id");

-- CreateIndex
CREATE INDEX "ro_items_receive_order_id_idx" ON "ro_items"("receive_order_id");

-- CreateIndex
CREATE INDEX "ro_items_sku_id_idx" ON "ro_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "ro_items_receive_order_id_sku_id_key" ON "ro_items"("receive_order_id", "sku_id");

-- CreateIndex
CREATE INDEX "user_inventories_user_id_idx" ON "user_inventories"("user_id");

-- CreateIndex
CREATE INDEX "user_inventories_inventory_id_idx" ON "user_inventories"("inventory_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_inventories_user_id_inventory_id_key" ON "user_inventories"("user_id", "inventory_id");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_from_inventory_id_fkey" FOREIGN KEY ("from_inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_to_inventory_id_fkey" FOREIGN KEY ("to_inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "to_items" ADD CONSTRAINT "to_items_transfer_order_id_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "to_items" ADD CONSTRAINT "to_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receive_orders" ADD CONSTRAINT "receive_orders_transfer_order_id_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ro_items" ADD CONSTRAINT "ro_items_receive_order_id_fkey" FOREIGN KEY ("receive_order_id") REFERENCES "receive_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ro_items" ADD CONSTRAINT "ro_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_inventories" ADD CONSTRAINT "user_inventories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_inventories" ADD CONSTRAINT "user_inventories_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
