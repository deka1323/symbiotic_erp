'use client'

import { usePathname } from 'next/navigation'
import { AppLayout } from '@/components/AppLayout'

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (pathname?.includes('/print')) {
    return <>{children}</>
  }
  return <AppLayout>{children}</AppLayout>
}