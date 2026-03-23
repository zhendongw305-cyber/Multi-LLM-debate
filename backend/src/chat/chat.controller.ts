import { BadRequestException, Controller, Post, Body, Sse, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import { MessageRole } from '@prisma/client';
import { map } from 'rxjs';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  async sendMessage(
    @Body() body: { sessionId: string; content: string; role?: MessageRole }
  ) {
    return this.chatService.sendMessage(body.sessionId, body.content, body.role);
  }

  @Post('multi-agent-summary')
  async summarizeMultiAgentRound(
    @Body() body: { sessionId: string; userMessageId?: string }
  ) {
    try {
      return await this.chatService.summarizeMultiAgentRound(body.sessionId, body.userMessageId);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : '多人协助总结生成失败，请稍后重试',
      );
    }
  }

  @Sse('stream')
  async streamMessage(
    @Query('sessionId') sessionId: string,
    @Query('content') content: string,
    @Req() req: Request,
  ) {
    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort();
    });

    const rx = await this.chatService.sendMessageStream(sessionId, content, abortController.signal);
    return rx.pipe(map((event) => ({ data: event.data })));
  }
}
