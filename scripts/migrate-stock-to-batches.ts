import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Starting stock to batch migration...')

  // Step 1: Find or create LEGACY batch
  let legacyBatch = await prisma.batch.findFirst({
    where: { batchId: 'LEGACY' },
  })

  if (!legacyBatch) {
    // Find a production inventory to assign the legacy batch to
    const productionInventory = await prisma.inventory.findFirst({
      where: { type: 'PRODUCTION' },
    })

    if (!productionInventory) {
      throw new Error('No production inventory found. Cannot create LEGACY batch.')
    }

    legacyBatch = await prisma.batch.create({
      data: {
        batchId: 'LEGACY',
        inventoryId: productionInventory.id,
        productionDate: new Date('2000-01-01'), // Old date to indicate legacy
      },
    })
    console.log('✅ Created LEGACY batch')
  } else {
    console.log('✅ LEGACY batch already exists')
  }

  // Step 2: Get all existing stock records
  const existingStocks = await prisma.stock.findMany({
    include: { sku: true, inventory: true },
  })

  console.log(`📊 Found ${existingStocks.length} existing stock records to migrate`)

  if (existingStocks.length === 0) {
    console.log('✅ No stock records to migrate')
    return
  }

  // Step 3: Migrate each stock record
  let migrated = 0
  let errors = 0

  for (const stock of existingStocks) {
    try {
      // Check if stock with batchId already exists
      const existingStockWithBatch = await prisma.stock.findFirst({
        where: {
          inventoryId: stock.inventoryId,
          skuId: stock.skuId,
          batchId: legacyBatch.id,
        },
      })

      if (existingStockWithBatch) {
        // If exists, increment quantity
        await prisma.stock.update({
          where: { id: existingStockWithBatch.id },
          data: { quantity: { increment: stock.quantity } as any },
        })
        console.log(`  ✓ Updated existing stock for SKU ${stock.sku.code} in inventory ${stock.inventory.name}`)
      } else {
        // Create new stock record with batchId
        await prisma.stock.create({
          data: {
            inventoryId: stock.inventoryId,
            skuId: stock.skuId,
            batchId: legacyBatch.id,
            quantity: stock.quantity,
          },
        })
        console.log(`  ✓ Created stock with batch for SKU ${stock.sku.code} in inventory ${stock.inventory.name}`)
      }

      // Delete old stock record (without batchId)
      await prisma.stock.delete({
        where: { id: stock.id },
      })

      migrated++
    } catch (error: any) {
      console.error(`  ✗ Error migrating stock ${stock.id}:`, error.message)
      errors++
    }
  }

  console.log(`\n✅ Migration completed:`)
  console.log(`   - Migrated: ${migrated} stock records`)
  console.log(`   - Errors: ${errors}`)
  console.log(`\n⚠️  IMPORTANT: After running this migration, you must:`)
  console.log(`   1. Run: npx prisma migrate dev --name add_batch_to_stock`)
  console.log(`   2. Run: npx prisma generate`)
  console.log(`   3. Verify all stock records have batchId`)
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
