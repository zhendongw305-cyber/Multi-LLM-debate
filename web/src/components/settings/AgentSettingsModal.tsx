"use client"

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE } from '@/lib/config'
import { cn } from '@/lib/utils'

interface Credential {
  id: string
  name: string
  provider: string
  baseURL?: string | null
  defaultHeaders?: Record<string, string> | null
  active: boolean
  hasApiKey: boolean
  apiKeyPreview: string
}

interface AgentConfig {
  id: string
  name: string
  provider: string
  modelName: string
  systemPrompt?: string | null
  active: boolean
  roleType?: string | null
  sortOrder: number
  includeInNormal: boolean
  includeInMultiAgent: boolean
  includeInDebate: boolean
  credentialId?: string | null
}

interface ConfigResponse {
  credentials: Credential[]
  agents: AgentConfig[]
}

interface Props {
  open: boolean
  onClose: () => void
}

interface AgentDraft {
  name: string
  provider: string
  modelName: string
  systemPrompt: string
  roleType: string
  sortOrder: number
  includeInNormal: boolean
  includeInMultiAgent: boolean
  includeInDebate: boolean
  active: boolean
  credentialId: string
}

const emptyCredential = {
  name: '',
  provider: '',
  apiKey: '',
  baseURL: '',
  defaultHeadersText: '',
  active: true,
}

const emptyAgent = {
  name: '',
  provider: '',
  modelName: '',
  systemPrompt: '',
  roleType: '',
  sortOrder: 0,
  includeInNormal: true,
  includeInMultiAgent: true,
  includeInDebate: false,
  active: true,
  credentialId: '',
}

const fieldClass =
  'w-full rounded-2xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-border focus:bg-background'

const textAreaClass =
  'w-full rounded-2xl border border-border/80 bg-background/80 px-3.5 py-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-border focus:bg-background'

export default function AgentSettingsModal({ open, onClose }: Props) {
  const [config, setConfig] = useState<ConfigResponse>({ credentials: [], agents: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [credentialForm, setCredentialForm] = useState(emptyCredential)
  const [agentForm, setAgentForm] = useState(emptyAgent)
  const [mounted, setMounted] = useState(false)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [agentDrafts, setAgentDrafts] = useState<Record<string, AgentDraft>>({})

  const credentialsById = useMemo(
    () => Object.fromEntries(config.credentials.map((item) => [item.id, item])),
    [config.credentials],
  )

  const createAgentDraft = (agent: AgentConfig): AgentDraft => ({
    name: agent.name,
    provider: agent.provider,
    modelName: agent.modelName,
    systemPrompt: agent.systemPrompt || '',
    roleType: agent.roleType || '',
    sortOrder: agent.sortOrder,
    includeInNormal: agent.includeInNormal,
    includeInMultiAgent: agent.includeInMultiAgent,
    includeInDebate: agent.includeInDebate,
    active: agent.active,
    credentialId: agent.credentialId || '',
  })

  const loadConfig = async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/agents/config`)
      const data = await res.json()
      setConfig(data)
    } catch (err) {
      setError('加载模型配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open || !mounted) return null

  const submitCredential = async () => {
    setError('')
    try {
      const defaultHeaders = credentialForm.defaultHeadersText.trim()
        ? JSON.parse(credentialForm.defaultHeadersText)
        : null

      const res = await fetch(`${API_BASE}/agents/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: credentialForm.name,
          provider: credentialForm.provider,
          apiKey: credentialForm.apiKey,
          baseURL: credentialForm.baseURL || null,
          defaultHeaders,
          active: credentialForm.active,
        }),
      })

      if (!res.ok) {
        throw new Error('create credential failed')
      }

      setCredentialForm(emptyCredential)
      await loadConfig()
    } catch (err) {
      setError('新增凭证失败，请检查 JSON Header 格式或字段内容')
    }
  }

  const submitAgent = async () => {
    setError('')
    try {
      const res = await fetch(`${API_BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: agentForm.name,
            provider: agentForm.provider,
            modelName: agentForm.modelName,
            systemPrompt: agentForm.systemPrompt || null,
            roleType: agentForm.roleType || null,
            sortOrder: Number(agentForm.sortOrder) || 0,
            includeInNormal: agentForm.includeInNormal,
            includeInMultiAgent: agentForm.includeInMultiAgent,
            includeInDebate: agentForm.includeInDebate,
            active: agentForm.active,
          credentialId: agentForm.credentialId || null,
        }),
      })

      if (!res.ok) {
        throw new Error('create agent failed')
      }

      setAgentForm(emptyAgent)
      await loadConfig()
    } catch (err) {
      setError('新增模型失败')
    }
  }

  const patchCredential = async (id: string, payload: Record<string, unknown>) => {
    await fetch(`${API_BASE}/agents/credentials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await loadConfig()
  }

  const patchAgent = async (id: string, payload: Record<string, unknown>) => {
    await fetch(`${API_BASE}/agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await loadConfig()
  }

  const deleteCredential = async (id: string) => {
    await fetch(`${API_BASE}/agents/credentials/${id}`, { method: 'DELETE' })
    await loadConfig()
  }

  const deleteAgent = async (id: string) => {
    await fetch(`${API_BASE}/agents/${id}`, { method: 'DELETE' })
    await loadConfig()
  }

  const startEditingAgent = (agent: AgentConfig) => {
    setEditingAgentId(agent.id)
    setAgentDrafts((prev) => ({
      ...prev,
      [agent.id]: createAgentDraft(agent),
    }))
  }

  const cancelEditingAgent = (agentId: string) => {
    setEditingAgentId((current) => (current === agentId ? null : current))
    setAgentDrafts((prev) => {
      const next = { ...prev }
      delete next[agentId]
      return next
    })
  }

  const updateAgentDraft = (agentId: string, patch: Partial<AgentDraft>) => {
    setAgentDrafts((prev) => {
      const current = prev[agentId]
      if (!current) return prev
      return {
        ...prev,
        [agentId]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  const saveEditingAgent = async (agentId: string) => {
    const draft = agentDrafts[agentId]
    if (!draft) return

    setError('')
    try {
      await patchAgent(agentId, {
        name: draft.name,
        provider: draft.provider,
        modelName: draft.modelName,
        systemPrompt: draft.systemPrompt || null,
        roleType: draft.roleType || null,
        sortOrder: Number(draft.sortOrder) || 0,
        includeInNormal: draft.includeInNormal,
        includeInMultiAgent: draft.includeInMultiAgent,
        includeInDebate: draft.includeInDebate,
        active: draft.active,
        credentialId: draft.credentialId || null,
      })
      cancelEditingAgent(agentId)
    } catch (err) {
      setError('保存模型修改失败')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md">
      <div className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-border/80 bg-background/94 shadow-[0_28px_120px_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">Configuration</div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight">模型与凭证管理</h2>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">新增 Key、配置模型，并控制它是否参与普通问答、多人协助、圆桌会议，或作为专门的总结角色。</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-border/80 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            关闭
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1.1fr_1.4fr]">
          <div className="overflow-y-auto border-r border-border/80 p-6">
            <div className="mb-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">新增凭证</h3>
              <div className="mt-3 space-y-3">
                <input
                  value={credentialForm.name}
                  onChange={(e) => setCredentialForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="凭证名称，例如 DeepSeek 主账号"
                  className={fieldClass}
                />
                <input
                  value={credentialForm.provider}
                  onChange={(e) => setCredentialForm((prev) => ({ ...prev, provider: e.target.value }))}
                  placeholder="供应商，例如 deepseek / openai / xiaomi"
                  className={fieldClass}
                />
                <input
                  value={credentialForm.apiKey}
                  onChange={(e) => setCredentialForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="API Key"
                  className={fieldClass}
                />
                <input
                  value={credentialForm.baseURL}
                  onChange={(e) => setCredentialForm((prev) => ({ ...prev, baseURL: e.target.value }))}
                  placeholder="Base URL，可选"
                  className={fieldClass}
                />
                <textarea
                  value={credentialForm.defaultHeadersText}
                  onChange={(e) => setCredentialForm((prev) => ({ ...prev, defaultHeadersText: e.target.value }))}
                  placeholder='默认 Headers JSON，可选，例如 {"api-key":"xxx"}'
                  className={cn(textAreaClass, 'min-h-[108px]')}
                />
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={credentialForm.active}
                    onChange={(e) => setCredentialForm((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  启用凭证
                </label>
                <button
                  onClick={submitCredential}
                  className="rounded-full bg-foreground px-4 py-2 text-[12px] font-medium text-background shadow-sm"
                >
                  保存凭证
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">已有凭证</h3>
              <div className="mt-3 space-y-3">
                {config.credentials.map((credential) => (
                  <div key={credential.id} className="rounded-[22px] border border-border/80 bg-card/80 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">{credential.name}</div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{credential.provider}</div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {credential.apiKeyPreview || '未显示 Key'}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteCredential(credential.id)}
                        className="text-[12px] text-red-500 transition-colors hover:text-red-600"
                      >
                        删除
                      </button>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={credential.active}
                        onChange={(e) => patchCredential(credential.id, { active: e.target.checked })}
                      />
                      启用
                    </label>
                  </div>
                ))}
                {config.credentials.length === 0 && (
                  <div className="rounded-[22px] border border-dashed border-border/70 bg-background/40 p-4 text-[13px] text-muted-foreground">
                    还没有配置任何凭证。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-6">
            <div className="mb-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">新增参与模型</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={agentForm.name}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="显示名称，例如 GPT-4.1 (总结)"
                  className={fieldClass}
                />
                <input
                  value={agentForm.provider}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, provider: e.target.value }))}
                  placeholder="provider"
                  className={fieldClass}
                />
                <input
                  value={agentForm.modelName}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, modelName: e.target.value }))}
                  placeholder="modelName，例如 gpt-4.1-mini"
                  className={fieldClass}
                />
                <input
                  value={agentForm.roleType}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, roleType: e.target.value }))}
                  placeholder="角色，例如 analysis / risk / execution / summary"
                  className={fieldClass}
                />
                <input
                  type="number"
                  value={agentForm.sortOrder}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                  placeholder="排序"
                  className={fieldClass}
                />
                <select
                  value={agentForm.credentialId}
                  onChange={(e) => {
                    const credential = credentialsById[e.target.value]
                    setAgentForm((prev) => ({
                      ...prev,
                      credentialId: e.target.value,
                      provider: credential?.provider || prev.provider,
                    }))
                  }}
                  className={fieldClass}
                >
                  <option value="">选择凭证</option>
                  {config.credentials.map((credential) => (
                    <option key={credential.id} value={credential.id}>
                      {credential.name} ({credential.provider})
                    </option>
                  ))}
                </select>
                <textarea
                  value={agentForm.systemPrompt}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="这个模型的系统提示词，可选"
                  className={cn(textAreaClass, 'min-h-[132px] md:col-span-2')}
                />
                <div className="flex flex-wrap gap-4 text-[13px] text-muted-foreground md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={agentForm.active}
                      onChange={(e) => setAgentForm((prev) => ({ ...prev, active: e.target.checked }))}
                    />
                    启用模型
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={agentForm.includeInNormal}
                      onChange={(e) => setAgentForm((prev) => ({ ...prev, includeInNormal: e.target.checked }))}
                    />
                    参与普通问答
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={agentForm.includeInMultiAgent}
                      onChange={(e) => setAgentForm((prev) => ({ ...prev, includeInMultiAgent: e.target.checked }))}
                    />
                    参与多人协助
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={agentForm.includeInDebate}
                      onChange={(e) => setAgentForm((prev) => ({ ...prev, includeInDebate: e.target.checked }))}
                    />
                    参与圆桌会议
                  </label>
                </div>
                <div className="md:col-span-2 text-[12px] leading-6 text-muted-foreground">
                  如果这个模型专门负责“总结此次回答”，请把角色填写为 <span className="font-medium text-foreground">summary</span>，并且不要勾选上面的参与模式。
                </div>
                <button
                  onClick={submitAgent}
                  className="w-fit rounded-full bg-foreground px-4 py-2 text-[12px] font-medium text-background shadow-sm md:col-span-2"
                >
                  保存模型
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">已配置模型</h3>
              <div className="mt-3 space-y-3">
                {config.agents.map((agent) => (
                  <div key={agent.id} className="rounded-[22px] border border-border/80 bg-card/80 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">{agent.name}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {agent.provider} / {agent.modelName}
                        </div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          凭证：{credentialsById[agent.credentialId || '']?.name || '未绑定'} · 排序：{agent.sortOrder}{agent.roleType ? ` · 角色：${agent.roleType}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => startEditingAgent(agent)}
                          className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => deleteAgent(agent.id)}
                          className="text-[12px] text-red-500 transition-colors hover:text-red-600"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    {editingAgentId === agent.id ? (
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input
                          value={agentDrafts[agent.id]?.name || ''}
                          onChange={(e) => updateAgentDraft(agent.id, { name: e.target.value })}
                          placeholder="显示名称"
                          className={fieldClass}
                        />
                        <input
                          value={agentDrafts[agent.id]?.provider || ''}
                          onChange={(e) => updateAgentDraft(agent.id, { provider: e.target.value })}
                          placeholder="provider"
                          className={fieldClass}
                        />
                        <input
                          value={agentDrafts[agent.id]?.modelName || ''}
                          onChange={(e) => updateAgentDraft(agent.id, { modelName: e.target.value })}
                          placeholder="modelName"
                          className={fieldClass}
                        />
                        <input
                          value={agentDrafts[agent.id]?.roleType || ''}
                          onChange={(e) => updateAgentDraft(agent.id, { roleType: e.target.value })}
                          placeholder="角色，例如 summary"
                          className={fieldClass}
                        />
                        <input
                          type="number"
                          value={agentDrafts[agent.id]?.sortOrder ?? 0}
                          onChange={(e) => updateAgentDraft(agent.id, { sortOrder: Number(e.target.value) })}
                          placeholder="排序"
                          className={fieldClass}
                        />
                        <select
                          value={agentDrafts[agent.id]?.credentialId || ''}
                          onChange={(e) => {
                            const credential = credentialsById[e.target.value]
                            updateAgentDraft(agent.id, {
                              credentialId: e.target.value,
                              provider: credential?.provider || agentDrafts[agent.id]?.provider || '',
                            })
                          }}
                          className={fieldClass}
                        >
                          <option value="">选择凭证</option>
                          {config.credentials.map((credential) => (
                            <option key={credential.id} value={credential.id}>
                              {credential.name} ({credential.provider})
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={agentDrafts[agent.id]?.systemPrompt || ''}
                          onChange={(e) => updateAgentDraft(agent.id, { systemPrompt: e.target.value })}
                          placeholder="这个模型的系统提示词，可选"
                          className={cn(textAreaClass, 'min-h-[132px] md:col-span-2')}
                        />
                        <div className="flex flex-wrap gap-4 text-[13px] text-muted-foreground md:col-span-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agentDrafts[agent.id]?.active || false}
                              onChange={(e) => updateAgentDraft(agent.id, { active: e.target.checked })}
                            />
                            启用
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agentDrafts[agent.id]?.includeInNormal || false}
                              onChange={(e) => updateAgentDraft(agent.id, { includeInNormal: e.target.checked })}
                            />
                            普通问答
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agentDrafts[agent.id]?.includeInMultiAgent || false}
                              onChange={(e) => updateAgentDraft(agent.id, { includeInMultiAgent: e.target.checked })}
                            />
                            多人协助
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agentDrafts[agent.id]?.includeInDebate || false}
                              onChange={(e) => updateAgentDraft(agent.id, { includeInDebate: e.target.checked })}
                            />
                            圆桌会议
                          </label>
                        </div>
                        <div className="flex items-center gap-3 md:col-span-2">
                          <button
                            onClick={() => saveEditingAgent(agent.id)}
                            className="rounded-full bg-foreground px-4 py-2 text-[12px] font-medium text-background shadow-sm"
                          >
                            保存修改
                          </button>
                          <button
                            onClick={() => cancelEditingAgent(agent.id)}
                            className="rounded-full border border-border/80 px-4 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agent.active}
                              onChange={(e) => patchAgent(agent.id, { active: e.target.checked })}
                            />
                            启用
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agent.includeInNormal}
                              onChange={(e) => patchAgent(agent.id, { includeInNormal: e.target.checked })}
                            />
                            普通问答
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agent.includeInMultiAgent}
                              onChange={(e) => patchAgent(agent.id, { includeInMultiAgent: e.target.checked })}
                            />
                            多人协助
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={agent.includeInDebate}
                              onChange={(e) => patchAgent(agent.id, { includeInDebate: e.target.checked })}
                            />
                            圆桌会议
                          </label>
                        </div>

                        {agent.systemPrompt && (
                          <div className="mt-3 rounded-2xl border border-border/70 bg-background/70 px-3.5 py-3 text-[12px] leading-6 text-muted-foreground">
                            {agent.systemPrompt}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {config.agents.length === 0 && (
                  <div className="rounded-[22px] border border-dashed border-border/70 bg-background/40 p-4 text-[13px] text-muted-foreground">
                    还没有配置任何模型。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={cn('border-t border-border/80 px-6 py-3 text-[13px]', error ? 'text-red-500' : 'text-muted-foreground')}>
          {error || (isLoading ? '加载中...' : '保存后会立即参与后续模式；普通问答默认使用排序最靠前的已启用模型。')}
        </div>
      </div>
    </div>,
    document.body
  )
}
