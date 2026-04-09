-- Production: at most one batch per inventory per calendar day.
-- Apply when ready (e.g. `npx prisma migrate deploy`). Do not run against production until duplicate rows are resolved.
--
-- 1) Inspect duplicates (same inventory, same calendar day from production_date) — must be merged or removed before step 3:
-- SELECT "inventory_id", CAST("production_date" AS DATE) AS day, COUNT(*) AS n
-- FROM "batches"
-- GROUP BY "inventory_id", CAST("production_date" AS DATE)
-- HAVING COUNT(*) > 1;
--
-- 2) Add column and backfill from production_date (TIMESTAMP(3) -> DATE).
ALTER TABLE "batches" ADD COLUMN "production_day" DATE;

UPDATE "batches" SET "production_day" = CAST("production_date" AS DATE);

-- 3) Fail fast if duplicates remain (optional but recommended).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "batches"
    GROUP BY "inventory_id", "production_day"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'batches: resolve duplicate (inventory_id, production_day) rows before enforcing uniqueness';
  END IF;
END $$;

ALTER TABLE "batches" ALTER COLUMN "production_day" SET NOT NULL;

-- 4) Unique constraint (matches Prisma @@unique([inventoryId, productionDay])).
CREATE UNIQUE INDEX "batches_inventory_id_production_day_key" ON "batches"("inventory_id", "production_day");

-- 5) Batch display code is unique per inventory only (not globally), so e.g. 26/SFPL/D09 can exist on each site.
DROP INDEX IF EXISTS "batches_batchId_key";

CREATE UNIQUE INDEX "batches_inventory_id_batchId_key" ON "batches"("inventory_id", "batchId");
