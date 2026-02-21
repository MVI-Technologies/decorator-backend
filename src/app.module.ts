import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

// Configurações
import { appConfig, supabaseConfig, jwtConfig } from './config';

// Prisma
import { PrismaModule } from './prisma/prisma.module';

// Guards globais
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Health check e rotas na raiz (/ e /favicon.ico)
import { HealthController } from './health.controller';
import { RootController } from './root.controller';

// Módulos da aplicação
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { BriefingsModule } from './modules/briefings/briefings.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AdminModule } from './modules/admin/admin.module';
import { StorageModule } from './modules/storage/storage.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/**
 * Módulo raiz da aplicação Decorador.net.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, supabaseConfig, jwtConfig],
      // Caminho absoluto para .env (evita P1001 quando cwd ≠ raiz do projeto)
      envFilePath: join(__dirname, '..', '.env'),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 60 }],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfessionalsModule,
    ClientsModule,
    ProjectsModule,
    BriefingsModule,
    ChatModule,
    PaymentsModule,
    ReviewsModule,
    AdminModule,
    StorageModule,
    NotificationsModule,
  ],
  controllers: [RootController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

