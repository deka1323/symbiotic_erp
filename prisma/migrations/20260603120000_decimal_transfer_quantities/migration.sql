-- Decimal quantities for stock and transfer pipeline (TO send/receive)

ALTER TABLE "stocks" ALTER COLUMN "quantity" TYPE DECIMAL(14,3) USING "quantity"::decimal;
ALTER TABLE "stocks" ALTER COLUMN "quantity" SET DEFAULT 0;

ALTER TABLE "stock_history" ALTER COLUMN "old_quantity" TYPE DECIMAL(14,3) USING "old_quantity"::decimal;
ALTER TABLE "stock_history" ALTER COLUMN "new_quantity" TYPE DECIMAL(14,3) USING "new_quantity"::decimal;

ALTER TABLE "po_items" ALTER COLUMN "requested_quantity" TYPE DECIMAL(14,3) USING "requested_quantity"::decimal;

ALTER TABLE "to_items" ALTER COLUMN "sent_quantity" TYPE DECIMAL(14,3) USING "sent_quantity"::decimal;
ALTER TABLE "to_items" ALTER COLUMN "received_quantity" TYPE DECIMAL(14,3) USING "received_quantity"::decimal;

ALTER TABLE "ro_items" ALTER COLUMN "received_quantity" TYPE DECIMAL(14,3) USING "received_quantity"::decimal;
