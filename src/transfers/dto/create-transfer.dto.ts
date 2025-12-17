import { IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateTransferDto {
  @IsNotEmpty()
  playerId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  askingPrice: number;
}
