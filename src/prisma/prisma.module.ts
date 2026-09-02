import { Global, Module } from '@nestjs/common';
import {
  PrismaService,
  connectWithRetry,
  retryExtension,
} from './prisma.service';

/**
 * Fournit un client Prisma unique et partagé.
 *
 * La fabrique instancie le client et renvoie sa version étendue : chaque
 * `findMany` / `create` / … est rejoué en cas d'erreur transitoire.
 *
 * La connexion initiale est lancée SANS être attendue : si Neon est en panne
 * au démarrage, l'API se lève quand même immédiatement (les requêtes
 * retenteront / répondront 503), au lieu de bloquer ~40 s.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        const base = new PrismaService();
        void connectWithRetry(base);
        return base.$extends(retryExtension);
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
