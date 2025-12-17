import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TeamsService } from './teams.service';

@Module({
  imports: [PrismaModule],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
