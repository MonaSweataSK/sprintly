import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MembersModule } from './members/members.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { SprintsModule } from './sprints/sprints.module.js';
import { TasksModule } from './tasks/tasks.module.js';

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
        JWT_SECRET: Joi.string().min(32).required(),
        OTP_HASH_SECRET: Joi.string().min(32).required(),
        SMTP_HOST: Joi.string().hostname().allow('').optional(),
        SMTP_PORT: Joi.number().port().default(587),
        SMTP_SECURE: Joi.boolean().default(false),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASSWORD: Joi.string().allow('').optional(),
        SMTP_FROM: Joi.string().email().allow('').optional(),
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    MembersModule,
    TeamsModule,
    SprintsModule,
    TasksModule,
  ],
})
export class AppModule {}
