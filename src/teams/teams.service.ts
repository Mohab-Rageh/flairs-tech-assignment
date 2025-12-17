import { Injectable, Logger } from '@nestjs/common';
import { Position } from '@prisma/client';

import { PrismaService } from '../config/prisma.service';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTeamForUser(userId: string): Promise<void> {
    this.logger.log(`Creating team for user ${userId}`);

    try {
      // Check if user already has a team
      const existingTeam = await this.prisma.team.findFirst({
        where: { userId },
      });

      if (existingTeam) {
        this.logger.log(`User ${userId} already has a team`);
        return;
      }

      // Create team with budget of $5,000,000
      const team = await this.prisma.team.create({
        data: {
          userId,
          budget: 5000000,
        },
      });

      this.logger.log(`Team created with ID: ${team.id}`);

      // Create players
      const players = this.generatePlayers(team.id);
      await this.prisma.player.createMany({
        data: players,
      });

      this.logger.log(`Created ${players.length} players for team ${team.id}`);
    } catch (error) {
      this.logger.error(`Error creating team for user ${userId}:`, error);
      throw error;
    }
  }

  private generatePlayers(teamId: string) {
    const players: {
      teamId: string;
      position: Position;
      value: number;
    }[] = [];

    // 3 Goalkeepers
    for (let i = 0; i < 3; i++) {
      players.push({
        teamId,
        position: Position.GOALKEEPER,
        value: this.generatePlayerValue(50000, 200000), // Goalkeepers: $50k - $200k
      });
    }

    // 6 Defenders
    for (let i = 0; i < 6; i++) {
      players.push({
        teamId,
        position: Position.DEFENDER,
        value: this.generatePlayerValue(30000, 150000), // Defenders: $30k - $150k
      });
    }

    // 6 Midfielders
    for (let i = 0; i < 6; i++) {
      players.push({
        teamId,
        position: Position.MIDFIELDER,
        value: this.generatePlayerValue(40000, 180000), // Midfielders: $40k - $180k
      });
    }

    // 5 Attackers (FORWARD)
    for (let i = 0; i < 5; i++) {
      players.push({
        teamId,
        position: Position.FORWARD,
        value: this.generatePlayerValue(50000, 250000), // Attackers: $50k - $250k
      });
    }

    return players;
  }

  private generatePlayerValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
