"use client"

import React, { useEffect } from 'react'
import { PlusCircle, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/useSessionStore'

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function Sidebar({ className, ...props }: SidebarProps) {
  const { sessions, activeSessionId, createSession, setActiveSession, fetchSessions } = useSessionStore()

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleNewChat = async () => {
    await createSession()
  }

  return (
    <aside className={cn('p-4', className)} {...props}>
      <div className="flex h-full flex-col">
        <div className="mb-4 rounded-[1.45rem] border border-border/70 bg-white/80 px-4 py-3.5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-white/8 dark:bg-white/5 dark:shadow-none">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
              Workspace
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-foreground">
              Veritas AI
            </div>
          </div>
        </div>

        <button 
          onClick={handleNewChat}
          className="flex w-full items-center gap-2 rounded-[1.35rem] border border-border/70 bg-white/85 px-4 py-3 text-sm font-medium text-foreground shadow-[0_8px_26px_rgba(15,23,42,0.035)] transition-all hover:border-border hover:bg-white dark:border-white/10 dark:bg-white/4 dark:text-slate-100 dark:shadow-none dark:hover:bg-white/7"
        >
          <PlusCircle className="h-4 w-4" />
          新建会话
        </button>

        <div className="mt-5 flex-1 overflow-y-auto">
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
            会话历史
          </div>
          
          {sessions.map((session) => (
            <button 
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={cn(
                "group relative mb-1.5 flex w-full items-center gap-3 overflow-hidden rounded-[1.2rem] border px-3.5 py-3 text-left text-[13px] transition-all",
                activeSessionId === session.id 
                  ? "border-transparent bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(245,247,250,0.72))] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-md dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.06))] dark:text-slate-50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.16)]" 
                  : "border-transparent text-muted-foreground hover:bg-white/75 hover:text-foreground dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
              )}
            >
              <MessageSquare className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                activeSessionId === session.id ? "text-slate-950 dark:text-slate-50" : "text-muted-foreground/80 group-hover:text-foreground"
              )} />
              <span className={cn(
                "flex-1 truncate pr-1",
                activeSessionId === session.id ? "font-semibold tracking-[-0.01em]" : "font-medium"
              )}>
                {session.title}
              </span>
            </button>
          ))}
          
          {sessions.length === 0 && (
            <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-white/55 px-4 py-5 text-center text-xs text-muted-foreground dark:border-white/10 dark:bg-white/4 dark:text-slate-400">
              暂无会话历史
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border/80 pt-4">
          <button className="flex w-full items-center gap-3 rounded-[1.25rem] border border-transparent px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/70 dark:text-slate-100 dark:hover:bg-white/5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-white text-[10px] font-semibold text-foreground shadow-sm dark:border-white/10 dark:bg-white/6 dark:text-slate-100 dark:shadow-none">
              VU
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[13px] font-medium">Veritas User</div>
              <div className="truncate text-[11px] text-muted-foreground dark:text-slate-400">Local workspace</div>
            </div>
          </button>
        </div>
      </div>
    </aside>
  )
}
