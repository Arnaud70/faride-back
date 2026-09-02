import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TRANSIENT_CODES = ['P1001', 'P1002', 'P1008', 'P1017'];
const TRANSIENT_HINTS = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'Closed', 'terminated', 'not reachable'];

const isTransient = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string };
  if (e?.code && TRANSIENT_CODES.includes(e.code)) return true;
  const msg = e?.message ?? '';
  return TRANSIENT_HINTS.some((h) => msg.includes(h));
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Client Prisma unique et partagé par toute l'application.
 *
 * - un seul pool `pg` réglé (avant : ~10 pools, un par service)
 * - reconnexion au démarrage
 * - ping périodique pour empêcher Neon serverless de suspendre le compute
 * - `retry()` pour rejouer une opération après une erreur transitoire
 *   (base endormie, connexion coupée)
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveTimer?: NodeJS.Timeout;

  constructor() {
    const adapter = new PrismaPg(
      {
        connectionString: process.env.DATABASE_URL,
        max: 5,
        keepAlive: true,
        connectionTimeoutMillis: 20_000,
        idleTimeoutMillis: 60_000,
      },
      {
        onPoolError: (error) => {
          new Logger(PrismaService.name).warn(
            `Erreur du pool PostgreSQL : ${error.message}`,
          );
        },
      },
    );
    super({ adapter });
  }

  async onModuleInit() {
    await this.connectWithRetry();
    this.ping();
    // Neon suspend le compute après ~5 min d'inactivité : ping toutes les 90 s.
    this.keepAliveTimer = setInterval(() => this.ping(), 90_000);
    this.keepAliveTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    await this.$disconnect().catch(() => undefined);
  }

  private ping() {
    this.$queryRaw`SELECT 1`.catch((error: Error) =>
      this.logger.warn(`Ping keep-alive échoué : ${error.message}`),
    );
  }

  /**
   * Rejoue `fn` jusqu'à `tries` fois si l'erreur est transitoire
   * (réveil de la base, connexion coupée). Sinon relance immédiatement.
   */
  async retry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
    let lastError: unknown;
    for (let i = 1; i <= tries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || i === tries) throw error;
        const delay = Math.min(500 * 2 ** (i - 1), 4000);
        this.logger.warn(
          `Requête rejouée (${i}/${tries - 1}) après erreur transitoire, dans ${delay} ms.`,
        );
        await wait(delay);
      }
    }
    throw lastError;
  }

  private async connectWithRetry(tentatives = 6) {
    for (let i = 1; i <= tentatives; i++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        this.logger.log('Connexion à la base établie.');
        return;
      } catch (error: any) {
        const attente = Math.min(1000 * 2 ** (i - 1), 8000);
        this.logger.warn(
          `Base injoignable (tentative ${i}/${tentatives}) : ${error.message}. Nouvel essai dans ${attente} ms.`,
        );
        if (i === tentatives) {
          this.logger.error(
            "Impossible de joindre la base au démarrage — l'API démarre quand même, les requêtes retenteront.",
          );
          return;
        }
        await wait(attente);
      }
    }
  }
}
