import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizePhone } from './register.dto';

export class LoginDto {
  @IsOptional()
  @IsEmail({}, { message: 'Veuillez fournir un email valide' })
  email?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? normalizePhone(value) : value))
  @IsString()
  telephone?: string;

  @IsString()
  @MinLength(1, { message: 'Le mot de passe est requis' })
  motDePasse: string;
}
