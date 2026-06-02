-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "contact_number" VARCHAR(50),
    "gst_number" VARCHAR(50),
    "remark" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_inventory_id_idx" ON "customers"("inventory_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
