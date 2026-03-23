"use client"

import ChatArea from '@/components/chat/ChatArea'
import { useSidebarLayout } from '@/components/layout/AppShell'
import { useSessionStore } from '@/stores/useSessionStore'
import { cn } from '@/lib/utils'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export default function Home() {
  const { sessions, activeSessionId } = useSessionStore()
  const { isSidebarOpen, toggleSidebar } = useSidebarLayout()
  const activeSession = sessions.find(s => s.id === activeSessionId)
  
  const getModeBadge = () => {
    switch (activeSession?.mode) {
      case 'multi-agent':
        return { text: '多模型协作模式', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/12 dark:text-blue-300' }
      case 'debate':
        return { text: '圆桌会议模式', className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/12 dark:text-violet-300' }
      case 'normal':
      default:
        return { text: '普通问答', className: 'border-border/80 bg-secondary text-secondary-foreground' }
    }
  }

  const badge = getModeBadge()

  return (
    <div className="flex flex-col h-full w-full relative">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/80 bg-background/78 px-5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 md:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white/80 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground md:inline-flex"
            title={isSidebarOpen ? '收起会话栏' : '展开会话栏'}
            aria-label={isSidebarOpen ? '收起会话栏' : '展开会话栏'}
          >
            {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
              Conversation
            </div>
            <h1 className="mt-1 truncate text-[16px] font-semibold tracking-[-0.02em] text-foreground">
              {activeSession?.title || 'Veritas AI 会话'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {activeSession && (
             <span className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                badge.className
             )}>
                {badge.text}
             </span>
           )}
        </div>
      </header>

      
      <ChatArea />
    </div>
  )
}
