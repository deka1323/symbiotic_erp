'use client'

import { AppLayout } from '@/components/AppLayout'

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
