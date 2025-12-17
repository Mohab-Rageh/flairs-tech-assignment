import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { User } from '../common/decorators/user.decorator';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FilterTransfersDto } from './dto/filter-transfers.dto';
import { TransfersService } from './transfers.service';

@Controller('transfers')
@UseGuards(JwtGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  async getTransfers(@Query() filters: FilterTransfersDto) {
    return this.transfersService.getTransfers(filters);
  }

  @Post()
  async addPlayerToTransferList(
    @User() user: { id: string },
    @Body() createTransferDto: CreateTransferDto,
  ) {
    return this.transfersService.addPlayerToTransferList(
      user.id,
      createTransferDto.playerId,
      createTransferDto.askingPrice,
    );
  }

  @Delete(':id')
  async removePlayerFromTransferList(
    @User() user: { id: string },
    @Param('id') transferId: string,
  ) {
    return this.transfersService.removePlayerFromTransferList(
      user.id,
      transferId,
    );
  }

  @Post(':id/buy')
  async buyPlayer(
    @User() user: { id: string },
    @Param('id') transferId: string,
  ) {
    return this.transfersService.buyPlayer(user.id, transferId);
  }
}
