import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DatabaseUnavailableError,
  isTransient,
} from '../prisma/prisma.service';

/**
 * Transforme toute erreur de base injoignable (panne Neon) en réponse 503
 * propre, quelle que soit la façon dont Prisma l'a enveloppée. Évite de
 * renvoyer un 500 "Internal server error" ou de divulguer la stack Prisma.
 */
@Catch()
export class DbUnavailableFilter implements ExceptionFilter {
  private readonly logger = new Logger('DbUnavailableFilter');
  private lastLog = 0;

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    const dbDown =
      exception instanceof DatabaseUnavailableError || isTransient(exception);

    if (dbDown) {
      // Log throttlé pour ne pas noyer la console pendant une panne.
      const now = Date.now();
      if (now - this.lastLog > 5000) {
        this.lastLog = now;
        this.logger.warn('Base injoignable — réponses 503 renvoyées aux clients.');
      }
      res.status(503).json({
        statusCode: 503,
        message:
          'Base de données momentanément indisponible. Réessayez dans quelques secondes.',
        error: 'Service Unavailable',
      });
      return;
    }

    // Comportement standard pour tout le reste.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json(exception.getResponse());
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
