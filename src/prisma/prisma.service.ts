import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Erreur levée quand la base reste injoignable malgré les tentatives. */
export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Base de données momentanément indisponible.');
    this.name = 'DatabaseUnavailableError';
    (this as { cause?: unknown }).cause = cause;
  }
}

const TRANSIENT_CODES = ['P1001', 'P1002', 'P1008', 'P1017'];
const TRANSIENT_HINTS = [
  'etimedout',
  'timed out',
  'econnreset',
  'econnrefused',
  'enotfound',
  'eai_again',
  'getaddrinfo',
  'epipe',
  'closed',
  'terminated',
  'not reachable',
  'not queryable',
  "can't reach database server",
  'connection error',
  'connection terminated',
  'server closed the connection',
  'databasenotreachable',
];

export const isTransient = (error: unknown): boolean => {
  const e = error as {
    code?: string;
    message?: string;
    name?: string;
    cause?: unknown;
  };
  if (e?.code && TRANSIENT_CODES.includes(e.code)) return true;
  if (e instanceof DatabaseUnavailableError) return true;
  const text = `${e?.name ?? ''} ${e?.message ?? ''}`.toLowerCase();
  if (TRANSIENT_HINTS.some((h) => text.includes(h))) return true;
  // Prisma enveloppe souvent l'erreur réseau dans `cause` / `meta`.
  const nested =
    (e as { meta?: { driverAdapterError?: { cause?: { kind?: string } } } })?.meta
      ?.driverAdapterError?.cause?.kind ?? '';
  if (String(nested).toLowerCase().includes('notreachable')) return true;
  return e?.cause ? isTransient(e.cause) : false;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const logger = new Logger('Prisma');

/**
 * Disjoncteur : après plusieurs échecs transitoires consécutifs (panne Neon),
 * on arrête de retenter pendant un court moment et on répond vite 503, au lieu
 * de laisser des dizaines de requêtes s'empiler en boucle de retry.
 */
const BREAKER_SEUIL = 6;
const BREAKER_COOLDOWN_MS = 12_000;

const breaker = {
  failures: 0,
  openUntil: 0,
  get open() {
    return Date.now() < this.openUntil;
  },
  recordSuccess() {
    this.failures = 0;
    this.openUntil = 0;
  },
  recordFailure() {
    this.failures += 1;
    if (this.failures >= BREAKER_SEUIL) {
      this.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
      this.failures = 0;
      logger.error(
        `Base injoignable de façon répétée — pause des requêtes pendant ${BREAKER_COOLDOWN_MS / 1000}s.`,
      );
    }
  },
};

/** Rejoue `fn` sur erreur transitoire, avec disjoncteur. */
export async function retry<T>(fn: () => Promise<T>): Promise<T> {
  if (breaker.open) {
    throw new DatabaseUnavailableError();
  }

  const delays = [300, 800, 1800]; // ~3 tentatives, ~3 s max
  for (let i = 0; i <= delays.length; i++) {
    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (error) {
      if (!isTransient(error)) throw error;
      breaker.recordFailure();
      if (breaker.open || i === delays.length) {
        throw new DatabaseUnavailableError(error);
      }
      await wait(delays[i]);
    }
  }
  throw new DatabaseUnavailableError();
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
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 60_000,
      allowExitOnIdle: false,
    },
    {
      onPoolError: (error) => logger.warn(`Pool PostgreSQL : ${error.message}`),
    },
  );
}

export async function connectWithRetry(client: PrismaClient, tries = 30) {
  for (let i = 1; i <= tries; i++) {
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      logger.log('Connexion à la base établie.');
      breaker.recordSuccess();
      return;
    } catch (error: any) {
      const delay = Math.min(2000 * i, 15_000);
      if (i <= 3 || i % 5 === 0) {
        logger.warn(
          `Base injoignable (essai ${i}) : ${error.message}. Nouvel essai dans ${delay / 1000}s.`,
        );
      }
      await wait(delay);
    }
  }
  logger.error('Base toujours injoignable après plusieurs minutes.');
}

/**
 * Client Prisma unique. `PrismaModule` fournit sa version étendue
 * (chaque opération de modèle protégée par `retry` + disjoncteur).
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
