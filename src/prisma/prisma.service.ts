import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TRANSIENT_CODES = ['P1001', 'P1002', 'P1008', 'P1017'];
const TRANSIENT_HINTS = [
  'etimedout',
  'econnreset',
  'econnrefused',
  'epipe',
  'closed',
  'terminated',
  'not reachable',
  'not queryable',
  'connection error',
  'connection terminated',
  'server closed the connection',
  'databasenotreachable',
];

export const isTransient = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string; name?: string };
  if (e?.code && TRANSIENT_CODES.includes(e.code)) return true;
  const text = `${e?.name ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return TRANSIENT_HINTS.some((h) => text.includes(h));
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const logger = new Logger('Prisma');

/** Rejoue `fn` sur erreur transitoire (base Neon endormie / connexion coupée). */
export async function retry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  const delays = [400, 900, 1800, 3500, 5000, 5000];
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isTransient(error) || i === tries - 1) throw error;
      logger.warn(
        `Requête rejouée (${i + 1}/${tries - 1}) après erreur transitoire, dans ${delays[i]} ms.`,
      );
      await wait(delays[i]);
    }
  }
  throw last;
}

/** Extension Prisma : chaque opération de modèle est automatiquement rejouée. */
export const retryExtension = {
  name: 'retry-on-transient',
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ args, query }: any) {
        return retry(() => query(args));
      },
    },
  },
} as const;

export function createPrismaAdapter() {
  return new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL,
      max: 5,
      keepAlive: true,
      connectionTimeoutMillis: 20_000,
      idleTimeoutMillis: 60_000,
      allowExitOnIdle: false,
    },
    {
      onPoolError: (error) => logger.warn(`Pool PostgreSQL : ${error.message}`),
    },
  );
}

export async function connectWithRetry(client: PrismaClient, tries = 8) {
  for (let i = 1; i <= tries; i++) {
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      logger.log('Connexion à la base établie.');
      return;
    } catch (error: any) {
      const delay = Math.min(1000 * 2 ** (i - 1), 8000);
      logger.warn(
        `Base injoignable (${i}/${tries}) : ${error.message}. Nouvel essai dans ${delay} ms.`,
      );
      if (i === tries) {
        logger.error(
          "La base reste injoignable — l'API démarre quand même, les requêtes retenteront.",
        );
        return;
      }
      await wait(delay);
    }
  }
}

/**
 * Type exposé par l'injection : un `PrismaClient` classique dont chaque
 * opération de modèle est protégée par un retry (voir `PrismaModule`).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: createPrismaAdapter() });
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
