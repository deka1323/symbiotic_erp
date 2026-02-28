'use client'

import { AppLayout } from '@/components/AppLayout'

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}

