import { ReactNode } from 'react'
import { Home, LayoutDashboard, Shield, Key, Lock, Zap, ShieldCheck, Users, DollarSign, Settings, Package, Warehouse, FileText, BarChart3 } from 'lucide-react'

export interface MenuItem {
  label: string
  href: string
  icon: ReactNode
  isStandalone?: boolean // true for Home, Dashboard
  children?: MenuItem[]
  // Permission metadata - if not provided, item is always shown
  permission?: {
    moduleCode: string
    featureCode: string
    privilegeCode?: string // Default: 'view'
  }
}

export const sidebarMenuItems: MenuItem[] = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: <Home className="w-4 h-4" />,
    isStandalone: true,
  },
  {
    label: 'Access Control',
    href: '/access-control',
    icon: <Shield className="w-4 h-4" />,
    children: [
      {
        label: 'Roles',
        href: '/access-control/roles',
        icon: <Key className="w-4 h-4" />,
        permission: {
          moduleCode: 'access-control',
          featureCode: 'role_management',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Modules',
        href: '/access-control/modules',
        icon: <Lock className="w-4 h-4" />,
        permission: {
          moduleCode: 'access-control',
          featureCode: 'module_management',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Features',
        href: '/access-control/features',
        icon: <Zap className="w-4 h-4" />,
        permission: {
          moduleCode: 'access-control',
          featureCode: 'feature_management',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Privileges',
        href: '/access-control/privileges',
        icon: <ShieldCheck className="w-4 h-4" />,
        permission: {
          moduleCode: 'access-control',
          featureCode: 'privilege_management',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Users',
        href: '/access-control/users',
        icon: <Users className="w-4 h-4" />,
        permission: {
          moduleCode: 'access-control',
          featureCode: 'user_management',
          privilegeCode: 'view',
        },
      },
    ],
  },
  {
    label: 'Basic Configuration',
    href: '/basic-config',
    icon: <Settings className="w-4 h-4" />,
    children: [
      {
        label: 'SKUs',
        href: '/basic-config/skus',
        icon: <Package className="w-4 h-4" />,
        permission: {
          moduleCode: 'basic-configuration',
          featureCode: 'show_skus_in_sidebar',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Inventories',
        href: '/basic-config/inventories',
        icon: <Warehouse className="w-4 h-4" />,
        permission: {
          moduleCode: 'basic-configuration',
          featureCode: 'show_inventories_in_sidebar',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Employees',
        href: '/basic-config/employees',
        icon: <Users className="w-4 h-4" />,
        permission: {
          moduleCode: 'basic-configuration',
          featureCode: 'show_employees_in_sidebar',
          privilegeCode: 'view',
        },
      },
    ],
  },
  {
    label: 'Production',
    href: '/production',
    icon: <Package className="w-4 h-4" />,
    children: [
      {
        label: 'Daily Production',
        href: '/production/daily-production',
        icon: <Zap className="w-4 h-4" />,
        permission: {
          moduleCode: 'production',
          featureCode: 'show_daily-production_in_sidebar',
          privilegeCode: 'view',
        },
      },
    ],
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: <Warehouse className="w-4 h-4" />,
    children: [
      {
        label: 'Purchase Orders',
        href: '/inventory/purchase-orders',
        icon: <FileText className="w-4 h-4" />,
        permission: {
          moduleCode: 'inventory',
          featureCode: 'show_purchase-orders_in_sidebar',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Transfer Orders',
        href: '/inventory/transfer-orders',
        icon: <FileText className="w-4 h-4" />,
        permission: {
          moduleCode: 'inventory',
          featureCode: 'show_transfer-orders_in_sidebar',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Receive Orders',
        href: '/inventory/receive-orders',
        icon: <FileText className="w-4 h-4" />,
        permission: {
          moduleCode: 'inventory',
          featureCode: 'show_receive-orders_in_sidebar',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Manage Stock',
        href: '/inventory/manage-stock',
        icon: <Package className="w-4 h-4" />,
        permission: {
          moduleCode: 'inventory',
          featureCode: 'show_manage-stock_in_sidebar',
          privilegeCode: 'view',
        },
      },
      {
        label: 'Reports',
        href: '/inventory/reports',
        icon: <BarChart3 className="w-4 h-4" />,
        permission: {
          moduleCode: 'inventory',
          featureCode: 'show_reports_in_sidebar',
          privilegeCode: 'view',
        },
      },
    ],
  },
  {
    label: 'Admin Reports',
    href: '/admin-report',
    icon: <BarChart3 className="w-4 h-4" />,
    children: [
      {
        label: 'Admin Reports',
        href: '/admin-report/admin-reports',
        icon: <BarChart3 className="w-4 h-4" />,
        permission: {
          moduleCode: 'admin-report',
          featureCode: 'show_admin-reports_in_sidebar',
          privilegeCode: 'view',
        },
      },
    ],
  },
  {
    label: 'Finance',
    href: '/finance',
    icon: <DollarSign className="w-4 h-4" />,
    isStandalone: true,
    permission: {
      moduleCode: 'finance',
      featureCode: 'show_finance_main_item_in_sidebar',
      privilegeCode: 'view',
    },
  },
]
