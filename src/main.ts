import 'dotenv/config';
import { createServer } from 'node:net';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

const isPortInUse = (port: number) => new Promise<boolean>((resolve) => {
  const probe = createServer()
    .once('error', (error: NodeJS.ErrnoException) => resolve(error.code === 'EADDRINUSE'))
    .once('listening', () => probe.close(() => resolve(false)))
    .listen(port, '::');
});

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  if (await isPortInUse(port)) {
    console.log(`Le port ${port} est déjà utilisé. L'API existante est conservée.`);
    return;
  }

  const app = await NestFactory.create(AppModule);

  // Ajouter la validation globale
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Configurer Swagger
  const config = new DocumentBuilder()
    .setTitle('API Saveurs d\'Ébène')
    .setDescription('Plateforme de gestion des commandes pour le restaurant Saveurs d\'Ébène')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.use(cookieParser());
  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });

  try {
    await app.listen(port);
  } catch (error: any) {
    if (error?.code === 'EADDRINUSE') {
      await app.close();
      console.log(`Le port ${port} est déjà utilisé. L'API existante est conservée.`);
      return;
    }
    throw error;
  }
  console.log(`Application en écoute sur le port ${port}`);
  console.log(`Documentation Swagger disponible à http://localhost:${port}/api/docs`);
}
bootstrap();
