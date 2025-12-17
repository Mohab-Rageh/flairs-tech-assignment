import {
  BadRequestException,
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

      player:
        filters.playerName && filters.playerName.length > 0
          ? {
              name: {
                contains: filters.playerName.trim(),
                mode: 'insensitive',
              },
            }
          : undefined,
      team:
        filters.teamName && filters.teamName.length > 0
          ? {
              name: {
                contains: filters.teamName.trim(),
                mode: 'insensitive',
              },
            }
          : undefined,
      price:
        filters.minPrice || filters.maxPrice
          ? {
              gte: filters.minPrice ?? undefined,
              lte: filters.maxPrice ?? undefined,
            }
          : undefined,
    };

    const limit = filters.limit ?? 50;
    const page = filters.page ?? 1;
    const skip = (page - 1) * limit;

    const [transfers, total] = await Promise.all([
      await this.prisma.transfer.findMany({
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
      }),
      await this.prisma.transfer.count({
        where: whereClause,
      }),
    ]);

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
    const transfer = await this.prisma.$transaction(
      async (tx) => {
        const team = await tx.team.findFirst({
          where: {
            userId,
            players: { some: { id: playerId } },
          },
          select: {
            id: true,
            _count: {
              select: { players: true },
            },
          },
        });

        if (!team) {
          throw new NotFoundException('Player not found in one of your teams');
        }

        if (team._count.players <= 15) {
          throw new BadRequestException(
            'Team has minimum number of players (15). Cannot add players to transfer list.',
          );
        }

        const existingTransfer = await tx.transfer.findFirst({
          where: {
            playerId,
            status: TransferStatus.PENDING,
          },
        });

        if (existingTransfer) {
          throw new BadRequestException(
            'Player is already in the transfer list',
          );
        }

        return tx.transfer.create({
          data: {
            playerId,
            teamId: team.id,
            price: askingPrice,
            status: TransferStatus.PENDING,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    this.logger.log(
      `Player ${playerId} added to transfer list with price ${askingPrice}`,
    );

    return transfer;
  }

  async removePlayerFromTransferList(userId: string, transferId: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId, team: { userId } },
      include: { team: true },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found or not owned by you');
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

  async buyPlayer(userId: string, transferId: string, teamId: string) {
    const buyerTeam = await this.prisma.team.findFirst({
      where: { id: teamId, userId },
      select: {
        id: true,
        budget: true,
        _count: {
          select: { players: true },
        },
      },
    });

    if (!buyerTeam) {
      throw new NotFoundException('Buyer team not found or not owned by you');
    }

    let purchasePrice: Decimal;
    let playerId: string;
    let buyerTeamId: string;

    await this.prisma.$transaction(
      async (tx) => {
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

        purchasePrice = new Decimal(transfer.price).mul(0.95);

        if (new Decimal(buyerTeamCheck.budget).lt(purchasePrice)) {
          throw new BadRequestException('Insufficient budget');
        }

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
