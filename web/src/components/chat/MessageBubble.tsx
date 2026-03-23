import ReactMarkdown from 'react-markdown'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Mode } from '@/stores/useSessionStore'

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
  agentName?: string
  modeSnapshot?: Mode
}

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role.toLowerCase() === 'user'
  const isSystem = message.role.toLowerCase() === 'system'

  const getModeLabel = (mode?: Mode) => {
    switch (mode) {
      case 'multi-agent':
        return '多Agent协助'
      case 'debate':
        return '圆桌会议'
      case 'normal':
      default:
        return '普通问答'
    }
  }

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      {isUser ? (
        <div className="ml-auto flex w-full max-w-none flex-row-reverse items-start gap-3 md:gap-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-slate-900 text-[10px] font-semibold tracking-[0.12em] text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
             VU
          </div>
          
          <div className="flex min-w-0 flex-1 flex-col items-end pt-0.5">
             <div className="mb-2 flex items-center gap-2 pr-1">
               <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">You</span>
             </div>
            
            <div className="max-w-[92%] rounded-[1.6rem] rounded-tr-lg border border-border/70 bg-white/95 px-5 py-3.5 shadow-[0_8px_26px_rgba(15,23,42,0.05)] sm:max-w-[85%] dark:bg-card/92">
              <div className="chat-markdown chat-markdown-user text-left">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
            {message.modeSnapshot && (
              <div className="mt-2 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {getModeLabel(message.modeSnapshot)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-none items-start gap-3 md:gap-4">
          {(() => {
            const name = message.agentName || ''
            let avatarStyle = "border-border/70 bg-white text-foreground dark:bg-card"
            let icon = <Bot className="h-5 w-5" />

            if (name.includes('DeepSeek')) {
              avatarStyle = "border-slate-700 bg-slate-900 text-white dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900"
              icon = <span className="text-[10px] font-semibold tracking-[0.08em]">DS</span>
            } else if (name.includes('Xiaomi')) {
              avatarStyle = "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-200"
              icon = <span className="text-[10px] font-semibold tracking-[0.08em]">XM</span>
            } else if (name.includes('Doubao')) {
              avatarStyle = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200"
              icon = <span className="text-[10px] font-semibold tracking-[0.08em]">DB</span>
            } else if (name.includes('汇总')) {
              avatarStyle = "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/12 dark:text-indigo-200"
              icon = <Bot className="h-5 w-5" />
            } else if (name.includes('系统')) {
              avatarStyle = "border-border bg-muted text-muted-foreground"
              icon = <span className="text-[10px] font-semibold tracking-[0.08em]">SYS</span>
            }

            return (
              <div className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all",
                avatarStyle
              )}>
                {icon}
              </div>
            )
          })()}
          
          <div className="flex min-w-0 flex-1 flex-col pt-0.5">
             <div className="mb-2 flex items-center gap-2">
               <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{message.agentName || 'Veritas AI'}</span>
               {isSystem && (
                 <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">System</span>
               )}
             </div>
            
            <div className={cn(
              "max-w-[48rem]",
              !isSystem && "pr-3",
              isSystem && "rounded-[1.5rem] border border-border/70 bg-white/75 px-5 py-4 shadow-[0_8px_26px_rgba(15,23,42,0.04)] dark:bg-muted/65"
            )}>
              <div className={cn(
                "chat-markdown break-words",
                isSystem ? "chat-markdown-system" : "chat-markdown-assistant"
              )}>
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
