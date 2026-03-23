import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageRole, SessionMode } from '@prisma/client';
import { Observable } from 'rxjs';
import { DebateService } from './debate.service';
import { MultiAgentService } from './multi-agent.service';
import { AgentsService } from '../agents/agents.service';
import { MULTI_AGENT_SUMMARY_TARGET_PREFIX } from './chat.constants';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private debateService: DebateService,
    private multiAgentService: MultiAgentService,
    private agentsService: AgentsService,
  ) {}

  private async getSessionWithRecentMessages(sessionId: string, limit: number) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: {
            OR: [
              {
                targetAgent: null,
              },
              {
                targetAgent: {
                  not: {
                    startsWith: MULTI_AGENT_SUMMARY_TARGET_PREFIX,
                  },
                },
              },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        },
      },
    });

    if (!session) return null;

    return {
      ...session,
      messages: [...session.messages].reverse(),
    };
  }

  private async getSessionMode(sessionId: string): Promise<SessionMode> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { mode: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return session.mode;
  }

  async sendMessage(sessionId: string, content: string, role: MessageRole = 'USER') {
    const sessionMode = await this.getSessionMode(sessionId);

    // 1. Persist user message
    await this.prisma.message.create({
      data: {
        sessionId,
        content,
        role,
        modeSnapshot: sessionMode,
      },
    });

    // 2. Fetch session and history for context
    const session = await this.getSessionWithRecentMessages(sessionId, 20);

    if (!session) throw new Error('Session not found');

    // 3. Orchestrate based on mode
    if (session.mode === 'NORMAL') {
      return this.handleNormalChat(session);
    } else if (session.mode === 'MULTI_AGENT') {
      return this.handleMultiAgentChat(session);
    } else if (session.mode === 'DEBATE') {
      return this.handleDebateChat(session);
    }
  }

  async sendMessageStream(sessionId: string, content: string, signal?: AbortSignal): Promise<Observable<any>> {
    const sessionMode = await this.getSessionMode(sessionId);

    // 1. Persist user message
    await this.prisma.message.create({
      data: {
        sessionId,
        content,
        role: 'USER',
        modeSnapshot: sessionMode,
      },
    });

    const session = await this.getSessionWithRecentMessages(sessionId, 15);

    if (!session) throw new Error('Session not found');

    console.log(`[Stream] Starting stream for session ${sessionId}. Mode: ${session.mode}`);

    const normalizedMode = (session.mode || '').toUpperCase();

    if (normalizedMode === 'DEBATE') {
      return this.debateService.runDebate(sessionId, content, signal);
    } else if (normalizedMode === 'MULTI_AGENT') {
      return this.multiAgentService.runMultiAgent(sessionId, content, signal);
    }

    return new Observable((subscriber) => {
      (async () => {
        try {
          const runtimeAgents = await this.agentsService.getRuntimeAgents('NORMAL');
          const normalAgent = runtimeAgents[0];

          if (!normalAgent) {
            throw new Error('当前还没有可用的普通问答模型，请先到设置面板配置并启用模型与凭证');
          }

          const stream = await normalAgent.client.chat.completions.create({
            model: normalAgent.modelName,
            messages: [
              {
                role: 'system',
                content:
                  normalAgent.systemPrompt ||
                  '你是一个专业的AI助手。以下内容来自同一会话的连续交流，请结合此前上下文理解问题；最后一条 user 消息就是当前最新提问。',
              },
              ...session.messages.map(m => ({ 
                role: m.role.toLowerCase() as any, 
                content: m.content 
              }))
            ],
            stream: true,
          }, { signal });

          let fullContent = '';
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              subscriber.next({ data: { content } });
            }
          }

          // Persist the complete assistant message once finished
          await this.prisma.message.create({
            data: {
              sessionId,
              content: fullContent,
              role: 'ASSISTANT',
              modeSnapshot: session.mode,
              agentId: normalAgent.id,
              agentName: normalAgent.name,
            },
          });

          subscriber.next({ data: { control: 'stream_done' } });
          subscriber.complete();
        } catch (err: any) {
          if (err.name === 'AbortError') {
             console.log(`[Stream] Client disconnected or task aborted.`);
             subscriber.complete();
             return;
          }
          const errorMessage =
            err?.message || '普通问答被迫中断，请检查当前模式是否已配置可用模型与凭证';

          subscriber.next({
            data: {
              content: `\n\n[系统异常]: 普通问答被迫中断 - ${errorMessage}`,
              agentName: '系统',
            },
          });
          subscriber.next({ data: { control: 'end_turn', agentName: '系统' } });
          subscriber.next({ data: { control: 'stream_done' } });
          subscriber.complete();
        }
      })();
    });
  }

  async summarizeMultiAgentRound(sessionId: string, userMessageId?: string) {
    return this.multiAgentService.summarizeRound(sessionId, userMessageId);
  }

  private async handleNormalChat(session: any) {
    const runtimeAgents = await this.agentsService.getRuntimeAgents('NORMAL');
    const normalAgent = runtimeAgents[0];

    if (!normalAgent) {
      throw new Error('当前还没有可用的普通问答模型，请先到设置面板配置并启用模型与凭证');
    }

    const messages = session.messages.map(m => ({
      role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: m.content
    }));

    const response = await normalAgent.client.chat.completions.create({
      model: normalAgent.modelName,
      messages: [
        {
          role: 'system',
          content:
            normalAgent.systemPrompt ||
            '以下内容来自同一会话的连续交流，请结合上下文回答；如果用户是在追问，就延续前文而不是把它当成全新问题。',
        },
        ...messages,
      ],
    });

    const aiContent = response.choices[0].message.content;

    return this.prisma.message.create({
      data: {
        sessionId: session.id,
        content: aiContent || '',
        role: 'ASSISTANT',
        modeSnapshot: session.mode,
        agentId: normalAgent.id,
        agentName: normalAgent.name,
      },
    });
  }

  private async handleMultiAgentChat(session: any) {
    const runtimeAgents = await this.agentsService.getRuntimeAgents('MULTI_AGENT');
    const coordinator = runtimeAgents[0];

    if (!coordinator) {
      throw new Error('No active multi-agent model is configured');
    }

    const response = await coordinator.client.chat.completions.create({
      model: coordinator.modelName,
      messages: [
        {
          role: 'system',
          content:
            coordinator.systemPrompt ||
            '你现在扮演多模型协作汇总 Agent。以下内容来自同一会话的连续交流，请结合前文脉络理解最后一条用户提问，并在此前讨论基础上继续推进。',
        },
        ...session.messages.map(m => ({ role: m.role.toLowerCase(), content: m.content }))
      ],
    });

    return this.prisma.message.create({
      data: {
        sessionId: session.id,
        content: response.choices[0].message.content || '',
        role: 'ASSISTANT',
        modeSnapshot: session.mode,
        agentId: coordinator.id,
        agentName: coordinator.name,
      },
    });
  }

  private async handleDebateChat(session: any) {
    const runtimeAgents = await this.agentsService.getRuntimeAgents('DEBATE');
    const moderator = runtimeAgents[0];

    if (!moderator) {
      throw new Error('No active discussion model is configured');
    }

    const response = await moderator.client.chat.completions.create({
      model: moderator.modelName,
      messages: [
        {
          role: 'system',
          content:
            moderator.systemPrompt ||
            '你正在主持一场圆桌会议。以下内容来自同一会话的连续交流，请基于前文脉络继续讨论最新问题，而不是把它视为孤立的新话题。',
        },
        ...session.messages.map(m => ({ role: m.role.toLowerCase(), content: m.content }))
      ],
    });

    return this.prisma.message.create({
      data: {
        sessionId: session.id,
        content: response.choices[0].message.content || '',
        role: 'ASSISTANT',
        modeSnapshot: session.mode,
        agentId: moderator.id,
        agentName: moderator.name,
      },
    });
  }
}
