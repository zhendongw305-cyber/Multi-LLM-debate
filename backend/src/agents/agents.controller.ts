import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('config')
  getConfig() {
    return this.agentsService.getConfig();
  }

  @Post('credentials')
  createCredential(
    @Body()
    body: {
      name: string;
      provider: string;
      apiKey: string;
      baseURL?: string | null;
      defaultHeaders?: Record<string, string> | null;
      active?: boolean;
    },
  ) {
    return this.agentsService.createCredential(body);
  }

  @Patch('credentials/:id')
  updateCredential(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      provider?: string;
      apiKey?: string;
      baseURL?: string | null;
      defaultHeaders?: Record<string, string> | null;
      active?: boolean;
    },
  ) {
    return this.agentsService.updateCredential(id, body);
  }

  @Delete('credentials/:id')
  deleteCredential(@Param('id') id: string) {
    return this.agentsService.deleteCredential(id);
  }

  @Post()
  createAgent(
    @Body()
    body: {
      name: string;
      modelName: string;
      provider: string;
      systemPrompt?: string | null;
      active?: boolean;
      roleType?: string | null;
      sortOrder?: number;
      includeInNormal?: boolean;
      includeInMultiAgent?: boolean;
      includeInDebate?: boolean;
      credentialId?: string | null;
    },
  ) {
    return this.agentsService.createAgent(body);
  }

  @Patch(':id')
  updateAgent(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      modelName?: string;
      provider?: string;
      systemPrompt?: string | null;
      active?: boolean;
      roleType?: string | null;
      sortOrder?: number;
      includeInNormal?: boolean;
      includeInMultiAgent?: boolean;
      includeInDebate?: boolean;
      credentialId?: string | null;
    },
  ) {
    return this.agentsService.updateAgent(id, body);
  }

  @Delete(':id')
  deleteAgent(@Param('id') id: string) {
    return this.agentsService.deleteAgent(id);
  }
}
