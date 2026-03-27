import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Knowledge Base (Public)')
@Controller('kb')
export class KbController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List published KB articles (public)' })
  async list() {
    return this.prisma.kbArticle.findMany({
      where: { isPublished: true },
      select: { title: true, slug: true, category: true, createdAt: true, updatedAt: true },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published KB article by slug (public)' })
  async getOne(@Param('slug') slug: string) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { slug },
      select: { title: true, slug: true, category: true, body: true, createdAt: true, updatedAt: true, isPublished: true },
    });
    if (!article || !article.isPublished) throw new NotFoundException('Article not found');
    return article;
  }
}
