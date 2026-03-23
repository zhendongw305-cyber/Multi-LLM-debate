import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMode } from '@prisma/client';

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
    return this.prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
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
