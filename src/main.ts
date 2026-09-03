import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DbUnavailableFilter } from './common/db-unavailable.filter';

// Filet de sécurité : une promesse rejetée non gérée (ex. timeout Neon dans une
// tâche planifiée) ne doit jamais arrêter le serveur.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error.message);
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);

  const app = await NestFactory.create(AppModule);

  // Corps de requête plus large : les images de plats importées transitent
  // en base64 (data URI) dans le JSON.
  app.use(json({ limit: '6mb' }));
  app.use(urlencoded({ extended: true, limit: '6mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Panne base -> 503 propre (au lieu de 500 / fuite de stack Prisma).
  app.useGlobalFilters(new DbUnavailableFilter());

  const config = new DocumentBuilder()
    .setTitle("API Saveurs d'Ébène")
    .setDescription(
      "Plateforme de gestion des commandes pour le restaurant Saveurs d'Ébène",
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  app.use(cookieParser());

  // Origines autorisées : localhost en dev + celles listées dans CORS_ORIGINS
  // (séparées par des virgules, ex. "https://faride-front.vercel.app"), plus
  // tout déploiement preview Vercel du même projet (*.vercel.app).
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const staticOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...extraOrigins,
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || staticOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        if (/\.vercel\.app$/.test(new URL(origin).hostname)) {
          return callback(null, true);
        }
      } catch {
        // origin malformé -> refusé ci-dessous
      }
      callback(new Error(`Origine non autorisée par CORS : ${origin}`), false);
    },
    credentials: true,
  });

  // Sur un redémarrage à chaud, l'ancien process peut encore tenir le port
  // pendant ~1 s : on retente au lieu d'abandonner (c'était la cause du
  // "serveur qui se coupe tout seul").
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await app.listen(port);
      console.log(`Application en écoute sur le port ${port}`);
      console.log(
        `Documentation Swagger disponible à http://localhost:${port}/api/docs`,
      );
      return;
    } catch (error: any) {
      if (error?.code === 'EADDRINUSE' && attempt < 8) {
        console.log(
          `Port ${port} occupé (tentative ${attempt}/8), nouvel essai dans 1 s…`,
        );
        await wait(1000);
        continue;
      }
      throw error;
    }
  }
}

bootstrap().catch((error) => {
  console.error("Échec du démarrage de l'API :", error?.message ?? error);
  process.exit(1);
});
