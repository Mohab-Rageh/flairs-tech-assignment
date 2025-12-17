import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

      // Get user to extract email for team name
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate team name from email (split by @ and take first part)
      const teamName = user.email.split('@')[0];

      // Generate players data before transaction
      const players = this.generatePlayers(''); // Will be updated with team.id in transaction

      // Create team and players in a single transaction
      await this.prisma.$transaction(async (tx) => {
        // Create team with budget of $5,000,000
        const team = await tx.team.create({
          data: {
            userId,
            name: teamName,
            budget: 5000000,
          },
        });

        this.logger.log(
          `Team created with ID: ${team.id} and name: ${teamName}`,
        );

        // Update players with the actual team ID
        const playersWithTeamId = players.map((player) => ({
          ...player,
          teamId: team.id,
        }));

        // Create players
        await tx.player.createMany({
          data: playersWithTeamId,
        });

        this.logger.log(
          `Created ${players.length} players for team ${team.id}`,
        );
      });
    } catch (error) {
      this.logger.error(`Error creating team for user ${userId}:`, error);
      throw error;
    }
  }

  private generatePlayers(teamId: string) {
    const players: {
      teamId: string;
      name: string;
      position: Position;
      value: number;
    }[] = [];

    // 3 Goalkeepers
    for (let i = 1; i <= 3; i++) {
      players.push({
        teamId,
        name: `goalkeeper-${i}`,
        position: Position.GOALKEEPER,
        value: this.generatePlayerValue(50000, 200000), // Goalkeepers: $50k - $200k
      });
    }

    // 6 Defenders
    for (let i = 1; i <= 6; i++) {
      players.push({
        teamId,
        name: `defender-${i}`,
        position: Position.DEFENDER,
        value: this.generatePlayerValue(30000, 150000), // Defenders: $30k - $150k
      });
    }

    // 6 Midfielders
    for (let i = 1; i <= 6; i++) {
      players.push({
        teamId,
        name: `midfielder-${i}`,
        position: Position.MIDFIELDER,
        value: this.generatePlayerValue(40000, 180000), // Midfielders: $40k - $180k
      });
    }

    // 5 Attackers (FORWARD)
    for (let i = 1; i <= 5; i++) {
      players.push({
        teamId,
        name: `forward-${i}`,
        position: Position.FORWARD,
        value: this.generatePlayerValue(50000, 250000), // Attackers: $50k - $250k
      });
    }

    return players;
  }

  private generatePlayerValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async getTeamByUserId(userId: string) {
    const team = await this.prisma.team.findFirst({
      where: { userId },
      include: {
        players: {
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }
}
