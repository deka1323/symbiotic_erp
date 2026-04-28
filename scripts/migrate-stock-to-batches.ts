/**
 * Historical one-off: migrated legacy `stocks` rows onto a LEGACY batch when Stock
 * was batch-scoped in the schema.
 *
 * Current schema (`Stock`): one row per inventory + SKU (`@@unique([inventoryId, skuId])`),
 * no `batchId`. Batch tracking uses `Batch`, receive/transfer flows, and `StockHistory.batchId`.
 *
 * If you still need data fixes, use targeted SQL or a new script aligned with `schema.prisma`.
 */

console.log(
  "[migrate-stock-to-batches] Skipped — Stock model no longer includes batchId; migration is obsolete."
);
