import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Client Prisma unique et partagé par toute l'application.
 *
 * Avant, chaque service instanciait son propre `PrismaClient` : ~10 pools de
 * connexions distincts vers Neon, ce qui amplifiait les erreurs `P1001`
 * (DatabaseNotReachable) lors des réveils de la base serverless.
 *
 * Ici : un seul pool `pg` réglé + reconnexion au démarrage + ping périodique
 * pour empêcher Neon de suspendre le compute pendant une démo.
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
        connectionTimeoutMillis: 15_000,
        idleTimeoutMillis: 30_000,
      },
      {
        onPoolError: (error) => {
          // Ne pas laisser une erreur de pool faire tomber le process.
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
    // Neon suspend le compute après ~5 min d'inactivité : on le garde chaud.
    this.keepAliveTimer = setInterval(() => {
      this.$queryRaw`SELECT 1`.catch((error) =>
        this.logger.warn(`Ping keep-alive échoué : ${error.message}`),
      );
    }, 4 * 60 * 1000);
    this.keepAliveTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    await this.$disconnect().catch(() => undefined);
  }

  private async connectWithRetry(tentatives = 5) {
    for (let i = 1; i <= tentatives; i++) {
      try {
        await this.$connect();
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
        await new Promise((resolve) => setTimeout(resolve, attente));
      }
    }
  }
}
