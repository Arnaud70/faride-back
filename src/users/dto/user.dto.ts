import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  nom: string;

  @IsString()
  telephone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  motDePasse: string;

  @IsEnum(['CLIENT', 'CHEF', 'ADMIN', 'LIVREUR'])
  role: 'CLIENT' | 'CHEF' | 'ADMIN' | 'LIVREUR';
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  motDePasse?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
