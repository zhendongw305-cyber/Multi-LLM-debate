"use client"

import { useState, useRef, useEffect } from 'react'
import { Send, Users, Mic, Settings2, MessageSquare, MessagesSquare, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSessionStore, Mode } from '@/stores/useSessionStore'
import AgentSettingsModal from '@/components/settings/AgentSettingsModal'

interface ChatInputProps {
  onSend: (message: string) => void
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { sessions, activeSessionId, updateSessionMode, isTyping, stopGenerating } = useSessionStore()
  const activeSession = sessions.find(s => s.id === activeSessionId)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSend = () => {
    if (input.trim()) {
      onSend(input)
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectMode = (mode: Mode) => {
    if (activeSession) {
      updateSessionMode(activeSession.id, mode)
    }
    setIsDropdownOpen(false)
  }

  const getModeInfo = (mode?: Mode) => {
    switch (mode) {
      case 'multi-agent':
        return { icon: <Users className="w-4 h-4" />, text: '多Agent协助', classes: 'text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10' }
      case 'debate':
        return { icon: <MessagesSquare className="w-4 h-4" />, text: '圆桌会议', classes: 'text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10' }
      case 'normal':
      default:
        return { icon: <MessageSquare className="w-4 h-4" />, text: '普通问答', classes: 'text-muted-foreground hover:text-foreground hover:bg-accent' }
    }
  }

  const modeDisplay = getModeInfo(activeSession?.mode)

  return (
    <div className="relative flex w-full flex-col rounded-[2rem] border border-border/70 bg-white/92 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-all focus-within:border-border focus-within:ring-1 focus-within:ring-border dark:border-white/10 dark:bg-[rgba(22,24,31,0.92)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={activeSession?.mode === 'debate' ? "输入会议主题，或继续补充你的想法..." : "给 Veritas AI 发送消息..."}
        className="min-h-[66px] max-h-[220px] w-full resize-none bg-transparent px-6 py-5 text-[16px] leading-8 placeholder:text-muted-foreground/75 focus:outline-none overflow-y-auto dark:text-slate-100 dark:placeholder:text-slate-500"
        rows={1}
      />
      
      <div className="relative flex items-center justify-between px-5 pb-5">
        <div className="flex items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button 
              type="button" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              title="选择对话模式"
              className={cn("flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3.5 py-2 text-[12px] font-medium shadow-sm transition-colors hover:border-border dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10", modeDisplay.classes, isDropdownOpen && "border-border bg-accent dark:bg-white/10")}
            >
              {modeDisplay.icon}
              <span className="text-[12px] font-medium">{modeDisplay.text}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform opacity-50", isDropdownOpen && "rotate-180")} />
            </button>
            
            {isDropdownOpen && (
              <div className="animate-in fade-in zoom-in-95 absolute bottom-full left-0 z-50 mb-2 flex w-52 flex-col gap-0.5 overflow-hidden rounded-[1.4rem] border border-border/75 bg-popover/96 p-1.5 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl duration-200 dark:border-white/10 dark:bg-[rgba(26,28,36,0.96)]">
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">选择 AI 响应模式</div>
                
                <button
                  onClick={() => selectMode('normal')}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-[13px] transition-colors", activeSession?.mode === 'normal' ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground")}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>普通问答</span>
                </button>
                
                <button
                  onClick={() => selectMode('multi-agent')}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-[13px] transition-colors", activeSession?.mode === 'multi-agent' ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300 font-medium" : "text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:text-sky-300")}
                >
                  <Users className="w-4 h-4" />
                  <span>多Agent协助</span>
                </button>
                
                <button
                  onClick={() => selectMode('debate')}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-[13px] transition-colors", activeSession?.mode === 'debate' ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300 font-medium" : "text-muted-foreground hover:bg-violet-50 hover:text-violet-700 dark:hover:text-violet-300")}
                >
                  <MessagesSquare className="w-4 h-4" />
                  <span>圆桌会议</span>
                </button>
              </div>
            )}
          </div>
          
          <button 
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="ml-1 rounded-full border border-border/60 bg-background/70 p-2 text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-accent hover:text-foreground dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10 dark:hover:text-slate-100"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            className="hidden rounded-full border border-border/60 bg-background/70 p-2 text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-accent hover:text-foreground dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10 dark:hover:text-slate-100 sm:block"
          >
            <Mic className="w-4 h-4" />
          </button>
          
          {isTyping ? (
            <button
              onClick={stopGenerating}
              className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-red-500/20 bg-red-50 px-4 text-[12px] font-medium text-red-600 transition-all hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300"
            >
              <div className="w-2.5 h-2.5 bg-current rounded-sm" />
              停止生成
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                 "flex h-10 w-10 items-center justify-center rounded-full border transition-all",
                 input.trim() 
                  ? "border-slate-900 bg-slate-900 text-white shadow-[0_8px_22px_rgba(15,23,42,0.14)] dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900" 
                  : "cursor-not-allowed border-border/80 bg-muted/80 text-muted-foreground opacity-60"
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <AgentSettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}
