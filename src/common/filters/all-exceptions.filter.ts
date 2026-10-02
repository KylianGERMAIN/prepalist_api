import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & { id?: string; user?: AuthUser }
    >();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Les 4xx sont des erreurs du client : du bruit pour l'alerting.
      Sentry.withScope((scope) => {
        if (request.id) scope.setTag('requestId', request.id);
        if (request.user) scope.setUser({ id: request.user.id });
        Sentry.captureException(exception);
      });
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      requestId: request.id,
      ...(typeof payload === 'string' ? { message: payload } : payload),
    });
  }
}
