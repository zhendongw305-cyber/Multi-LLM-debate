import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionMode } from '@prisma/client';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() createSessionDto: { title: string; mode: SessionMode }) {
    return this.sessionsService.create(createSessionDto.title, createSessionDto.mode);
  }

  @Get()
  findAll() {
    return this.sessionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id/mode')
  updateMode(@Param('id') id: string, @Body('mode') mode: SessionMode) {
    return this.sessionsService.updateMode(id, mode);
  }

  @Patch(':id/title')
  updateTitle(@Param('id') id: string, @Body('title') title: string) {
    return this.sessionsService.updateTitle(id, title);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sessionsService.remove(id);
  }
}
