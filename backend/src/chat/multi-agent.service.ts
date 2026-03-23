import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Observable, Subject } from 'rxjs';
import { AgentsService } from '../agents/agents.service';
import { MessageRole, SessionMode } from '@prisma/client';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SummaryAgentAnswer {
  agentId?: string | null;
  agentName: string;
  content: string;
}

interface ParsedSummaryPoint {
  content?: string;
  supportingAgents?: string[];
}

export interface MultiAgentSummaryPoint {
  id: string;
  content: string;
  consensusPercent: number;
  supportingAgents: string[];
}

export interface MultiAgentRoundSummary {
  userMessageId: string;
  question: string;
  overallSummary: string;
  totalAgents: number;
  points: MultiAgentSummaryPoint[];
  agentAnswers: SummaryAgentAnswer[];
}

@Injectable()
export class MultiAgentService {
  constructor(
    private prisma: PrismaService,
    private agentsService: AgentsService,
  ) {}

  private findLastUserMessageIndex(
    messages: { id: string; role: MessageRole; modeSnapshot: SessionMode | null }[],
    userMessageId?: string,
  ) {
    if (userMessageId) {
      const explicitIndex = messages.findIndex(
        (message) => message.id === userMessageId && message.role === 'USER',
      );

      if (explicitIndex !== -1) {
        return explicitIndex;
      }
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'USER' && (message.modeSnapshot === 'MULTI_AGENT' || message.modeSnapshot === null)) {
        return index;
      }
    }

    return -1;
  }

  private extractJsonPayload(rawContent: string) {
    const trimmed = rawContent.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1]?.trim() || trimmed;
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No JSON object found in summary response');
    }

    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  }

  private buildFallbackSummary(question: string, agentAnswers: SummaryAgentAnswer[]): MultiAgentRoundSummary {
    const totalAgents = agentAnswers.length;
    const fallbackPoints = agentAnswers.map((answer, index) => ({
      id: `fallback-${index + 1}`,
      content: `${answer.agentName} 提到：${answer.content.replace(/\s+/g, ' ').trim().slice(0, 80)}${answer.content.length > 80 ? '...' : ''}`,
      consensusPercent: Math.max(1, Math.round((1 / totalAgents) * 100)),
      supportingAgents: [answer.agentName],
    }));

    return {
      userMessageId: '',
      question,
      overallSummary: '本轮已经提取出各模型的主要回答，但结构化共识分析还不够稳定，建议同时查看下方各模型原始输出。',
      totalAgents,
      points: fallbackPoints,
      agentAnswers,
    };
  }

  private async getSummaryContext(sessionId: string, userMessageId?: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.mode !== 'MULTI_AGENT') {
      throw new Error('当前会话不是多人协助模式，无法生成多模型总结');
    }

    const targetUserIndex = this.findLastUserMessageIndex(session.messages, userMessageId);

    if (targetUserIndex === -1) {
      throw new Error('当前会话里还没有可总结的多人协助问题');
    }

    const userMessage = session.messages[targetUserIndex];
    const nextUserIndex = session.messages.findIndex(
      (message, index) => index > targetUserIndex && message.role === 'USER',
    );
    const roundMessages = session.messages.slice(
      targetUserIndex + 1,
      nextUserIndex === -1 ? undefined : nextUserIndex,
    );

    const agentAnswers = roundMessages
      .filter((message) => message.role === 'ASSISTANT' && message.agentName && message.agentName !== '系统')
      .map((message) => ({
        agentId: message.agentId,
        agentName: message.agentName || 'Veritas AI',
        content: message.content,
      }));

    if (agentAnswers.length === 0) {
      throw new Error('当前这轮多人协助还没有完成，暂时无法总结');
    }

    return {
      userMessageId: userMessage.id,
      question: userMessage.content,
      agentAnswers,
    };
  }

  private async getRecentMessages(sessionId: string, limit: number) {
    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse();
  }

  async runMultiAgent(sessionId: string, initialContent: string, signal?: AbortSignal): Promise<Observable<any>> {
    const subject = new Subject<any>();
    
    (async () => {
      try {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
        });
        
        if (!session) {
          subject.error(new Error('Session not found'));
          return;
        }

        const recentMessages = await this.getRecentMessages(sessionId, 20);

        const currentContext: ChatMessage[] = recentMessages.map(m => ({
            role: m.role.toLowerCase() as any,
            content: m.content
        }));

        console.log(`[MultiAgent] Context initialized with ${currentContext.length} messages.`);

        const agentsTemplate = await this.agentsService.getRuntimeAgents('MULTI_AGENT');
        if (agentsTemplate.length === 0) {
          throw new Error('当前还没有可用的多人协助模型，请先到设置面板配置并启用模型与凭证');
        }

        const runAgentTurn = async (config: (typeof agentsTemplate)[number]) => {
          console.log(`[MultiAgent] Starting turn for ${config.name}`);
          subject.next({ data: { control: 'start_turn', agentId: config.id, agentName: config.name } });
          let turnContent = '';

          try {
            const completion = await config.client.chat.completions.create({
              model: config.modelName,
              messages: [
                {
                  role: 'system',
                  content:
                    config.systemPrompt ||
                    '你是一个专业的 AI 协作顾问。请结合当前会话上下文，提供清晰、具体、对整体协作有新增价值的回答。',
                },
                ...currentContext,
              ],
              stream: true,
            }, { signal });

            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                turnContent += content;
                subject.next({ data: { content, agentId: config.id, agentName: config.name } });
              }
            }
            console.log(`[MultiAgent] Finished turn for ${config.name}. Length: ${turnContent.length}`);

            if (turnContent.trim()) {
              await this.prisma.message.create({
                data: {
                  sessionId,
                  content: turnContent,
                  role: 'ASSISTANT',
                  modeSnapshot: session.mode,
                  agentId: config.id,
                  agentName: config.name,
                },
              });
            }
          } catch (err: any) {
            if (err?.name === 'AbortError') {
              throw err;
            }

            console.error(`[MultiAgent] ${config.name} failed`, err);
            subject.next({
              data: {
                content: `\n\n[系统异常]: ${config.name} 回答失败 - ${err?.message || '未知错误'}`,
                agentName: '系统',
              },
            });
          } finally {
            subject.next({ data: { control: 'end_turn', agentId: config.id, agentName: config.name } });
          }
        };

        await Promise.allSettled(agentsTemplate.map((config) => runAgentTurn(config)));

        if (signal?.aborted) {
          console.log(`[MultiAgent] Client disconnected.`);
          subject.complete();
          return;
        }

        subject.next({ data: { control: 'stream_done' } });
        subject.complete();
      } catch (err: any) {
        if (err.name === 'AbortError') {
            console.log(`[MultiAgent] Client disconnected.`);
            subject.complete();
            return;
        }
        console.error(`[MultiAgent ERROR]`, err);
        subject.next({ data: { content: `\n\n[系统异常]: 协作模式被迫中断 - ${err.message}`, agentName: '系统' } });
        subject.next({ data: { control: 'end_turn', agentName: '系统' } });
        subject.next({ data: { control: 'stream_done' } });
        subject.complete();
      }
    })();

    return subject.asObservable();
  }

  async summarizeRound(sessionId: string, userMessageId?: string): Promise<MultiAgentRoundSummary> {
    const { userMessageId: resolvedUserMessageId, question, agentAnswers } = await this.getSummaryContext(
      sessionId,
      userMessageId,
    );

    const summarizer = await this.agentsService.getRuntimeAgentByRoleType('summary');

    if (!summarizer) {
      throw new Error('当前还没有可用的总结模型，请先到设置面板新增一个 roleType=summary 的模型并启用对应凭证');
    }

    const allowedAgentNames = agentAnswers.map((answer) => answer.agentName);
    const totalAgents = allowedAgentNames.length;

    try {
      const response = await summarizer.client.chat.completions.create({
        model: summarizer.modelName,
        messages: [
          {
            role: 'system',
            content: [
              '你是一个负责“多模型回答归纳”的总结助手。',
              '请根据用户问题和各个 AI 的原始回答，提炼出 3 到 6 条高质量总结点。',
              '你必须只输出 JSON，不要输出 Markdown，不要解释，不要加代码块。',
              'JSON 结构必须为：{"overallSummary":"...","points":[{"content":"...","supportingAgents":["Agent A","Agent B"]}]}。',
              'supportingAgents 只能填写下面原始回答里真实出现过的 agentName。',
              '如果某条观点被所有 AI 都明确提到，就把所有 agentName 都放进去。',
              '如果只有部分 AI 提到，就只填提到它的那些 agentName。',
              '不要捏造原文里没有出现的共识，不要把模糊相似但明显不同的观点强行合并。',
              '请用专业、简洁、自然的中文输出。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `用户问题：${question}`,
              '',
              '原始回答如下：',
              ...agentAnswers.map(
                (answer, index) =>
                  `${index + 1}. ${answer.agentName}\n${answer.content}`,
              ),
              '',
              `可用的 agentName 列表：${allowedAgentNames.join('、')}`,
            ].join('\n'),
          },
        ],
      });

      const rawContent = response.choices[0]?.message?.content || '';
      const parsed = this.extractJsonPayload(rawContent) as {
        overallSummary?: string;
        points?: ParsedSummaryPoint[];
      };

      const allowedAgentSet = new Set(allowedAgentNames);
      const points = (parsed.points || [])
        .map((point, index) => {
          const supportingAgents = Array.from(
            new Set((point.supportingAgents || []).filter((name) => allowedAgentSet.has(name))),
          );

          if (!point.content || supportingAgents.length === 0) {
            return null;
          }

          return {
            id: `summary-point-${index + 1}`,
            content: point.content.trim(),
            supportingAgents,
            consensusPercent:
              supportingAgents.length === totalAgents
                ? 100
                : Math.max(1, Math.round((supportingAgents.length / totalAgents) * 100)),
          };
        })
        .filter((point): point is MultiAgentSummaryPoint => Boolean(point))
        .sort((left, right) => right.consensusPercent - left.consensusPercent);

      if (points.length === 0) {
        throw new Error('No valid summary points generated');
      }

      return {
        userMessageId: resolvedUserMessageId,
        question,
        overallSummary:
          parsed.overallSummary?.trim() ||
          '本轮回答已经整理完成，下面是基于多模型原始回答提炼出的主要结论。',
        totalAgents,
        points,
        agentAnswers,
      };
    } catch (error) {
      console.error('[MultiAgent summary fallback]', error);
      const fallbackSummary = this.buildFallbackSummary(question, agentAnswers);
      return {
        ...fallbackSummary,
        userMessageId: resolvedUserMessageId,
      };
    }
  }
}
