import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Veritas AI - 多模型讨论与协作系统',
  description: 'AI网页应用 - 普通问答、多AI参与、圆桌会议与协作总结',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
