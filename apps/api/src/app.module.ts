import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(3000),
        FRONTEND_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .default('http://localhost:5173'),
        DATABASE_URL: Joi.string()
          .uri({ scheme: ['postgres', 'postgresql'] })
          .required(),
      }),
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
