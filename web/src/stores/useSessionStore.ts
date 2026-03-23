import { create } from 'zustand'
import { API_BASE } from '@/lib/config'

export type Mode = 'normal' | 'multi-agent' | 'debate'

const normalizeMode = (value?: string | null): Mode | undefined => {
  if (!value) return undefined
  return value.toLowerCase().replace('_', '-') as Mode
}

const normalizeRole = (value?: string | null): Message['role'] => {
  const normalized = value?.toLowerCase()

  if (normalized === 'user' || normalized === 'assistant' || normalized === 'system') {
    return normalized
  }

  return 'assistant'
}

const normalizeMessage = (message: any): Message => ({
  ...message,
  role: normalizeRole(message.role),
  modeSnapshot: normalizeMode(message.modeSnapshot),
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJsonWithRetry<T>(url: string, init?: RequestInit, retries = 2): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`)
      }

      return await res.json()
    } catch (error) {
      lastError = error

      if (attempt < retries) {
        await wait(250 * (attempt + 1))
      }
    }
  }

  throw lastError
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  agentId?: string
  agentName?: string
  modeSnapshot?: Mode
}

export interface Session {
  id: string
  title: string
  mode: Mode
  createdAt: string
  messageCount: number
  messages: Message[]
}

export interface MultiAgentSummaryPoint {
  id: string
  content: string
  consensusPercent: number
  supportingAgents: string[]
}

export interface MultiAgentAgentAnswer {
  agentId?: string
  agentName: string
  content: string
}

export interface MultiAgentSummaryData {
  userMessageId: string
  question: string
  overallSummary: string
  totalAgents: number
  points: MultiAgentSummaryPoint[]
  agentAnswers: MultiAgentAgentAnswer[]
}

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  isLoading: boolean
  isTyping: boolean
  activeEventSource: EventSource | null
  multiAgentSummaries: Record<string, MultiAgentSummaryData>
  multiAgentSummaryLoading: Record<string, boolean>
  multiAgentSummaryErrors: Record<string, string>
  
  // Actions
  fetchSessions: () => Promise<void>
  setActiveSession: (id: string) => Promise<void>
  addMessage: (sessionId: string, message: Message) => void
  updateMessageContent: (sessionId: string, messageId: string, content: string) => void
  createSession: (title?: string, mode?: Mode) => Promise<string>
  updateSessionMode: (sessionId: string, mode: Mode) => Promise<void>
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>
  sendMessage: (sessionId: string, content: string) => Promise<void>
  generateMultiAgentSummary: (sessionId: string, userMessageId: string) => Promise<void>
  stopGenerating: () => void
}

const parseStoredSummary = (rawContent?: string | null): MultiAgentSummaryData | null => {
  if (!rawContent) return null

  try {
    const parsed = JSON.parse(rawContent) as MultiAgentSummaryData
    return parsed?.userMessageId ? parsed : null
  } catch (error) {
    console.error('Failed to parse stored multi-agent summary:', error)
    return null
  }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  isTyping: false,
  activeEventSource: null,
  multiAgentSummaries: {},
  multiAgentSummaryLoading: {},
  multiAgentSummaryErrors: {},

  stopGenerating: () => {
    const { activeEventSource } = get()
    if (activeEventSource) {
      activeEventSource.close()
      set({ activeEventSource: null, isTyping: false })
    }
  },

  fetchSessions: async () => {
    set({ isLoading: true })
    try {
      const data = await fetchJsonWithRetry<any[]>(`${API_BASE}/sessions`)
      const sessions = data.map((s: any) => ({
        ...s,
        mode: s.mode.toLowerCase().replace('_', '-'),
        messageCount: s._count?.messages ?? 0,
        messages: Array.isArray(s.messages) ? s.messages.map(normalizeMessage) : [],
      }))
      set({ sessions, isLoading: false })
      if (sessions.length > 0 && !get().activeSessionId) {
        get().setActiveSession(sessions[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      set({ isLoading: false })
    }
  },

  setActiveSession: async (id) => {
    set({ activeSessionId: id })
    try {
      const sessionData = await fetchJsonWithRetry<any>(`${API_BASE}/sessions/${id}`)
      const storedSummaries = Array.isArray(sessionData.storedSummaries)
        ? sessionData.storedSummaries
            .map((item: any) => parseStoredSummary(item?.content))
            .filter((item: MultiAgentSummaryData | null): item is MultiAgentSummaryData => Boolean(item))
        : []

      set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === id
            ? {
                ...s,
                messageCount: Array.isArray(sessionData.messages) ? sessionData.messages.length : s.messageCount,
                messages: Array.isArray(sessionData.messages)
                  ? sessionData.messages.map(normalizeMessage)
                  : [],
              }
            : s
        ),
        multiAgentSummaries: {
          ...state.multiAgentSummaries,
          ...Object.fromEntries(
            storedSummaries.map((summary: MultiAgentSummaryData) => [summary.userMessageId, summary])
          ),
        },
      }))
    } catch (error) {
      console.error('Failed to fetch session messages:', error)
    }
  },

  addMessage: (sessionId, message) => set((state) => ({
    sessions: state.sessions.map((session) => 
      session.id === sessionId 
        ? { ...session, messageCount: session.messageCount + 1, messages: [...(session.messages || []), message] }
        : session
    )
  })),

  updateMessageContent: (sessionId, messageId, content) => set((state) => ({
    sessions: state.sessions.map((session) => 
      session.id === sessionId 
        ? { 
            ...session, 
            messages: (session.messages || []).map(m => m.id === messageId ? { ...m, content } : m) 
          }
        : session
    )
  })),

  createSession: async (title = '新会话', mode = 'normal') => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, mode: mode.toUpperCase().replace('-', '_') }),
      })
      const newSession = await res.json()
      const formattedSession = {
        ...newSession,
        mode: newSession.mode.toLowerCase().replace('_', '-'),
        messageCount: 0,
        messages: []
      }
      set((state) => ({
        sessions: [formattedSession, ...state.sessions],
        activeSessionId: formattedSession.id
      }))
      return formattedSession.id
    } catch (error) {
      console.error('Failed to create session:', error)
      return ''
    }
  },

  updateSessionMode: async (sessionId, mode) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode.toUpperCase().replace('-', '_') }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.message || '当前会话模式无法修改')
      }

      set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === sessionId ? { ...s, mode } : s
        )
      }))
    } catch (error) {
      console.error('Failed to update session mode:', error)
    }
  },

  updateSessionTitle: async (sessionId, title) => {
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === sessionId ? { ...s, title } : s
        )
      }))
    } catch (error) {
      console.error('Failed to update session title:', error)
    }
  },

  sendMessage: async (sessionId, content) => {
    const session = get().sessions.find(s => s.id === sessionId);
    if (session && (session.messages?.length ?? 0) === 0 && session.title === '新会话') {
      const newTitle = content.length > 20 ? content.slice(0, 20) + '...' : content;
      get().updateSessionTitle(sessionId, newTitle);
    }

    // 1. Add user message locally
    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      modeSnapshot: session?.mode,
    }
    get().addMessage(sessionId, userMsg)
    set({ isTyping: true })

    try {
      // 2. Start SSE Stream
      const url = `${API_BASE}/chat/stream?sessionId=${sessionId}&content=${encodeURIComponent(content)}`
      const eventSource = new EventSource(url)
      set({ activeEventSource: eventSource })
      
      let streamCompleted = false
      let hasRenderedResponse = false
      const isMultiAgentMode = session?.mode === 'multi-agent'
      const isMultiTurnMode = session?.mode === 'multi-agent' || session?.mode === 'debate'
      let messageSeq = 0
      let activeTurnCount = 0
      const activeAgentMessages = new Map<string, { messageId: string; content: string }>()

      const getAgentKey = (agentName?: string, agentId?: string) =>
        `${agentId || 'anonymous'}::${agentName || 'Veritas AI'}`

      const ensureAgentMessage = (
        agentName?: string,
        agentId?: string,
        options?: { createPlaceholder?: boolean }
      ) => {
        const key = getAgentKey(agentName, agentId)
        let streamState = activeAgentMessages.get(key)

        if (!streamState) {
          streamState = {
            messageId: `temp-ai-${Date.now()}-${messageSeq++}`,
            content: '',
          }
          activeAgentMessages.set(key, streamState)

          if (options?.createPlaceholder) {
            get().addMessage(sessionId, {
              id: streamState.messageId,
              role: 'assistant',
              content: '',
              agentId,
              agentName: agentName || 'Veritas AI',
              createdAt: new Date().toISOString(),
              modeSnapshot: session?.mode,
            })
          }
        }

        return { key, streamState }
      }

      eventSource.onmessage = (event) => {
        // Handle multiple JSON objects in one message if they arrive together
        const chunks = event.data.split('\n').filter((c: string) => c.trim())
        
        for (const rawChunk of chunks) {
          try {
            const data = JSON.parse(rawChunk)
            const { content, agentId, agentName, control } = data
            
            if (control === 'start_turn') {
              ensureAgentMessage(agentName, agentId, { createPlaceholder: isMultiAgentMode })
              activeTurnCount += 1
              set({ isTyping: true })
              continue
            }

            if (control === 'end_turn') {
              const key = getAgentKey(agentName, agentId)
              activeAgentMessages.delete(key)
              activeTurnCount = Math.max(0, activeTurnCount - 1)
              if (!streamCompleted && activeTurnCount === 0) {
                set({ isTyping: false })
              }
              continue
            }

            if (control === 'stream_done') {
              streamCompleted = true
              eventSource.close()
              set({ isTyping: false, activeEventSource: null })
              continue
            }

            if (content) {
              hasRenderedResponse = true
              const { streamState } = ensureAgentMessage(agentName, agentId)
              const nextContent = `${streamState.content}${content}`

              if (isMultiAgentMode) {
                get().updateMessageContent(sessionId, streamState.messageId, nextContent)
              } else if (!streamState.content) {
                if (!isMultiTurnMode) {
                  set({ isTyping: false })
                }
                get().addMessage(sessionId, {
                  id: streamState.messageId,
                  role: 'assistant',
                  content: nextContent,
                  agentId,
                  agentName: agentName || 'Veritas AI',
                  createdAt: new Date().toISOString(),
                  modeSnapshot: session?.mode,
                })
              } else {
                get().updateMessageContent(sessionId, streamState.messageId, nextContent)
              }

              streamState.content = nextContent
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk:', rawChunk, e)
          }
        }
      }

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err)
        eventSource.close()
        if (!streamCompleted && !hasRenderedResponse) {
          get().addMessage(sessionId, {
            id: `system-error-${Date.now()}`,
            role: 'system',
            content: '当前请求没有成功完成。请检查该模式是否已经配置可用模型与凭证，然后重试。',
            agentName: '系统',
            createdAt: new Date().toISOString(),
            modeSnapshot: session?.mode,
          })
        }
        set({ isTyping: false, activeEventSource: null })
      }

      // Cleanup on completion or unexpected close
      // Note: NestJS SSE finishes when the stream completes
    } catch (error) {
      console.error('Failed to send message:', error)
      set({ isTyping: false })
    }
  },

  generateMultiAgentSummary: async (sessionId, userMessageId) => {
    if (get().multiAgentSummaryLoading[userMessageId]) {
      return
    }

    set((state) => ({
      multiAgentSummaryLoading: {
        ...state.multiAgentSummaryLoading,
        [userMessageId]: true,
      },
      multiAgentSummaryErrors: {
        ...state.multiAgentSummaryErrors,
        [userMessageId]: '',
      },
    }))

    try {
      const res = await fetch(`${API_BASE}/chat/multi-agent-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessageId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.message || '多人协助总结生成失败，请稍后重试')
      }

      set((state) => ({
        multiAgentSummaries: {
          ...state.multiAgentSummaries,
          [userMessageId]: data,
          [data.userMessageId]: data,
        },
        multiAgentSummaryLoading: {
          ...state.multiAgentSummaryLoading,
          [userMessageId]: false,
        },
      }))
    } catch (error) {
      set((state) => ({
        multiAgentSummaryLoading: {
          ...state.multiAgentSummaryLoading,
          [userMessageId]: false,
        },
        multiAgentSummaryErrors: {
          ...state.multiAgentSummaryErrors,
          [userMessageId]: error instanceof Error ? error.message : '多人协助总结生成失败，请稍后重试',
        },
      }))
    }
  },
}))
