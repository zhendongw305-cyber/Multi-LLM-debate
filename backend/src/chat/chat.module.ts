import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DebateService } from './debate.service';
import { MultiAgentService } from './multi-agent.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [ChatController],
  providers: [ChatService, DebateService, MultiAgentService],
  exports: [ChatService, DebateService, MultiAgentService]
})
export class ChatModule {}
