"use client"

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot, MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DebateRound {
  id: string
  agentName: string
  agentColor: string
  content: string
  targetAgentName?: string
}

export default function DebateMessage({ round }: { round: DebateRound }) {
  return (
    <div className="mx-auto my-2 w-full max-w-[52rem] animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-start gap-3 md:gap-4">
        <div className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all",
          round.agentColor
        )}>
          <Bot className="h-4 w-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{round.agentName}</span>
            {round.targetAgentName && (
              <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <MessagesSquare className="h-3 w-3" />
                <span>回应 {round.targetAgentName}</span>
              </div>
            )}
          </div>

          <div className="max-w-[48rem] pr-3">
            <div className="chat-markdown chat-markdown-assistant break-words">
              <ReactMarkdown>{round.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
