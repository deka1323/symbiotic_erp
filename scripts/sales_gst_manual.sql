-- Run on PostgreSQL if Prisma migration 20260530160000_add_sales_gst_fields was not applied.

ALTER TABLE "sales_invoice_basics" ADD COLUMN IF NOT EXISTS "default_gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "apply_gst" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "sales_invoice_lines" ADD COLUMN IF NOT EXISTS "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_invoice_lines" ADD COLUMN IF NOT EXISTS "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
