import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from './config/prisma.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let databaseStatus = 'disconnected';
    let status = 'ok';

    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      databaseStatus = 'disconnected';
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      service: 'football-team-management',
      database: databaseStatus,
    };
  }
}
