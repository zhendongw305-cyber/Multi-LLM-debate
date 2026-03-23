"use client"

import React, { useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot } from 'lucide-react'
import ChatInput from './ChatInput'
import MessageBubble from './MessageBubble'
import MultiAgentSummary from './MultiAgentSummary'
import DebateMessage from './DebateMessage'
import MessageSkeleton from './MessageSkeleton'
import { useSessionStore } from '@/stores/useSessionStore'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  agentId?: string
  agentName?: string
  modeSnapshot?: 'normal' | 'multi-agent' | 'debate'
}

interface MultiAgentRound {
  user: ChatMessage
  assistants: ChatMessage[]
  systems: ChatMessage[]
}

function getAgentCardStyle(name = '') {
  if (name.includes('DeepSeek')) {
    return {
      frame: 'border-sky-200/80 bg-sky-50/72 dark:border-sky-500/20 dark:bg-sky-500/10',
      badge: 'border-sky-300/80 bg-sky-100 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
      dot: 'bg-sky-500',
    }
  }

  if (name.includes('Xiaomi')) {
    return {
      frame: 'border-amber-200/80 bg-amber-50/72 dark:border-amber-500/20 dark:bg-amber-500/10',
      badge: 'border-amber-300/80 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
      dot: 'bg-amber-500',
    }
  }

  if (name.includes('Doubao')) {
    return {
      frame: 'border-violet-200/80 bg-violet-50/72 dark:border-violet-500/20 dark:bg-violet-500/10',
      badge: 'border-violet-300/80 bg-violet-100 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200',
      dot: 'bg-violet-500',
    }
  }

  return {
    frame: 'border-border/75 bg-white/80 dark:bg-card/80',
    badge: 'border-border/75 bg-background/85 text-foreground',
    dot: 'bg-slate-500',
  }
}

function MultiAgentResponseGrid({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return null
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${messages.length}, minmax(18rem, 1fr))`,
        }}
      >
        {messages.map((message) => {
          const style = getAgentCardStyle(message.agentName)

          return (
            <article
              key={message.id}
              className={cn(
                'min-w-0 rounded-[1.8rem] border p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl',
                style.frame
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                    Agent Response
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full shadow-sm', style.dot)} />
                    <h3 className="truncate text-[14px] font-semibold text-foreground">
                      {message.agentName || 'Veritas AI'}
                    </h3>
                  </div>
                </div>

                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                    style.badge
                  )}
                >
                  <Bot className="h-3 w-3" />
                  Live
                </span>
              </div>

              <div className="chat-markdown chat-markdown-assistant break-words text-left">
                {message.content ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  <div className="flex min-h-24 items-center gap-2.5 text-sm text-muted-foreground">
                    <span className={cn('h-2 w-2 animate-pulse rounded-full', style.dot)} />
                    <span>{message.agentName || 'Veritas AI'} 正在生成中...</span>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default function ChatArea() {
  const {
    sessions,
    activeSessionId,
    sendMessage,
    fetchSessions,
    isTyping,
    multiAgentSummaries,
    multiAgentSummaryLoading,
    multiAgentSummaryErrors,
    generateMultiAgentSummary,
  } = useSessionStore()
  
  useEffect(() => {
    fetchSessions()
  }, [])
  
  const activeSession = sessions.find(s => s.id === activeSessionId)
  const messages = activeSession?.messages || []
  const isMultiAgentMode = activeSession?.mode === 'multi-agent'

  // Scroll to bottom anchor
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAutoScrollEnabled = useRef(true)

  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
    isAutoScrollEnabled.current = isAtBottom
  }

  useEffect(() => {
    if (isAutoScrollEnabled.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  // Reset scroll to bottom when switching sessions
  useEffect(() => {
    isAutoScrollEnabled.current = true
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
    }, 50)
  }, [activeSessionId])

  const latestMultiAgentTurn = useMemo(() => {
    if (!isMultiAgentMode) {
      return null
    }

    let latestUserIndex = -1
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user' && messages[index].modeSnapshot === 'multi-agent') {
        latestUserIndex = index
        break
      }
    }

    if (latestUserIndex === -1) {
      return null
    }

    const userMessage = messages[latestUserIndex]
    const followingMessages = messages.slice(latestUserIndex + 1)
    const assistantMessages = followingMessages.filter((message) => message.role === 'assistant')

    if (assistantMessages.length === 0) {
      return null
    }

    return {
      userMessageId: userMessage.id,
      assistantMessages,
    }
  }, [isMultiAgentMode, messages])

  const multiAgentRounds = useMemo(() => {
    if (!isMultiAgentMode) {
      return [] as MultiAgentRound[]
    }

    const rounds: MultiAgentRound[] = []
    let currentRound: MultiAgentRound | null = null

    for (const rawMessage of messages) {
      const message = rawMessage as ChatMessage

      if (message.role === 'user') {
        if (currentRound) {
          rounds.push(currentRound)
        }

        currentRound = {
          user: message,
          assistants: [],
          systems: [],
        }
        continue
      }

      if (!currentRound) {
        continue
      }

      if (message.role === 'assistant') {
        currentRound.assistants.push(message)
      } else {
        currentRound.systems.push(message)
      }
    }

    if (currentRound) {
      rounds.push(currentRound)
    }

    return rounds
  }, [isMultiAgentMode, messages])

  if (!activeSession) return <div className="flex-1 flex items-center justify-center text-muted-foreground">请选择或新建一个会话</div>

  const contentWidthClass = isMultiAgentMode ? 'max-w-[90rem]' : 'max-w-[52rem]'
  const inputWidthClass = isMultiAgentMode ? 'max-w-[72rem]' : 'max-w-[52rem]'

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-1 flex-col overflow-hidden">
      <div 
        className="flex-1 overflow-y-auto bg-transparent px-5 py-10 md:px-10 lg:px-14"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div className={cn('mx-auto space-y-9 pb-8', contentWidthClass)}>
          {isMultiAgentMode ? (
            multiAgentRounds.map((round) => {
              const isLatestRound = latestMultiAgentTurn?.userMessageId === round.user.id

              return (
                <section key={round.user.id} className="space-y-5">
                  <MessageBubble message={round.user} />

                  {round.assistants.length > 0 && <MultiAgentResponseGrid messages={round.assistants} />}

                  {round.systems.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}

                  {isLatestRound && !isTyping && (
                    <MultiAgentSummary
                      summary={multiAgentSummaries[round.user.id]}
                      isLoading={Boolean(multiAgentSummaryLoading[round.user.id])}
                      error={multiAgentSummaryErrors[round.user.id]}
                      onGenerate={() => generateMultiAgentSummary(activeSession.id, round.user.id)}
                    />
                  )}
                </section>
              )
            })
          ) : (
            messages.map((message) => (
              <React.Fragment key={message.id}>
                {activeSession.mode === 'debate' && message.role === 'assistant' ? (
                  <DebateMessage round={{
                    id: message.id,
                    agentName: message.agentName || 'Veritas AI',
                    agentColor: (message.agentName?.includes('DeepSeek') || message.id.includes('ds')) ? 'bg-blue-600' : 
                                 (message.agentName?.includes('Xiaomi') || message.id.includes('xm')) ? 'bg-orange-600' : 
                                 (message.agentName?.includes('Doubao') || message.id.includes('db')) ? 'bg-purple-600' : 'bg-slate-700',
                    content: message.content,
                  }} />
                ) : (
                  <MessageBubble message={message} />
                )}
              </React.Fragment>
            ))
          )}
          
          {messages.length === 0 && !isTyping && (
            <div className="rounded-[2rem] border border-border/75 bg-white/78 px-7 py-8 shadow-[0_14px_40px_rgba(15,23,42,0.045)] backdrop-blur-xl dark:bg-card/78">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
                Ready
              </div>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-foreground">
                开始一段更清晰的多模型对话
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-8 text-muted-foreground">
                普通问答适合快速确认结论，多人协助适合补充风险与执行路径，圆桌会议更适合把复杂问题逐步聊透。
              </p>
            </div>
          )}

          {isTyping && <MessageSkeleton />}

          <div className="h-4" />
          <div ref={bottomRef} />
        </div>
      </div>
      
      <div className="relative w-full shrink-0 bg-background/78 pb-6 pt-4 backdrop-blur-xl">
        <div className="pointer-events-none absolute bottom-full left-0 right-0 h-20 bg-gradient-to-t from-background via-background/68 to-transparent" />
        
        <div className={cn('relative z-20 mx-auto w-full px-5', inputWidthClass)}>
          <ChatInput onSend={(val) => {
             if (activeSessionId) sendMessage(activeSessionId, val)
             isAutoScrollEnabled.current = true
             setTimeout(() => {
               bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
             }, 50)
          }} />
          <div className="mt-2 text-center">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/55">
              Veritas AI - 多模型协作可能产生一定时间延迟
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
