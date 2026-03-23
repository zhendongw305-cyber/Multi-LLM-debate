"use client"

import { useMemo, useRef, useEffect, useState } from 'react'
import { Bot, CheckCircle2, ChevronDown, Layers, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MultiAgentSummaryData } from '@/stores/useSessionStore'

interface MultiAgentSummaryProps {
  summary?: MultiAgentSummaryData
  isLoading?: boolean
  error?: string
  onGenerate?: () => void
}

export default function MultiAgentSummary({
  summary,
  isLoading = false,
  error,
  onGenerate,
}: MultiAgentSummaryProps) {
  const [activeView, setActiveView] = useState('summary')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setActiveView('summary')
  }, [summary?.userMessageId])

  const views = useMemo(() => {
    if (!summary) {
      return [{ id: 'summary', name: '本轮共识汇总' }]
    }

    return [
      { id: 'summary', name: '本轮共识汇总' },
      ...summary.agentAnswers.map((answer, index) => ({
        id: `agent-${index}`,
        name: answer.agentName,
      })),
    ]
  }, [summary])

  const currentAgent = views.find((view) => view.id === activeView) || views[0]
  const currentAgentAnswer =
    summary && activeView !== 'summary'
      ? summary.agentAnswers[Number(activeView.replace('agent-', ''))]
      : null

  if (!summary) {
    return (
      <div className="my-5 overflow-hidden rounded-[1.8rem] border border-border/70 bg-white/88 shadow-[0_10px_34px_rgba(15,23,42,0.045)]">
        <div className="border-b border-border/70 bg-background/72 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
              多模型回答总结
            </h3>
          </div>
        </div>

        <div className="px-5 py-5">
          <p className="text-[14px] leading-7 text-muted-foreground">
            本轮多 Agent 回答已经结束。你可以让系统把这一轮所有 AI 的结论整理成一份共识摘要，并给出每条观点被多少模型共同提到的百分比。
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isLoading ? '正在总结...' : '总结此次回答'}
            </button>

            {error && (
              <span className="text-[12px] text-red-600">
                {error}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="my-5 w-full overflow-hidden rounded-[1.8rem] border border-border/70 bg-white/88 shadow-[0_10px_34px_rgba(15,23,42,0.045)]">
      <div className="flex items-center gap-2 border-b border-border/70 bg-background/72 px-4 py-3.5">
        {activeView === 'summary' ? <Layers className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
          {activeView === 'summary' ? '多模型共识汇总' : `单一模型视角: ${currentAgent.name}`}
        </h3>

        <div className="ml-auto relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {currentAgent.name}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-[1.35rem] border border-border/75 bg-popover/96 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
              <div className="py-1">
                {views.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => {
                      setActiveView(view.id)
                      setIsDropdownOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors",
                      activeView === view.id ? "bg-accent/70 text-foreground font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {view.id === 'summary' ? <Layers className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    <span className="truncate">{view.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        {activeView === 'summary' ? (
          <div className="space-y-5">
            <div className="rounded-[1.35rem] border border-border/70 bg-background/70 px-4.5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
                本轮问题
              </div>
              <p className="mt-2 text-[14px] leading-7 text-foreground">
                {summary.question}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-border/70 bg-background/70 px-4.5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
                总体结论
              </div>
              <p className="mt-2 text-[14px] leading-7 text-foreground">
                {summary.overallSummary}
              </p>
            </div>

            <div className="space-y-4">
              {summary.points.map((point) => (
                <div key={point.id} className="rounded-[1.2rem] border border-border/70 bg-white/70 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className={cn(
                      "mt-0.5 h-4.5 w-4.5 shrink-0",
                      point.consensusPercent === 100 ? "text-emerald-600" : point.consensusPercent >= 67 ? "text-sky-600" : "text-amber-600"
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-7 text-foreground">
                        {point.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                          point.consensusPercent === 100
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : point.consensusPercent >= 67
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        )}>
                          {point.consensusPercent}% 被提及
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          支持模型：{point.supportingAgents.join('、')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
              {currentAgentAnswer?.agentName}
            </div>
            <div className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-foreground">
              {currentAgentAnswer?.content}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
