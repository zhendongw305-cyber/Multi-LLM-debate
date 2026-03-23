import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { Prisma, ProviderCredential } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AgentMode = 'NORMAL' | 'MULTI_AGENT' | 'DEBATE';

export interface RuntimeAgentConfig {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  roleType?: string | null;
  systemPrompt?: string | null;
  sortOrder: number;
  client: OpenAI;
}

type AgentSelector = {
  mode?: AgentMode;
  roleType?: string;
};

type CredentialInput = {
  name: string;
  provider: string;
  apiKey?: string;
  baseURL?: string | null;
  defaultHeaders?: Record<string, string> | null;
  active?: boolean;
};

type AgentInput = {
  name: string;
  modelName: string;
  provider: string;
  systemPrompt?: string | null;
  active?: boolean;
  roleType?: string | null;
  sortOrder?: number;
  includeInMultiAgent?: boolean;
  includeInDebate?: boolean;
  includeInNormal?: boolean;
  credentialId?: string | null;
};

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  private normalizeRoleType(roleType?: string | null) {
    return roleType?.trim().toLowerCase() || null;
  }

  private maskApiKey(apiKey: string) {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '********';
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  private normalizeHeaders(defaultHeaders?: Record<string, string> | null) {
    if (!defaultHeaders || Object.keys(defaultHeaders).length === 0) {
      return Prisma.JsonNull;
    }

    return defaultHeaders as Prisma.InputJsonValue;
  }

  private createClient(credential: Pick<ProviderCredential, 'apiKey' | 'baseURL' | 'defaultHeaders'>) {
    const defaultHeaders =
      credential.defaultHeaders && typeof credential.defaultHeaders === 'object'
        ? (credential.defaultHeaders as Record<string, string>)
        : undefined;

    return new OpenAI({
      apiKey: credential.apiKey,
      baseURL: credential.baseURL || undefined,
      defaultHeaders,
    });
  }

  private async ensureCredentialExists(credentialId?: string | null) {
    if (!credentialId) return null;

    const credential = await this.prisma.providerCredential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new BadRequestException('Credential not found');
    }

    return credential;
  }

  async getConfig() {
    const [credentials, agents] = await Promise.all([
      this.prisma.providerCredential.findMany({
        orderBy: [{ provider: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.agent.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return {
      credentials: credentials.map((credential) => ({
        id: credential.id,
        name: credential.name,
        provider: credential.provider,
        baseURL: credential.baseURL,
        defaultHeaders: credential.defaultHeaders,
        active: credential.active,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
        hasApiKey: Boolean(credential.apiKey),
        apiKeyPreview: this.maskApiKey(credential.apiKey),
      })),
      agents,
    };
  }

  async createCredential(input: CredentialInput) {
    if (!input.apiKey) {
      throw new BadRequestException('apiKey is required');
    }

    return this.prisma.providerCredential.create({
      data: {
        name: input.name,
        provider: input.provider,
        apiKey: input.apiKey,
        baseURL: input.baseURL || null,
        defaultHeaders: this.normalizeHeaders(input.defaultHeaders),
        active: input.active ?? true,
      },
    });
  }

  async updateCredential(id: string, input: Partial<CredentialInput>) {
    const existing = await this.prisma.providerCredential.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Credential not found');
    }

    const data: Prisma.ProviderCredentialUpdateInput = {
      name: input.name ?? existing.name,
      provider: input.provider ?? existing.provider,
      apiKey: input.apiKey && input.apiKey.trim() ? input.apiKey : existing.apiKey,
      baseURL: input.baseURL !== undefined ? input.baseURL || null : existing.baseURL,
      active: input.active ?? existing.active,
    };

    if (input.defaultHeaders !== undefined) {
      data.defaultHeaders = this.normalizeHeaders(input.defaultHeaders);
    }

    return this.prisma.providerCredential.update({
      where: { id },
      data,
    });
  }

  async deleteCredential(id: string) {
    const existing = await this.prisma.providerCredential.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Credential not found');
    }

    await this.prisma.agent.updateMany({
      where: { credentialId: id },
      data: { credentialId: null },
    });

    return this.prisma.providerCredential.delete({ where: { id } });
  }

  async createAgent(input: AgentInput) {
    await this.ensureCredentialExists(input.credentialId);

    return this.prisma.agent.create({
      data: {
        name: input.name,
        modelName: input.modelName,
        provider: input.provider,
        systemPrompt: input.systemPrompt || null,
        active: input.active ?? true,
        roleType: this.normalizeRoleType(input.roleType),
        sortOrder: input.sortOrder ?? 0,
        includeInNormal: input.includeInNormal ?? false,
        includeInMultiAgent: input.includeInMultiAgent ?? false,
        includeInDebate: input.includeInDebate ?? false,
        credentialId: input.credentialId || null,
      },
    });
  }

  async updateAgent(id: string, input: Partial<AgentInput>) {
    const existing = await this.prisma.agent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Agent not found');
    }

    if (input.credentialId !== undefined) {
      await this.ensureCredentialExists(input.credentialId);
    }

    return this.prisma.agent.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        modelName: input.modelName ?? existing.modelName,
        provider: input.provider ?? existing.provider,
        systemPrompt: input.systemPrompt !== undefined ? input.systemPrompt || null : existing.systemPrompt,
        active: input.active ?? existing.active,
        roleType:
          input.roleType !== undefined
            ? this.normalizeRoleType(input.roleType)
            : existing.roleType,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        includeInNormal: input.includeInNormal ?? existing.includeInNormal,
        includeInMultiAgent: input.includeInMultiAgent ?? existing.includeInMultiAgent,
        includeInDebate: input.includeInDebate ?? existing.includeInDebate,
        credentialId: input.credentialId !== undefined ? input.credentialId || null : existing.credentialId,
      },
    });
  }

  async deleteAgent(id: string) {
    const existing = await this.prisma.agent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.agent.delete({ where: { id } });
  }

  async getRuntimeAgents(mode: AgentMode): Promise<RuntimeAgentConfig[]> {
    return this.getRuntimeAgentsBySelector({ mode });
  }

  async getRuntimeAgentByRoleType(roleType: string) {
    const agents = await this.getRuntimeAgentsBySelector({ roleType });
    return agents[0] || null;
  }

  private async getRuntimeAgentsBySelector(selector: AgentSelector): Promise<RuntimeAgentConfig[]> {
    const normalizedRoleType = this.normalizeRoleType(selector.roleType);
    const where =
      normalizedRoleType
        ? { active: true, roleType: normalizedRoleType }
        : selector.mode === 'NORMAL'
        ? { active: true, includeInNormal: true }
        : selector.mode === 'MULTI_AGENT'
        ? { active: true, includeInMultiAgent: true }
        : { active: true, includeInDebate: true };

    const agents = await this.prisma.agent.findMany({
      where,
      include: {
        credential: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const runtimeAgents = agents
      .filter((agent) => agent.credential?.active && agent.credential.apiKey)
      .filter((agent) =>
        normalizedRoleType
          ? this.normalizeRoleType(agent.roleType) === normalizedRoleType
          : this.normalizeRoleType(agent.roleType) !== 'summary',
      )
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        provider: agent.provider,
        modelName: agent.modelName,
        roleType: agent.roleType,
        sortOrder: agent.sortOrder,
        systemPrompt: agent.systemPrompt,
        client: this.createClient(agent.credential!),
      }));

    return runtimeAgents;
  }
}
