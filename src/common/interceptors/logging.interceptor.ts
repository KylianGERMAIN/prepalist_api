import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

/** Log une ligne par requête HTTP avec méthode, URL, durée et request-id. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    const { method, url, id } = req;
    const start = Date.now();
    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.log(`${method} ${url} ${Date.now() - start}ms [${id}]`),
        ),
      );
  }
}
