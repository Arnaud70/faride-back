import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { NOM_REGEX, PASSWORD_REGEX, TEL_TOGO_REGEX, normalizePhone } from '../../auth/dto/register.dto';

export class CreateUserDto {
  @Matches(NOM_REGEX, { message: 'Le nom ne doit contenir que des lettres.' })
  @MinLength(3)
  nom: string;

  @Transform(({ value }) => normalizePhone(value))
  @Matches(TEL_TOGO_REGEX, { message: 'Numéro togolais invalide (8 chiffres commençant par 7 ou 9).' })
  telephone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @Matches(PASSWORD_REGEX, { message: 'Mot de passe : 8 caractères min., avec au moins une lettre et un chiffre.' })
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
