import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, Min, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDishDto {
  @IsString()
  @MinLength(3, { message: 'Le nom du plat doit contenir au moins 3 caractères' })
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La description ne doit pas dépasser 500 caractères' })
  description?: string;

  @IsNumber()
  @Min(0, { message: 'Le prix doit être positif' })
  @Type(() => Number)
  prix: number;

  @IsNumber()
  @Min(1, { message: 'La durée de cuisson doit être d\'au moins 1 minute' })
  @Type(() => Number)
  dureeCuissonMinutes: number;

  @IsUUID()
  categorieId: string;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean = true;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateDishDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prix?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  dureeCuissonMinutes?: number;

  @IsOptional()
  @IsUUID()
  categorieId?: string;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
