import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SessionsModule } from './sessions/sessions.module';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [PrismaModule, SessionsModule, ChatModule, AgentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
