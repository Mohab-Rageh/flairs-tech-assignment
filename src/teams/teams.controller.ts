import { Controller, Get, UseGuards } from '@nestjs/common';

import { User } from '../common/decorators/user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(JwtGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('my-team')
  async getMyTeam(@User() user: { id: string }) {
    return this.teamsService.getTeamByUserId(user.id);
  }
}
