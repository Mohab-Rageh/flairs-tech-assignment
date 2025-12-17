import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class UnknownErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(UnknownErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const error = {
      statusCode: 500,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: 'Internal server error',
    };

    this.logger.error(
      `${request.method} ${request.url}`,
      JSON.stringify({
        ...error,
        exception:
          exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
      'UnknownErrorFilter',
    );

    response.status(500).json(error);
  }
}
