import { Global, Module } from '@nestjs/common';
import {
  PrismaService,
  connectWithRetry,
  retryExtension,
} from './prisma.service';

/**
 * Fournit un client Prisma unique et partagé.
 *
 * La fabrique :
 *  1. instancie le client (pool `pg` réglé),
 *  2. se connecte avec retry (Neon serverless peut être endormi),
 *  3. renvoie le client étendu : chaque `findMany` / `create` / … est
 *     automatiquement rejoué en cas d'erreur transitoire.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async () => {
        const base = new PrismaService();
        await connectWithRetry(base);
        return base.$extends(retryExtension);
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
