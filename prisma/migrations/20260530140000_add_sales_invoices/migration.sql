-- CreateTable
CREATE TABLE "sales_invoice_basics" (
    "id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "gst_number" VARCHAR(50),
    "state_label" VARCHAR(100),
    "logo_data" TEXT,
    "qr_code_data" TEXT,
    "bank_name" TEXT,
    "account_number" VARCHAR(50),
    "ifsc_code" VARCHAR(20),
    "account_holder_name" VARCHAR(255),
    "terms_and_conditions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoice_basics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "inventory_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_number" INTEGER NOT NULL,
    "invoice_date" DATE NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_address" TEXT,
    "customer_gst" VARCHAR(50),
    "customer_contact" VARCHAR(50),
    "customer_remark" TEXT,
    "received_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sub_total" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_name" VARCHAR(500) NOT NULL,
    "mrp" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "price_per_unit" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_basics_inventory_id_key" ON "sales_invoice_basics"("inventory_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_inventory_id_invoice_number_key" ON "sales_invoices"("inventory_id", "invoice_number");

-- CreateIndex
CREATE INDEX "sales_invoices_inventory_id_idx" ON "sales_invoices"("inventory_id");

-- CreateIndex
CREATE INDEX "sales_invoices_customer_id_idx" ON "sales_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "sales_invoices_invoice_date_idx" ON "sales_invoices"("invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_lines_invoice_id_sku_id_key" ON "sales_invoice_lines"("invoice_id", "sku_id");

-- CreateIndex
CREATE INDEX "sales_invoice_lines_invoice_id_idx" ON "sales_invoice_lines"("invoice_id");

-- AddForeignKey
ALTER TABLE "sales_invoice_basics" ADD CONSTRAINT "sales_invoice_basics_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
