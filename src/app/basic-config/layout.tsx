'use client'

import { AppLayout } from '@/components/AppLayout'

export default function BasicConfigLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
