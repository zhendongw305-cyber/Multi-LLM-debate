"use client"

import { createContext, useContext, useMemo, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'

type SidebarLayoutContextValue = {
  isSidebarOpen: boolean
  toggleSidebar: () => void
}

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null)

export function useSidebarLayout() {
  const context = useContext(SidebarLayoutContext)

  if (!context) {
    throw new Error('useSidebarLayout must be used within AppShell')
  }

  return context
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const value = useMemo(
    () => ({
      isSidebarOpen,
      toggleSidebar: () => setIsSidebarOpen((current) => !current),
    }),
    [isSidebarOpen],
  )

  return (
    <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
      <SidebarLayoutContext.Provider value={value}>
        <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground antialiased">
          <div
            className={cn(
              "hidden flex-shrink-0 overflow-hidden border-r border-border/70 bg-white/70 backdrop-blur-xl transition-[width,opacity,border-color] duration-300 md:block",
              isSidebarOpen ? "w-[286px] opacity-100" : "w-0 opacity-0 border-r-transparent",
            )}
          >
            <Sidebar className="h-full w-[286px] min-w-[286px]" />
          </div>
          <main className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden bg-transparent">
            {children}
          </main>
        </div>
      </SidebarLayoutContext.Provider>
    </ThemeProvider>
  )
}
