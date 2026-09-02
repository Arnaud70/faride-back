import {
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  dishId: string;

  @IsInt()
  @Min(1)
  quantite: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsDateString()
  heureRetrait: string;

  @IsOptional()
  @IsEnum(['A_EMPORTER', 'LIVRAISON', 'SUR_PLACE'])
  orderType?: 'A_EMPORTER' | 'LIVRAISON' | 'SUR_PLACE';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(['EN_ATTENTE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE', 'LIVREE', 'RECUPEREE', 'ANNULEE'])
  statut:
    | 'EN_ATTENTE'
    | 'EN_PREPARATION'
    | 'PRETE'
    | 'EN_ROUTE'
    | 'LIVREE'
    | 'RECUPEREE'
    | 'ANNULEE';
}
