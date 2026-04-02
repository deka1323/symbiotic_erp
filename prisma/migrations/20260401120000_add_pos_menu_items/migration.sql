-- Create POS menu table for POS-specific SKU pricing
CREATE TABLE IF NOT EXISTS "pos_menu_items" (
  "id" TEXT NOT NULL,
  "pos_id" TEXT NOT NULL,
  "sku_id" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_menu_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pos_menu_items_pos_id_sku_id_key" ON "pos_menu_items"("pos_id", "sku_id");
CREATE INDEX IF NOT EXISTS "pos_menu_items_pos_id_idx" ON "pos_menu_items"("pos_id");
CREATE INDEX IF NOT EXISTS "pos_menu_items_sku_id_idx" ON "pos_menu_items"("sku_id");
CREATE INDEX IF NOT EXISTS "pos_menu_items_is_active_idx" ON "pos_menu_items"("is_active");

ALTER TABLE "pos_menu_items"
  ADD CONSTRAINT "pos_menu_items_pos_id_fkey"
  FOREIGN KEY ("pos_id") REFERENCES "pos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_menu_items"
  ADD CONSTRAINT "pos_menu_items_sku_id_fkey"
  FOREIGN KEY ("sku_id") REFERENCES "skus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill menu rows for existing POS + stocked active SKU combinations
INSERT INTO "pos_menu_items" ("id", "pos_id", "sku_id", "price", "is_active", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text AS id,
  p.id AS pos_id,
  s.id AS sku_id,
  s.price AS price,
  true AS is_active,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "pos" p
JOIN "stocks" st ON st.inventory_id = p.linked_inventory_id
JOIN "skus" s ON s.id = st.sku_id
WHERE st.quantity > 0
  AND s.is_active = true
ON CONFLICT ("pos_id", "sku_id") DO NOTHING;

-- Keep menu status aligned with SKU status
UPDATE "pos_menu_items" pmi
SET "is_active" = false,
    "updated_at" = CURRENT_TIMESTAMP
FROM "skus" s
WHERE pmi.sku_id = s.id
  AND s.is_active = false
  AND pmi.is_active = true;
