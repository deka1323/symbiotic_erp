import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import { inheritRolePermissionsToUser } from '../src/lib/acl/inheritPermissions'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clear only relationship/mapping data (preserve independent entities)
  console.log('🧹 Cleaning relationship/mapping data...')
  await prisma.userRoleFeaturePrivilege.deleteMany()
  await prisma.userRole.deleteMany()
  await prisma.roleFeaturePrivilege.deleteMany()
  await prisma.featurePrivilege.deleteMany()
  await prisma.roleModule.deleteMany()
  await prisma.userSession.deleteMany()
  console.log('✅ Cleared all relationship/mapping data')
  console.log('ℹ️  Preserving independent entities: Users, Roles, Modules, Features, Privileges')

  // 1. Create Roles
  console.log('👥 Creating roles...')
  const roles = [
    { code: 'admin', name: 'Administrator', description: 'System administrator with full access', isSystem: true },
    { code: 'manager', name: 'Manager', description: 'Manager role with limited admin access' },
    { code: 'production_manager', name: 'Production Manager', description: 'Manager for production inventories' },
    { code: 'hub_manager', name: 'Hub Manager', description: 'Manager for hub inventories' },
    { code: 'store_manager', name: 'Store Manager', description: 'Manager for store/outlet inventories' },
    { code: 'employee', name: 'Employee', description: 'Standard employee role' },
  ]

  const createdRoles = await Promise.all(
    roles.map((r) =>
      prisma.role.upsert({
        where: { code: r.code },
        update: {},
        create: r,
      })
    )
  )

  const adminRole = createdRoles.find((r) => r.code === 'admin')!
  if (!adminRole) {
    throw new Error('Admin role not found after creation')
  }
  console.log(`✅ Ensured ${createdRoles.length} roles exist`)

  // 2. Create Modules
  console.log('📦 Creating modules...')
  const modules = [
    { code: 'access-control', name: 'Access Control', description: 'Roles & Permissions Management' },
    { code: 'basic-configuration', name: 'Basic Configuration', description: 'Manage SKUs, Inventories, Employees' },
    { code: 'production', name: 'Production', description: 'Production and batch processing' },
    { code: 'inventory', name: 'Inventory', description: 'Purchase Orders, Transfer Orders, Receive Orders, Stock management' },
    { code: 'admin-report', name: 'Admin Report', description: 'Administrative reports (future)' },
    { code: 'hr', name: 'Human Resources', description: 'HR management' },
    { code: 'finance', name: 'Finance', description: 'Financial management' },
  ]

  const createdModules = await Promise.all(
    modules.map((m) =>
      prisma.module.upsert({
        where: { code: m.code },
        update: {},
        create: m,
      })
    )
  )

  const accessControlModule = createdModules.find((m) => m.code === 'access-control')!
  const financeModule = createdModules.find((m) => m.code === 'finance')!
  if (!accessControlModule || !financeModule) {
    throw new Error('Required modules not found after creation')
  }
  console.log(`✅ Ensured ${createdModules.length} modules exist`)

  // 3. Create Features for Access Control Module
  console.log('🎯 Creating features for Access Control module...')
  const accessControlFeatures = [
    { code: 'role_management', name: 'Role Management', description: 'Manage roles' },
    { code: 'module_management', name: 'Module Management', description: 'Manage modules' },
    { code: 'feature_management', name: 'Feature Management', description: 'Manage features' },
    { code: 'privilege_management', name: 'Privilege Management', description: 'Manage privileges' },
    { code: 'user_management', name: 'User Management', description: 'Manage users' },
  ]

  const createdAccessControlFeatures = await Promise.all(
    accessControlFeatures.map((f) =>
      prisma.feature.upsert({
        where: {
          moduleId_code: {
            moduleId: accessControlModule.id,
            code: f.code,
          },
        },
        update: {},
        create: {
          moduleId: accessControlModule.id,
          code: f.code,
          name: f.name,
          description: f.description,
        },
      })
    )
  )

  console.log(`✅ Ensured ${createdAccessControlFeatures.length} features exist for Access Control module`)

  // 3b. Create Feature for Finance Module
  console.log('🎯 Creating feature for Finance module...')
  const financeFeature = await prisma.feature.upsert({
    where: {
      moduleId_code: {
        moduleId: financeModule.id,
        code: 'show_finance_main_item_in_sidebar',
      },
    },
    update: {},
    create: {
      moduleId: financeModule.id,
      code: 'show_finance_main_item_in_sidebar',
      name: 'Show Finance Main Item in Sidebar',
      description: 'Permission to show finance module main item in sidebar',
    },
  })
  console.log(`✅ Ensured feature exists for Finance module: ${financeFeature.code}`)

  // 4. Create Privileges
  console.log('🔐 Creating privileges...')
  const privileges = [
    { code: 'view', description: 'Permission to view resources' },
    { code: 'create', description: 'Permission to create resources' },
    { code: 'edit', description: 'Permission to edit resources' },
    { code: 'delete', description: 'Permission to delete resources' },
  ]

  const createdPrivileges = await Promise.all(
    privileges.map((p) =>
      prisma.privilege.upsert({
        where: { code: p.code },
        update: {},
        create: p,
      })
    )
  )

  const viewPrivilege = createdPrivileges.find((p) => p.code === 'view')!
  const createPrivilege = createdPrivileges.find((p) => p.code === 'create')!
  const editPrivilege = createdPrivileges.find((p) => p.code === 'edit')!
  const deletePrivilege = createdPrivileges.find((p) => p.code === 'delete')!
  console.log(`✅ Ensured ${createdPrivileges.length} privileges exist`)

  // 4b. Programmatically create features for modules/pages (sidebar + page actions)
  console.log('🎯 Creating standard features for modules/pages...')
  const modulePageMap: Record<string, string[]> = {
    'basic-configuration': ['skus', 'inventories', 'employees'],
    production: ['daily-production'],
    inventory: ['purchase-orders', 'transfer-orders', 'receive-orders', 'manage-stock', 'reports'],
    'access-control': ['users', 'roles', 'modules', 'features', 'privileges', 'user-inventories'],
    'admin-report': ['admin-reports'],
    finance: ['finance-main'],
  }

  const createdFeaturesAll: any[] = []

  for (const mod of createdModules) {
    const pages = modulePageMap[mod.code] || []
    for (const page of pages) {
      const featureCodes = [
        `show_${page}_in_sidebar`,
        `${page}:list_table`,
        `${page}:create`,
        `${page}:edit`,
        `${page}:delete`,
        `${page}:export`,
      ]
      for (const fc of featureCodes) {
        const f = await prisma.feature.upsert({
          where: { moduleId_code: { moduleId: mod.id, code: fc } },
          update: {},
          create: { moduleId: mod.id, code: fc, name: `${page} - ${fc}`, description: `${fc} feature for ${page}` },
        })
        createdFeaturesAll.push(f)
      }
    }
  }
  // Include access control features already created in the global list (dedupe by id)
  for (const f of createdAccessControlFeatures) {
    if (!createdFeaturesAll.find((c) => c.id === f.id)) createdFeaturesAll.push(f)
  }
  // Include financeFeature if not present
  if (financeFeature && !createdFeaturesAll.find((c) => c.id === financeFeature.id)) createdFeaturesAll.push(financeFeature)
  
  // Create management-level features for API authorization
  console.log('🎯 Creating management-level features for API authorization...')
  const basicConfigModule = createdModules.find((m) => m.code === 'basic-configuration')
  const inventoryModule = createdModules.find((m) => m.code === 'inventory')
  
  if (basicConfigModule) {
    const managementFeatures = [
      { code: 'sku_management', name: 'SKU Management', description: 'Overall SKU management capability' },
      { code: 'inventory_management', name: 'Inventory Management', description: 'Overall Inventory management capability' },
      { code: 'employee_management', name: 'Employee Management', description: 'Overall Employee management capability' },
    ]
    for (const mf of managementFeatures) {
      const f = await prisma.feature.upsert({
        where: { moduleId_code: { moduleId: basicConfigModule.id, code: mf.code } },
        update: {},
        create: {
          moduleId: basicConfigModule.id,
          code: mf.code,
          name: mf.name,
          description: mf.description,
        },
      })
      if (!createdFeaturesAll.find((c) => c.id === f.id)) createdFeaturesAll.push(f)
    }
  }
  
  if (inventoryModule) {
    const inventoryManagementFeatures = [
      { code: 'purchase_order', name: 'Purchase Order', description: 'Purchase order management capability' },
      { code: 'send_stock', name: 'Send Stock', description: 'Send stock / Transfer order management capability' },
      { code: 'receive_stock', name: 'Receive Stock', description: 'Receive stock / Receive order management capability' },
      { code: 'manage_stock', name: 'Manage Stock', description: 'Stock management capability' },
      { code: 'inventory_reports', name: 'Inventory Reports', description: 'Inventory reports capability' },
    ]
    for (const mf of inventoryManagementFeatures) {
      const f = await prisma.feature.upsert({
        where: { moduleId_code: { moduleId: inventoryModule.id, code: mf.code } },
        update: {},
        create: {
          moduleId: inventoryModule.id,
          code: mf.code,
          name: mf.name,
          description: mf.description,
        },
      })
      if (!createdFeaturesAll.find((c) => c.id === f.id)) createdFeaturesAll.push(f)
    }
  }

  // Production module: management-level feature for API authorization (daily batches)
  const productionModule = createdModules.find((m) => m.code === 'production')
  if (productionModule) {
    const dailyProductionFeature = await prisma.feature.upsert({
      where: {
        moduleId_code: { moduleId: productionModule.id, code: 'daily_production' },
      },
      update: {},
      create: {
        moduleId: productionModule.id,
        code: 'daily_production',
        name: 'Daily Production',
        description: 'Create and manage daily production batches',
      },
    })
    if (!createdFeaturesAll.find((c) => c.id === dailyProductionFeature.id)) createdFeaturesAll.push(dailyProductionFeature)
  }

  // Map management features to all privileges
  const managementFeaturePrivilegeMappings: Array<{ featureId: string; privilegeId: string }> = []
  for (const feat of createdFeaturesAll) {
    if (
      feat.code === 'sku_management' ||
      feat.code === 'inventory_management' ||
      feat.code === 'employee_management' ||
      feat.code === 'purchase_order' ||
      feat.code === 'send_stock' ||
      feat.code === 'receive_stock' ||
      feat.code === 'manage_stock' ||
      feat.code === 'inventory_reports' ||
      feat.code === 'daily_production'
    ) {
      managementFeaturePrivilegeMappings.push(
        { featureId: feat.id, privilegeId: viewPrivilege.id },
        { featureId: feat.id, privilegeId: createPrivilege.id },
        { featureId: feat.id, privilegeId: editPrivilege.id },
        { featureId: feat.id, privilegeId: deletePrivilege.id }
      )
    }
  }
  if (managementFeaturePrivilegeMappings.length > 0) {
    await prisma.featurePrivilege.createMany({ data: managementFeaturePrivilegeMappings, skipDuplicates: true })
    console.log(`✅ Mapped ${managementFeaturePrivilegeMappings.length} management feature-privilege relationships`)
  }
  
  console.log(`✅ Ensured ${createdFeaturesAll.length} total features across modules`)

  // Map feature -> privilege according to naming convention
  console.log('🔗 Mapping generated features to privileges...')
  const generatedFeaturePrivilegeMappings: Array<{ featureId: string; privilegeId: string }> = []
  for (const feat of createdFeaturesAll) {
    const code: string = feat.code
    if (code.startsWith('show_') || code.endsWith(':list_table') || code.endsWith(':export') || code === 'finance-main') {
      generatedFeaturePrivilegeMappings.push({ featureId: feat.id, privilegeId: viewPrivilege.id })
    }
    if (code.endsWith(':create')) generatedFeaturePrivilegeMappings.push({ featureId: feat.id, privilegeId: createPrivilege.id })
    if (code.endsWith(':edit')) generatedFeaturePrivilegeMappings.push({ featureId: feat.id, privilegeId: editPrivilege.id })
    if (code.endsWith(':delete')) generatedFeaturePrivilegeMappings.push({ featureId: feat.id, privilegeId: deletePrivilege.id })
  }
  await prisma.featurePrivilege.createMany({ data: generatedFeaturePrivilegeMappings, skipDuplicates: true })
  console.log(`✅ Mapped ${generatedFeaturePrivilegeMappings.length} generated feature-privilege relationships`)
  // 5. Map Features to Privileges
  console.log('🔗 Mapping features to privileges...')
  const featurePrivilegeMappings: Array<{ featureId: string; privilegeId: string }> = []

  for (const feature of createdAccessControlFeatures) {
    featurePrivilegeMappings.push(
      { featureId: feature.id, privilegeId: viewPrivilege.id },
      { featureId: feature.id, privilegeId: createPrivilege.id },
      { featureId: feature.id, privilegeId: editPrivilege.id },
      { featureId: feature.id, privilegeId: deletePrivilege.id }
    )
  }

  // Map finance feature to view privilege only (for sidebar visibility)
  featurePrivilegeMappings.push({
    featureId: financeFeature.id,
    privilegeId: viewPrivilege.id,
  })

  await prisma.featurePrivilege.createMany({
    data: featurePrivilegeMappings,
    skipDuplicates: true,
  })
  console.log(`✅ Mapped ${featurePrivilegeMappings.length} feature-privilege relationships`)

  // 6. Map Roles to Modules
  console.log('🔗 Mapping roles to modules...')
  const roleModuleMappings: Array<{ roleId: string; moduleId: string }> = []

  // Admin role gets all modules
  for (const module of createdModules) {
    roleModuleMappings.push({ roleId: adminRole.id, moduleId: module.id })
  }

  // Map manager roles to relevant modules
  const productionRoleObj = createdRoles.find((r) => r.code === 'production_manager')
  const hubRoleObj = createdRoles.find((r) => r.code === 'hub_manager')
  const storeRoleObj = createdRoles.find((r) => r.code === 'store_manager')
  const inventoryModuleObj = createdModules.find((m) => m.code === 'inventory')
  const productionModuleObj = createdModules.find((m) => m.code === 'production')

  if (productionRoleObj && inventoryModuleObj && productionModuleObj) {
    roleModuleMappings.push({ roleId: productionRoleObj.id, moduleId: inventoryModuleObj.id })
    roleModuleMappings.push({ roleId: productionRoleObj.id, moduleId: productionModuleObj.id })
  }
  if (hubRoleObj && inventoryModuleObj) {
    roleModuleMappings.push({ roleId: hubRoleObj.id, moduleId: inventoryModuleObj.id })
  }
  if (storeRoleObj && inventoryModuleObj) {
    roleModuleMappings.push({ roleId: storeRoleObj.id, moduleId: inventoryModuleObj.id })
  }

  await prisma.roleModule.createMany({
    data: roleModuleMappings,
    skipDuplicates: true,
  })
  console.log(`✅ Mapped ${roleModuleMappings.length} role-module relationships`)

  // 7. Assign permissions to roles (admin gets full, managers get limited)
  console.log('🔐 Assigning permissions to roles...')
  const roleFeaturePrivilegeMappings: Array<{
    roleId: string
    featureId: string
    privilegeId: string
  }> = []

  // Admin: full privileges on all generated features
  for (const feature of createdFeaturesAll) {
    roleFeaturePrivilegeMappings.push(
      { roleId: adminRole.id, featureId: feature.id, privilegeId: viewPrivilege.id },
      { roleId: adminRole.id, featureId: feature.id, privilegeId: createPrivilege.id },
      { roleId: adminRole.id, featureId: feature.id, privilegeId: editPrivilege.id },
      { roleId: adminRole.id, featureId: feature.id, privilegeId: deletePrivilege.id }
    )
  }

  // Grant production_manager view/create/edit on production + inventory features (no delete by default)
  if (productionRoleObj && inventoryModuleObj && productionModuleObj) {
    for (const feature of createdFeaturesAll.filter((f) => f.moduleId === inventoryModuleObj.id || f.moduleId === productionModuleObj.id)) {
      roleFeaturePrivilegeMappings.push(
        { roleId: productionRoleObj.id, featureId: feature.id, privilegeId: viewPrivilege.id },
        { roleId: productionRoleObj.id, featureId: feature.id, privilegeId: createPrivilege.id },
        { roleId: productionRoleObj.id, featureId: feature.id, privilegeId: editPrivilege.id }
      )
    }
  }

  // Grant hub_manager and store_manager view/create/edit on inventory features
  if (hubRoleObj && inventoryModuleObj) {
    for (const feature of createdFeaturesAll.filter((f) => f.moduleId === inventoryModuleObj.id)) {
      roleFeaturePrivilegeMappings.push(
        { roleId: hubRoleObj.id, featureId: feature.id, privilegeId: viewPrivilege.id },
        { roleId: hubRoleObj.id, featureId: feature.id, privilegeId: createPrivilege.id },
        { roleId: hubRoleObj.id, featureId: feature.id, privilegeId: editPrivilege.id }
      )
    }
  }
  if (storeRoleObj && inventoryModuleObj) {
    for (const feature of createdFeaturesAll.filter((f) => f.moduleId === inventoryModuleObj.id)) {
      roleFeaturePrivilegeMappings.push(
        { roleId: storeRoleObj.id, featureId: feature.id, privilegeId: viewPrivilege.id },
        { roleId: storeRoleObj.id, featureId: feature.id, privilegeId: createPrivilege.id },
        { roleId: storeRoleObj.id, featureId: feature.id, privilegeId: editPrivilege.id }
      )
    }
  }

  await prisma.roleFeaturePrivilege.createMany({
    data: roleFeaturePrivilegeMappings,
    skipDuplicates: true,
  })
  console.log(`✅ Assigned ${roleFeaturePrivilegeMappings.length} permissions to roles`)

  // 8. Create Admin User
  console.log('👤 Creating admin user...')
  const passwordHash = await argon2.hash('Admin@123')
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@erp.com' },
    update: {},
    create: {
      email: 'admin@erp.com',
      username: 'admin',
      fullName: 'System Administrator',
      passwordHash,
      isActive: true,
    },
  })
  console.log(`✅ Ensured admin user exists: ${adminUser.email}`)

  // 9. Assign admin role to admin user
  console.log('🔗 Assigning admin role to admin user...')
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  })

  // 10. Inherit admin role permissions to admin user using the inheritance function
  console.log('🔐 Inheriting permissions to admin user...')
  await inheritRolePermissionsToUser(adminUser.id, adminRole.id)
  
  // Count inherited permissions for summary
  const inheritedCount = await prisma.userRoleFeaturePrivilege.count({
    where: {
      userId: adminUser.id,
      roleId: adminRole.id,
      reason: {
        contains: 'Inherited from role',
      },
    },
  })
  console.log(`✅ Inherited ${inheritedCount} permissions to admin user`)

  // 11. Create sample Inventories (1 production, 2 hubs, 3 stores)
  console.log('🏬 Creating sample inventories...')
  const inventoriesData = [
    { code: 'PRD-001', name: 'Symbiotic Production Plant', type: 'PRODUCTION', address: '123 Processing Lane', contact: '0123456789' },
    { code: 'HUB-001', name: 'Central Hub A', type: 'HUB', address: '10 Hub Street', contact: '0111111111' },
    { code: 'HUB-002', name: 'Central Hub B', type: 'HUB', address: '11 Hub Avenue', contact: '0111111122' },
    { code: 'STORE-001', name: 'Outlet Store 1', type: 'STORE', address: '1 Market Rd', contact: '0222222222' },
    { code: 'STORE-002', name: 'Outlet Store 2', type: 'STORE', address: '2 Market Rd', contact: '0222222233' },
    { code: 'STORE-003', name: 'Outlet Store 3', type: 'STORE', address: '3 Market Rd', contact: '0222222244' },
  ]

  const createdInventories = await Promise.all(
    inventoriesData.map((inv) =>
      prisma.inventory.upsert({
        where: { code: inv.code },
        update: {},
        create: {
          code: inv.code,
          name: inv.name,
          type: inv.type as any,
          address: inv.address,
          contact: inv.contact,
        },
      })
    )
  )
  console.log(`✅ Ensured ${createdInventories.length} inventories exist`)

  // Map admin user to all inventories so admin can view/manage across site
  console.log('🔗 Mapping admin user to all inventories...')
  const adminUserInventoryPromises: any[] = []
  for (const inv of createdInventories) {
    adminUserInventoryPromises.push(
      prisma.userInventory.upsert({
        where: { userId_inventoryId: { userId: adminUser.id, inventoryId: inv.id } },
        update: {},
        create: { userId: adminUser.id, inventoryId: inv.id },
      })
    )
  }
  await Promise.all(adminUserInventoryPromises)
  console.log('✅ Admin mapped to all inventories')

  // 12. Create sample SKUs
  console.log('📦 Creating sample SKUs...')
  const skusData = [
    { code: 'SKU-BEEF-500', name: 'Beef Boneless 500g', description: 'Boneless beef pack 500g', unit: 'packets' },
    { code: 'SKU-PORK-1000', name: 'Pork Belly 1kg', description: 'Pork belly 1kg pack', unit: 'packets' },
    { code: 'SKU-CHICK-250', name: 'Chicken Cut 250g', description: 'Chicken portions 250g', unit: 'packets' },
    { code: 'SKU-MUTTON-500', name: 'Mutton 500g', description: 'Mutton pack 500g', unit: 'packets' },
    { code: 'SKU-MINCED-400', name: 'Minced Meat 400g', description: 'Mixed minced meat 400g', unit: 'packets' },
  ]

  const createdSkus = await Promise.all(
    skusData.map((s) =>
      (prisma as any).sKU.upsert({
        where: { code: s.code },
        update: {},
        create: {
          code: s.code,
          name: s.name,
          description: s.description,
          unit: s.unit,
        },
      })
    )
  )
  console.log(`✅ Ensured ${createdSkus.length} SKUs exist`)

  // 13. Create sample employees
  console.log('👷 Creating sample employees...')
  const employeesData = [
    { code: 'EMP-PICKER-01', name: 'Raju Worker', email: 'raju@symbiotic.com', phone: '0333333333', department: 'Production' },
    { code: 'EMP-DEL-01', name: 'Soni Driver', email: 'soni@symbiotic.com', phone: '0444444444', department: 'Logistics' },
  ]

  const createdEmployees = await Promise.all(
    employeesData.map((e) =>
      prisma.employee.upsert({
        where: { code: e.code },
        update: {},
        create: {
          code: e.code,
          name: e.name,
          email: e.email,
          phone: e.phone,
          department: e.department,
        },
      })
    )
  )
  console.log(`✅ Ensured ${createdEmployees.length} employees exist`)

  // 14. Create manager users for different inventory types and assign inventories
  console.log('👤 Creating manager users and assigning inventories...')
  const managerPasswordHash = await argon2.hash('Manager@123')

  const productionInventory = createdInventories.find((i) => i.type === 'PRODUCTION')!
  const hubInventories = createdInventories.filter((i) => i.type === 'HUB')
  const storeInventories = createdInventories.filter((i) => i.type === 'STORE')

  const productionManager = await prisma.user.upsert({
    where: { email: 'prod_manager@erp.com' },
    update: {},
    create: {
      email: 'prod_manager@erp.com',
      username: 'prod_manager',
      fullName: 'Production Manager',
      passwordHash: managerPasswordHash,
      isActive: true,
    },
  })

  const hubManager = await prisma.user.upsert({
    where: { email: 'hub_manager@erp.com' },
    update: {},
    create: {
      email: 'hub_manager@erp.com',
      username: 'hub_manager',
      fullName: 'Hub Manager',
      passwordHash: managerPasswordHash,
      isActive: true,
    },
  })

  const storeManager = await prisma.user.upsert({
    where: { email: 'store_manager@erp.com' },
    update: {},
    create: {
      email: 'store_manager@erp.com',
      username: 'store_manager',
      fullName: 'Store Manager',
      passwordHash: managerPasswordHash,
      isActive: true,
    },
  })

  // Assign specific manager roles to manager users
  const productionRoleObj2 = createdRoles.find((r) => r.code === 'production_manager')!
  const hubRoleObj2 = createdRoles.find((r) => r.code === 'hub_manager')!
  const storeRoleObj2 = createdRoles.find((r) => r.code === 'store_manager')!

  await Promise.all([
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: productionManager.id, roleId: productionRoleObj2.id } },
      update: {},
      create: { userId: productionManager.id, roleId: productionRoleObj2.id },
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: hubManager.id, roleId: hubRoleObj2.id } },
      update: {},
      create: { userId: hubManager.id, roleId: hubRoleObj2.id },
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId: storeManager.id, roleId: storeRoleObj2.id } },
      update: {},
      create: { userId: storeManager.id, roleId: storeRoleObj2.id },
    }),
  ])

  // Inherit manager role permissions to these users (if manager role has mapped permissions)
  try {
    await inheritRolePermissionsToUser(productionManager.id, productionRoleObj2.id)
    await inheritRolePermissionsToUser(hubManager.id, hubRoleObj2.id)
    await inheritRolePermissionsToUser(storeManager.id, storeRoleObj2.id)
  } catch (err) {
    console.warn('Could not inherit permissions for managers (manager role may have no permissions yet).', err)
  }

  // Map users to inventories (UserInventory)
  const userInventoryPromises: any[] = []
  if (productionInventory) {
    userInventoryPromises.push(
      prisma.userInventory.upsert({
        where: { userId_inventoryId: { userId: productionManager.id, inventoryId: productionInventory.id } },
        update: {},
        create: { userId: productionManager.id, inventoryId: productionInventory.id },
      })
    )
  }
  for (const hub of hubInventories) {
    userInventoryPromises.push(
      prisma.userInventory.upsert({
        where: { userId_inventoryId: { userId: hubManager.id, inventoryId: hub.id } },
        update: {},
        create: { userId: hubManager.id, inventoryId: hub.id },
      })
    )
  }
  for (const store of storeInventories) {
    userInventoryPromises.push(
      prisma.userInventory.upsert({
        where: { userId_inventoryId: { userId: storeManager.id, inventoryId: store.id } },
        update: {},
        create: { userId: storeManager.id, inventoryId: store.id },
      })
    )
  }

  await Promise.all(userInventoryPromises)
  console.log('✅ Assigned managers to relevant inventories')

  // 15. Initialize stock records for each inventory and SKU with small quantities
  console.log('📊 Initializing stock for inventories and SKUs...')
  const stockPromises: any[] = []
  for (const inv of createdInventories) {
    for (const sku of createdSkus) {
      stockPromises.push(
        prisma.stock.upsert({
          where: { inventoryId_skuId: { inventoryId: inv.id, skuId: sku.id } },
          update: {},
          create: {
            inventoryId: inv.id,
            skuId: sku.id,
            quantity: Math.floor(Math.random() * 50) + 10,
          },
        })
      )
    }
  }
  await Promise.all(stockPromises)
  console.log('✅ Stock initialized for inventories')

  // 16. Create a sample production batch and add batch items (adds to stock)
  console.log('🧪 Creating a sample production batch in production inventory...')
  if (productionInventory) {
    const batchId = `BATCH-${Date.now().toString().slice(-6)}`
    const batch = await prisma.batch.create({
      data: {
        batchId,
        inventoryId: productionInventory.id,
        productionDate: new Date(),
      },
    })

    // Add items to batch and update stock (transactional)
    const batchItems = [
      { sku: createdSkus[0], quantity: 20 },
      { sku: createdSkus[1], quantity: 15 },
    ]

    await prisma.$transaction(async (tx) => {
      for (const item of batchItems) {
        await tx.batchItem.create({
          data: {
            batchId: batch.id,
            skuId: item.sku.id,
            quantity: item.quantity,
          },
        })

        // Upsert stock record to add produced quantity
        await tx.stock.upsert({
          where: { inventoryId_skuId: { inventoryId: productionInventory.id, skuId: item.sku.id } },
          update: { quantity: { increment: item.quantity } as any },
          create: { inventoryId: productionInventory.id, skuId: item.sku.id, quantity: item.quantity },
        })
      }
    })
    console.log(`✅ Created batch ${batch.batchId} and updated stock in production inventory`)
  }

  console.log('\n✅ Seed completed successfully!')
  console.log('\n📋 Summary:')
  console.log(`   - Preserved independent entities (not deleted):`)
  console.log(`     • Users, Roles, Modules, Features, Privileges`)
  console.log(`   - Inventories created/ensured: ${createdInventories.length}`)
  console.log(`   - SKUs created/ensured: ${createdSkus.length}`)
  console.log(`   - Employees created/ensured: ${createdEmployees.length}`)
  console.log(`   - Manager users created/ensured: 3`)
  console.log(`   - Sample stock initialized for all inventories and SKUs`)
  console.log(`   - Sample batch created in production inventory (if available)`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
