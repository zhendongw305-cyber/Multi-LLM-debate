import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Observable, Subject } from 'rxjs';
import { AgentsService } from '../agents/agents.service';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class DebateService {
  constructor(
    private prisma: PrismaService,
    private agentsService: AgentsService,
  ) {}

  private async getRecentMessages(sessionId: string, limit: number) {
    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse();
  }

  async runDebate(sessionId: string, initialContent: string, signal?: AbortSignal): Promise<Observable<any>> {
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

        let currentContext: ChatMessage[] = recentMessages.map(m => ({
            role: m.role.toLowerCase() as any,
            content: m.content
        }));

        // If the last message was the user message just added by ChatService, 
        // it's already in the context because ChatService persists it before calling runDebate.
        // But let's explicitly check if the content we just received is the last one.
        console.log(`[Debate] Context initialized with ${currentContext.length} messages.`);

        const participants = await this.agentsService.getRuntimeAgents('DEBATE');
        if (participants.length === 0) {
          throw new Error('当前还没有可用的圆桌会议模型，请先到设置面板配置并启用模型与凭证');
        }
        const maxTurns = Math.max(4, participants.length);
        const minTurnsBeforeConsensus = Math.min(3, Math.max(1, participants.length));
        let turn = 0;
        let consensusReached = false;

        while (turn < maxTurns && !consensusReached) {
          const currentAgent = participants[turn % participants.length];
          const agentName = currentAgent.name;
          
          let systemPrompt = '';
          const currentRound = turn + 1;
          const canConcludeThisRound = currentRound >= minTurnsBeforeConsensus;

          if (turn === 0) {
            systemPrompt = `你现在在参加一场多人圆桌会议。以下消息来自同一会话的连续交流，最后一条 user 消息是当前最新提问。请结合前文脉络继续讨论，而不是把它当作孤立的新问题。

请直接回应用户问题，先给出你最核心的判断，再补充你的分析框架。

要求：
1. 不要刻意制造对立，不要做“辩手式反驳”。
2. 语气像专业讨论，不是比赛。
3. 尽量提出一个对后续讨论有推进价值的新视角。
4. 回答要具体，少空话。`;
          } else {
            systemPrompt = `你是一名参加圆桌会议的专家。以下消息来自同一会话的连续交流，请阅读前面已经出现的观点，延续讨论并帮助把问题聊透。

你的任务：
1. 先简短说明你认同前文里的哪些点，或者哪些地方需要澄清。
2. 再补充一个新的角度，例如风险、边界条件、现实约束、执行路径或例外情况。
3. 如果你和前面的观点不同，不要用攻击或辩论口吻，而是用“我补充一个不同看法/换个角度看”这种方式展开。
4. ${canConcludeThisRound ? '如果讨论已经比较完整，请在结尾给出一个简短的小结，并在最后单独一行写“初步共识”。' : '这一轮先不要下结论，也不要写“初步共识”；你的任务是继续把讨论往前推进。'}

注意：
- 目标是共同推进理解，不是压倒别人。
- 少用情绪化表达，避免“激烈反驳”“你错了”这类说法。`;
          }

          if (currentAgent.systemPrompt) {
            systemPrompt = `${systemPrompt}\n\n你在本轮讨论中的附加角色要求：\n${currentAgent.systemPrompt}`;
          }

          console.log(`[Debate] Starting turn ${turn} for ${agentName}`);
          subject.next({ data: { control: 'start_turn', agentName } });

          const completion = await currentAgent.client.chat.completions.create({
            model: currentAgent.modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              ...currentContext
            ],
            stream: true,
          }, { signal });

          let turnContent = '';
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              turnContent += content;
              subject.next({ data: { content, agentName } });
            }
          }
          console.log(`[Debate] Turn ${turn} completed by ${agentName}. Length: ${turnContent.length}`);

          await this.prisma.message.create({
            data: {
              sessionId,
              content: turnContent,
              role: 'ASSISTANT',
              modeSnapshot: session.mode,
              agentId: currentAgent.id,
              agentName,
              targetAgent: turn > 0 ? participants[(turn - 1) % participants.length].name : null,
            }
          });

          currentContext.push({ role: 'assistant', content: turnContent });
          
          if (canConcludeThisRound && (turnContent.includes('初步共识') || turnContent.includes('达成共识'))) {
            consensusReached = true;
            subject.next({ data: { content: '\n\n-- 讨论已形成初步共识，自动收束本轮讨论 --', agentName: '系统' } });
          }

          turn++;
          subject.next({ data: { control: 'end_turn', agentName } });
        }

        if (!consensusReached) {
            subject.next({ data: { content: '\n\n-- 本轮讨论已告一段落，如需继续可以追问某个分歧点或细节 --', agentName: '系统' } });
        }

        subject.next({ data: { control: 'stream_done' } });
        subject.complete();
      } catch (err: any) {
        if (err.name === 'AbortError') {
            console.log(`[Debate] Client disconnected, aborting discussion turn.`);
            subject.complete();
            return;
        }
        console.error(`[Debate ERROR]`, err);
        
        let errorReason = err.message || '未知错误';
        if (err.status === 402 || errorReason.includes('402')) {
           errorReason = '账户余额不足 (402 Insufficient account balance)';
        }

        subject.next({ data: { content: `\n\n[系统异常]: 圆桌会议被迫中断 - 请求模型失败: ${errorReason}`, agentName: '系统' } });
        subject.next({ data: { control: 'end_turn', agentName: '系统' } });
        subject.next({ data: { control: 'stream_done' } });
        subject.complete();
      }
    })();

    return subject.asObservable();
  }
}
