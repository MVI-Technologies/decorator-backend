import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import { LoggingInterceptor, TransformInterceptor } from './common/interceptors';

/**
 * Bootstrap da aplicação Decorador.net API
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Serviço de configuração
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', [
    'http://localhost:3000',
  ]);

  // Prefixo global da API
  app.setGlobalPrefix('api/v1');

  // Segurança — Helmet (headers HTTP)
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Pipes globais — Validação automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades não decoradas
      forbidNonWhitelisted: true, // Rejeita propriedades desconhecidas
      transform: true, // Transforma payloads para instâncias de DTO
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filtros globais — Tratamento de exceções
  app.useGlobalFilters(new AllExceptionsFilter());

  // Interceptors globais
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Decorador.net API')
    .setDescription(
      'API do marketplace que conecta clientes a profissionais de design de interiores',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT do Supabase Auth',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Autenticação e autorização')
    .addTag('Users', 'Gerenciamento de usuários')
    .addTag('Professionals', 'Módulo de profissionais')
    .addTag('Projects', 'Projetos de design')
    .addTag('Briefings', 'Briefings de projetos')
    .addTag('Chat', 'Chat em tempo real')
    .addTag('Payments', 'Pagamentos e escrow')
    .addTag('Reviews', 'Avaliações')
    .addTag('Admin', 'Painel administrativo')
    .addTag('Storage', 'Upload de arquivos')
    .addTag('Notifications', 'Notificações')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Iniciar servidor
  await app.listen(port);
  logger.log(`🚀 Decorador.net API rodando em http://localhost:${port}`);
  logger.log(
    `📄 Swagger disponível em http://localhost:${port}/api/docs`,
  );
}

bootstrap();
