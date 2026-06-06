-- Invoice line discounts + custom (non-SKU) lines
-- See prisma/migrations/20260602120000_invoice_line_discount_custom/migration.sql

ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT IF EXISTS "sales_invoice_lines_invoice_id_sku_id_key";

ALTER TABLE "sales_invoice_lines" ALTER COLUMN "sku_id" DROP NOT NULL;

ALTER TABLE "sales_invoice_lines" ADD COLUMN IF NOT EXISTS "discount_type" VARCHAR(10) NOT NULL DEFAULT 'none';
ALTER TABLE "sales_invoice_lines" ADD COLUMN IF NOT EXISTS "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_invoice_lines" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_invoice_lines_invoice_id_line_no_key"
  ON "sales_invoice_lines"("invoice_id", "line_no");
