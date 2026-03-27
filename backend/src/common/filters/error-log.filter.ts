import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../redis/redis.service';

const ERROR_LOG_KEY = 'system:error:log';
const MAX_ERRORS = 200;

@Injectable()
@Catch()
export class ErrorLogFilter implements ExceptionFilter {
  constructor(private readonly redis: RedisService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    // Only log 500-class (non-HttpException) errors
    const isHttpException = exception instanceof Error &&
      (exception.constructor.name === 'HttpException' ||
       exception.constructor.name.endsWith('Exception'));

    if (isHttpException) return; // Let HttpExceptionFilter handle it

    const entry = {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.url,
      message: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? (exception.stack ?? '').split('\n').slice(0, 5).join('\n') : '',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };

    // Store in Redis list (newest-first)
    this.redis.lpush(ERROR_LOG_KEY, JSON.stringify(entry)).catch(() => {});
    this.redis.ltrim(ERROR_LOG_KEY, 0, MAX_ERRORS - 1).catch(() => {});
  }
}
