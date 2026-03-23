import React from 'react'
import { Bot, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MessageSkeleton() {
  return (
    <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex w-full max-w-none items-start gap-3 md:gap-4">
        <div className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background shadow-sm">
          <Bot className="h-5 w-5 text-muted-foreground/50" />
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
        </div>
        
        <div className="flex min-w-0 flex-1 flex-col pt-0.5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">Veritas AI</span>
            <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary/60 animate-pulse">
              <Sparkles className="h-3 w-3" />
              正在思考...
            </span>
          </div>
          
          <div className="flex w-fit items-center gap-1.5 rounded-full border border-border/80 bg-card/85 px-4 py-3 shadow-sm">
            <div className="h-1.5 w-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="h-1.5 w-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="h-1.5 w-1.5 bg-foreground/30 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  )
}
