import { IsNotEmpty } from 'class-validator';

export class BuyPlayerDto {
  @IsNotEmpty()
  transferId: string;

  @IsNotEmpty()
  teamId: string;
}
