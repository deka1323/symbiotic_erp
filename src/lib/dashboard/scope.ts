import { prisma } from '@/lib/prisma'
import { ADMIN_ROLE_CODE } from '@/lib/auth/roles'

export async function resolveDashboardInventoryIds(
  userId: string,
  inventoryId?: string | null,
  allInventories?: boolean
): Promise<{ ids: string[]; label: string; isAdmin: boolean }> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  })
  const isAdmin = roles.some((r) => r.role.code === ADMIN_ROLE_CODE)

  if (inventoryId) {
    if (!isAdmin) {
      const mapping = await prisma.userInventory.findFirst({
        where: { userId, inventoryId },
      })
      if (!mapping) {
        return { ids: [], label: 'No access', isAdmin }
      }
    }
    const inv = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { name: true, isActive: true },
    })
    if (!inv?.isActive) {
      return { ids: [], label: 'Inventory not found', isAdmin }
    }
    return { ids: [inventoryId], label: inv.name, isAdmin }
  }

  if (isAdmin && allInventories) {
    const all = await prisma.inventory.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { name: 'asc' },
    })
    return {
      ids: all.map((i) => i.id),
      label: 'All inventories',
      isAdmin,
    }
  }

  const mappings = await prisma.userInventory.findMany({
    where: { userId, inventory: { isActive: true } },
    include: { inventory: { select: { id: true, name: true } } },
  })
  const ids = mappings.map((m) => m.inventory.id)
  const label =
    mappings.length === 1
      ? mappings[0].inventory.name
      : mappings.length > 1
        ? `${mappings.length} inventories`
        : 'No inventory assigned'

  return { ids, label, isAdmin }
}
