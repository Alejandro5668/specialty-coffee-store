import { Module } from '@nestjs/common';
import { HealthController } from './interface/http/health.controller';

@Module({ controllers: [HealthController] })
export class AppModule {}
