import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';

import { PrismaService } from '../config/prisma.service';
import { FilterTransfersDto } from './dto/filter-transfers.dto';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTransfers(filters: FilterTransfersDto) {
    const whereClause: Prisma.TransferWhereInput = {
      status: TransferStatus.PENDING,
    };

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      whereClause.price = {};
      if (filters.minPrice !== undefined) {
        whereClause.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        whereClause.price.lte = filters.maxPrice;
      }
    }

    if (filters.teamName) {
      whereClause.team = {
        name: {
          contains: filters.teamName.trim(),
          mode: 'insensitive',
        },
      };
    }

    if (filters.playerName) {
      whereClause.player = {
        name: {
          contains: filters.playerName.trim(),
          mode: 'insensitive',
        },
      };
    }

    const transfers = await this.prisma.transfer.findMany({
      where: whereClause,
      include: {
        player: {
          include: {
            team: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        team: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return transfers;
  }

  async addPlayerToTransferList(
    userId: string,
    playerId: string,
    askingPrice: number,
  ) {
    const team = await this.prisma.team.findFirst({
      where: { userId },
      include: { players: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.players.length <= 15) {
      throw new BadRequestException(
        'Team has minimum number of players (15). Cannot add players to transfer list.',
      );
    }

    const player = team.players.find((p) => p.id === playerId);
    if (!player) {
      throw new NotFoundException('Player not found in your team');
    }

    const existingTransfer = await this.prisma.transfer.findFirst({
      where: {
        playerId,
        status: TransferStatus.PENDING,
      },
    });

    if (existingTransfer) {
      throw new BadRequestException('Player is already in the transfer list');
    }

    const transfer = await this.prisma.transfer.create({
      data: {
        playerId,
        teamId: team.id,
        price: askingPrice,
        status: TransferStatus.PENDING,
      },
      include: {
        player: true,
        team: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Player ${playerId} added to transfer list with price ${askingPrice}`,
    );

    return transfer;
  }

  async removePlayerFromTransferList(userId: string, transferId: string) {
    const team = await this.prisma.team.findFirst({
      where: { userId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      include: { team: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.teamId !== team.id) {
      throw new ForbiddenException(
        'You can only remove transfers from your own team',
      );
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Can only remove pending transfers');
    }

    await this.prisma.transfer.delete({
      where: { id: transferId },
    });

    this.logger.log(`Transfer ${transferId} removed from transfer list`);

    return { message: 'Transfer removed successfully' };
  }

  async buyPlayer(userId: string, transferId: string) {
    const buyerTeam = await this.prisma.team.findFirst({
      where: { userId },
      include: { players: true },
    });

    if (!buyerTeam) {
      throw new NotFoundException('Team not found');
    }

    if (buyerTeam.players.length >= 25) {
      throw new BadRequestException(
        'Team already has maximum number of players (25)',
      );
    }

    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        player: {
          include: {
            team: {
              include: {
                user: true,
              },
            },
          },
        },
        team: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Transfer is not available');
    }

    if (transfer.team.userId === userId) {
      throw new BadRequestException('Cannot buy your own player');
    }

    const purchasePrice = Number(transfer.price) * 0.95;

    if (Number(buyerTeam.budget) < purchasePrice) {
      throw new BadRequestException('Insufficient budget');
    }

    const sellerTeam = await this.prisma.team.findFirst({
      where: { userId: transfer.team.userId },
      include: { players: true },
    });

    if (!sellerTeam) {
      throw new NotFoundException('Seller team not found');
    }

    if (sellerTeam.players.length <= 15) {
      throw new BadRequestException(
        'Seller team has minimum number of players (15). Cannot sell.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.COMPLETED },
      });

      await tx.player.update({
        where: { id: transfer.playerId },
        data: { teamId: buyerTeam.id },
      });

      await tx.team.update({
        where: { id: buyerTeam.id },
        data: {
          budget: {
            decrement: purchasePrice,
          },
        },
      });

      await tx.team.update({
        where: { id: sellerTeam.id },
        data: {
          budget: {
            increment: purchasePrice,
          },
        },
      });
    });

    this.logger.log(
      `Player ${transfer.playerId} bought by team ${buyerTeam.id} for ${purchasePrice}`,
    );

    return {
      message: 'Player purchased successfully',
      purchasePrice,
      playerId: transfer.playerId,
    };
  }
}
