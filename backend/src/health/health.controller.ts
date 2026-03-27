import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/roles.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check — database + redis connectivity' })
  async check() {
    const checks: Record<string, any> = {};

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok' };
    } catch (e) {
      checks.database = { status: 'error', message: e.message };
    }

    // Redis check
    try {
      const key = `health:${Date.now()}`;
      await this.redis.set(key, 'ok', 5);
      const val = await this.redis.get(key);
      await this.redis.del(key);
      checks.redis = { status: val === 'ok' ? 'ok' : 'error' };
    } catch (e) {
      checks.redis = { status: 'error', message: e.message };
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
