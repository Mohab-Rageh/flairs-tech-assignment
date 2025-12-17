import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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

    // Pagination defaults
    const limit =
      typeof filters.limit === 'number' && filters.limit > 0
        ? filters.limit
        : 50;
    const page =
      typeof filters.page === 'number' && filters.page > 0 ? filters.page : 1;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await this.prisma.transfer.count({
      where: whereClause,
    });

    // Get paginated transfers
    const transfers = await this.prisma.transfer.findMany({
      where: whereClause,
      take: limit,
      skip,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            value: true,
            teamId: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            budget: true,
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

    const totalPages = Math.ceil(total / limit);

    return {
      data: transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
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
    // Initial check outside transaction for early validation (optimization)
    const buyerTeam = await this.prisma.team.findFirst({
      where: { userId },
      select: {
        id: true,
        budget: true,
        _count: {
          select: { players: true },
        },
      },
    });

    if (!buyerTeam) {
      throw new NotFoundException('Team not found');
    }

    // Perform all critical validations and updates inside transaction with Serializable isolation
    let purchasePrice: Decimal;
    let playerId: string;
    let buyerTeamId: string;

    await this.prisma.$transaction(
      async (tx) => {
        // Re-check transfer status inside transaction to prevent race conditions
        const transfer = await tx.transfer.findUnique({
          where: { id: transferId },
          select: {
            id: true,
            playerId: true,
            price: true,
            status: true,
            team: {
              select: {
                id: true,
                userId: true,
                budget: true,
                _count: {
                  select: { players: true },
                },
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

        // Re-check buyer team inside transaction
        const buyerTeamCheck = await tx.team.findUnique({
          where: { id: buyerTeam.id },
          select: {
            id: true,
            budget: true,
            _count: {
              select: { players: true },
            },
          },
        });

        if (!buyerTeamCheck) {
          throw new NotFoundException('Buyer team not found');
        }

        if (buyerTeamCheck._count.players >= 25) {
          throw new BadRequestException(
            'Team already has maximum number of players (25)',
          );
        }

        // Calculate purchase price at 95% of asking price using Decimal for precision
        purchasePrice = new Decimal(transfer.price).mul(0.95);

        if (new Decimal(buyerTeamCheck.budget).lt(purchasePrice)) {
          throw new BadRequestException('Insufficient budget');
        }

        // Re-check seller team inside transaction
        const sellerTeamCheck = await tx.team.findUnique({
          where: { id: transfer.team.id },
          select: {
            id: true,
            _count: {
              select: { players: true },
            },
          },
        });

        if (!sellerTeamCheck) {
          throw new NotFoundException('Seller team not found');
        }

        if (sellerTeamCheck._count.players <= 15) {
          throw new BadRequestException(
            'Seller team has minimum number of players (15). Cannot sell.',
          );
        }

        // All validations passed, proceed with updates
        await tx.transfer.update({
          where: { id: transferId },
          data: { status: TransferStatus.COMPLETED },
        });

        await tx.player.update({
          where: { id: transfer.playerId },
          data: { teamId: buyerTeamCheck.id },
        });

        await tx.team.update({
          where: { id: buyerTeamCheck.id },
          data: {
            budget: {
              decrement: purchasePrice,
            },
          },
        });

        await tx.team.update({
          where: { id: transfer.team.id },
          data: {
            budget: {
              increment: purchasePrice,
            },
          },
        });

        // Store values for logging and response
        playerId = transfer.playerId;
        buyerTeamId = buyerTeamCheck.id;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    // Variables are guaranteed to be assigned if transaction succeeds
    this.logger.log(
      `Player ${playerId!} bought by team ${buyerTeamId!} for ${purchasePrice!.toString()}`,
    );

    return {
      message: 'Player purchased successfully',
      purchasePrice: purchasePrice!.toNumber(),
      playerId: playerId!,
    };
  }
}
