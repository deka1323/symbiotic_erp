'use client'

import { AppLayout } from '@/components/AppLayout'

export default function AccessControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
