"use client"

import React, { useEffect, useMemo, useRef } from 'react'
import ChatInput from './ChatInput'
import MessageBubble from './MessageBubble'
import MultiAgentSummary from './MultiAgentSummary'
import DebateMessage from './DebateMessage'
import MessageSkeleton from './MessageSkeleton'
import { useSessionStore } from '@/stores/useSessionStore'

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
    if (activeSession?.mode !== 'multi-agent') {
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
  }, [activeSession?.mode, messages])

  if (!activeSession) return <div className="flex-1 flex items-center justify-center text-muted-foreground">请选择或新建一个会话</div>

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-1 flex-col overflow-hidden">
      <div 
        className="flex-1 overflow-y-auto bg-transparent px-5 py-10 md:px-10 lg:px-14"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div className="mx-auto max-w-[52rem] space-y-9 pb-8">
          {messages.map((message) => (
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
          ))}

          {activeSession.mode === 'multi-agent' && latestMultiAgentTurn && !isTyping && (
            <MultiAgentSummary
              summary={multiAgentSummaries[latestMultiAgentTurn.userMessageId]}
              isLoading={Boolean(multiAgentSummaryLoading[latestMultiAgentTurn.userMessageId])}
              error={multiAgentSummaryErrors[latestMultiAgentTurn.userMessageId]}
              onGenerate={() => generateMultiAgentSummary(activeSession.id, latestMultiAgentTurn.userMessageId)}
            />
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
        
        <div className="relative z-20 mx-auto w-full max-w-[52rem] px-5">
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
