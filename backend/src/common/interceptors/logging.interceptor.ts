import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);

    const start = Date.now();
    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] || '';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = response.statusCode;
          this.logger.log(
            JSON.stringify({
              requestId,
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              ip,
              userAgent,
            }),
          );
        },
        error: (error) => {
          const duration = Date.now() - start;
          this.logger.error(
            JSON.stringify({
              requestId,
              method,
              url,
              error: error.message,
              duration: `${duration}ms`,
              ip,
            }),
          );
        },
      }),
    );
  }
}
