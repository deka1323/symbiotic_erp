-- SKU-only hard cutover migration for ERP + shared DB objects.
-- Run in a controlled maintenance window and validate on staging first.

BEGIN;

-- Safety snapshots
CREATE TABLE IF NOT EXISTS backup_stocks_pre_sku_cutover AS TABLE stocks WITH DATA;
CREATE TABLE IF NOT EXISTS backup_to_items_pre_sku_cutover AS TABLE to_items WITH DATA;
CREATE TABLE IF NOT EXISTS backup_ro_items_pre_sku_cutover AS TABLE ro_items WITH DATA;
CREATE TABLE IF NOT EXISTS backup_bill_line_batches_pre_sku_cutover AS TABLE bill_line_batches WITH DATA;
CREATE TABLE IF NOT EXISTS backup_stock_history_pre_sku_cutover AS TABLE stock_history WITH DATA;

-- Archive batch-granular records before operational flattening
CREATE TABLE IF NOT EXISTS stock_batch_ledger_archive AS
SELECT s.id AS stock_row_id, s.inventory_id, s.sku_id, s.batch_id, s.quantity, s.last_updated, NOW() AS archived_at
FROM stocks s
WITH DATA;

CREATE TABLE IF NOT EXISTS to_item_batch_ledger_archive AS
SELECT ti.id AS to_item_id, ti.transfer_order_id, ti.sku_id, ti.batch_id, ti.sent_quantity, ti.received_quantity, NOW() AS archived_at
FROM to_items ti
WITH DATA;

CREATE TABLE IF NOT EXISTS ro_item_batch_ledger_archive AS
SELECT ri.id AS ro_item_id, ri.receive_order_id, ri.sku_id, ri.batch_id, ri.received_quantity, NOW() AS archived_at
FROM ro_items ri
WITH DATA;

CREATE TABLE IF NOT EXISTS bill_line_batch_ledger_archive AS
SELECT blb.id, blb.bill_line_id, blb.batch_id, blb.quantity, blb.unit_price, blb.line_total, blb.created_at, NOW() AS archived_at
FROM bill_line_batches blb
WITH DATA;

COMMIT;

BEGIN;

-- Flatten stocks to inventory+sku level
DROP TABLE IF EXISTS stocks_new_sku_only;
CREATE TABLE stocks_new_sku_only AS
SELECT
  gen_random_uuid()::text AS id,
  inventory_id,
  sku_id,
  SUM(quantity)::int AS quantity,
  MAX(last_updated) AS last_updated
FROM stocks
GROUP BY inventory_id, sku_id;

ALTER TABLE stocks RENAME TO stocks_old_batch;
ALTER TABLE stocks_new_sku_only RENAME TO stocks;

ALTER TABLE stocks ADD PRIMARY KEY (id);
ALTER TABLE stocks ADD CONSTRAINT stocks_inventory_sku_unique UNIQUE (inventory_id, sku_id);
ALTER TABLE stocks
  ADD CONSTRAINT stocks_inventory_fk FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE;
ALTER TABLE stocks
  ADD CONSTRAINT stocks_sku_fk FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS stocks_inventory_id_idx ON stocks(inventory_id);
CREATE INDEX IF NOT EXISTS stocks_sku_id_idx ON stocks(sku_id);

COMMIT;

BEGIN;

-- Flatten TO items to transfer_order+sku level
DROP TABLE IF EXISTS to_items_new_sku_only;
CREATE TABLE to_items_new_sku_only AS
SELECT
  gen_random_uuid()::text AS id,
  transfer_order_id,
  sku_id,
  SUM(sent_quantity)::int AS sent_quantity,
  CASE WHEN COUNT(received_quantity) = 0 THEN NULL ELSE SUM(COALESCE(received_quantity, 0))::int END AS received_quantity
FROM to_items
GROUP BY transfer_order_id, sku_id;

ALTER TABLE to_items RENAME TO to_items_old_batch;
ALTER TABLE to_items_new_sku_only RENAME TO to_items;

ALTER TABLE to_items ADD PRIMARY KEY (id);
ALTER TABLE to_items ADD CONSTRAINT to_items_transfer_sku_unique UNIQUE (transfer_order_id, sku_id);
ALTER TABLE to_items
  ADD CONSTRAINT to_items_transfer_fk FOREIGN KEY (transfer_order_id) REFERENCES transfer_orders(id) ON DELETE CASCADE;
ALTER TABLE to_items
  ADD CONSTRAINT to_items_sku_fk FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS to_items_transfer_order_id_idx ON to_items(transfer_order_id);
CREATE INDEX IF NOT EXISTS to_items_sku_id_idx ON to_items(sku_id);

COMMIT;

BEGIN;

-- Flatten RO items to receive_order+sku level
DROP TABLE IF EXISTS ro_items_new_sku_only;
CREATE TABLE ro_items_new_sku_only AS
SELECT
  gen_random_uuid()::text AS id,
  receive_order_id,
  sku_id,
  SUM(received_quantity)::int AS received_quantity
FROM ro_items
GROUP BY receive_order_id, sku_id;

ALTER TABLE ro_items RENAME TO ro_items_old_batch;
ALTER TABLE ro_items_new_sku_only RENAME TO ro_items;

ALTER TABLE ro_items ADD PRIMARY KEY (id);
ALTER TABLE ro_items ADD CONSTRAINT ro_items_receive_sku_unique UNIQUE (receive_order_id, sku_id);
ALTER TABLE ro_items
  ADD CONSTRAINT ro_items_receive_fk FOREIGN KEY (receive_order_id) REFERENCES receive_orders(id) ON DELETE CASCADE;
ALTER TABLE ro_items
  ADD CONSTRAINT ro_items_sku_fk FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ro_items_receive_order_id_idx ON ro_items(receive_order_id);
CREATE INDEX IF NOT EXISTS ro_items_sku_id_idx ON ro_items(sku_id);

COMMIT;

BEGIN;

-- Keep old allocation table for rollback/audit, remove from active model
ALTER TABLE bill_line_batches RENAME TO bill_line_batches_old_batch;

-- SKU-only mode no longer uses this toggle
ALTER TABLE pos DROP COLUMN IF EXISTS enforce_batch_sku_validation;

COMMIT;
