-- Default GST % on invoice basics (per inventory)
ALTER TABLE "sales_invoice_basics" ADD COLUMN IF NOT EXISTS "default_gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- GST mode on invoice
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "apply_gst" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Per-line GST snapshot
ALTER TABLE "sales_invoice_lines" ADD COLUMN IF NOT EXISTS "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "sales_invoice_lines" ADD COLUMN IF NOT EXISTS "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
