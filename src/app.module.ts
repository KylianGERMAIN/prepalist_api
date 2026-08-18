import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { isProduction } from './common/environment';
import { dataSourceOptions } from './config/data-source';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { MealsModule } from './modules/meals/meals.module';
import { ShoppingListModule } from './modules/shopping-list/shopping-list.module';
import { UsersModule } from './modules/users/users.module';
import { PlanModule } from './modules/plan/plan.module';

// Fail-fast en prod, pour ne pas tourner en silence sur les fallbacks de dev.
const REQUIRED_PROD_ENV = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

function validateEnv(config: Record<string, unknown>) {
  if (isProduction(config.NODE_ENV as string | undefined)) {
    const missing = REQUIRED_PROD_ENV.filter((key) => !config[key]);
    if (missing.length > 0) {
      throw new Error(
        `Variables d'environnement manquantes en production : ${missing.join(', ')}`,
      );
    }
  }
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...dataSourceOptions, autoLoadEntities: true }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
      },
    ]),
    HealthModule,
    UsersModule,
    AuthModule,
    IngredientsModule,
    MealsModule,
    PlanModule,
    ShoppingListModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Après JwtAuthGuard : req.user doit être peuplé pour que @Roles() s'applique.
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
