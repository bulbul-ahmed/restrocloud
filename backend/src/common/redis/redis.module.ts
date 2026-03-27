import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const Redis = (await import('ioredis')).default;
        const redisUrl = configService.get<string>('REDIS_URL');
        const client = redisUrl
          ? new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 50, 2000) })
          : new Redis({
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get<number>('REDIS_PORT', 6379),
              password: configService.get('REDIS_PASSWORD') || undefined,
              db: configService.get<number>('REDIS_DB', 0),
              retryStrategy: (times) => Math.min(times * 50, 2000),
            });

        client.on('connect', () => console.log('Redis connected'));
        client.on('error', (err) => console.error('Redis error:', err));

        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
