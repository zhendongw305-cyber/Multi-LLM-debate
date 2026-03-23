import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMode } from '@prisma/client';
import { MULTI_AGENT_SUMMARY_TARGET_PREFIX } from '../chat/chat.constants';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async create(title: string, mode: SessionMode) {
    return this.prisma.session.create({
      data: {
        title,
        mode,
      },
    });
  }

  async findAll() {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return null;
    }

    const storedSummaries = await this.prisma.message.findMany({
      where: {
        sessionId: id,
        targetAgent: {
          startsWith: MULTI_AGENT_SUMMARY_TARGET_PREFIX,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...session,
      storedSummaries,
    };
  }

  async updateMode(id: string, mode: SessionMode) {
    return this.prisma.session.update({
      where: { id },
      data: { mode },
    });
  }

  async updateTitle(id: string, title: string) {
    return this.prisma.session.update({
      where: { id },
      data: { title },
    });
  }

  async remove(id: string) {
    return this.prisma.session.delete({
      where: { id },
    });
  }
}
